#!/usr/bin/env node
/**
 * haifu-tool — 智翔館NEP マーケティング・エージェント MCPツール1号
 *
 * 校門配布（販促ティッシュ等）の配布数を算出する。2モード:
 *   - plan_by_target : 目標反応数から必要配布数を積み上げる（target mode / ボトムアップ）
 *   - plan_by_supply : 手元在庫を各校舎へ配分する（supply mode）
 *
 * 反応率（配布枚数あたりの反応数）は data/distribution.db の過去実績から算出する。
 * 実績が無い場合は既定値にフォールバックし、出力の rate_source に明示する。
 * このサーバーは DB を読み取り専用で開き、集計値のみを扱う（個人情報は持たない）。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// node:sqlite は Node >=22.5 の組み込みモジュール（実験的）。
// 古い @types/node には型が無い場合があるため、非リテラル指定子で動的に読み込む。
const sqliteSpecifier = "node:sqlite";
const { DatabaseSync } = (await import(sqliteSpecifier)) as any;

const DB_PATH = resolve(process.env.HAIFU_DB_PATH ?? "./data/distribution.db");
const DEFAULT_RATE = Number(process.env.HAIFU_DEFAULT_RATE ?? "0.005"); // 配布1枚あたりの反応数（実績なし時の既定）
const ALL_CAMPUSES = ["駅前校", "日野校", "大野校", "日宇校", "大島校"];
const DEFAULT_CHANNEL = "体験申込";

type Db = any;

function openDb(): Db | null {
  if (!existsSync(DB_PATH)) return null;
  try {
    return new DatabaseSync(DB_PATH, { readOnly: true });
  } catch {
    try {
      return new DatabaseSync(DB_PATH);
    } catch {
      return null;
    }
  }
}

function getCampusId(db: Db, name: string): number | null {
  const row = db.prepare("SELECT id FROM campus WHERE name = ?").get(name);
  return row ? Number(row.id) : null;
}

/** 校舎（＋任意でチャネル）の反応率を過去実績から算出。実績が無ければ null。 */
function getResponseRate(
  db: Db,
  campusId: number,
  channel?: string,
): { rate: number; responses: number; sheets: number } | null {
  let sql =
    "SELECT COALESCE(SUM(r.count),0) AS responses, COALESCE(SUM(d.actual_qty),0) AS sheets " +
    "FROM distribution d JOIN response r ON r.distribution_id = d.id " +
    "WHERE d.campus_id = ?";
  const params: unknown[] = [campusId];
  if (channel) {
    sql += " AND r.channel = ?";
    params.push(channel);
  }
  const row = db.prepare(sql).get(...params);
  const sheets = Number(row?.sheets ?? 0);
  const responses = Number(row?.responses ?? 0);
  if (sheets <= 0) return null;
  return { rate: responses / sheets, responses, sheets };
}

/** 校舎の最新月の在籍数（部門別）。division 指定でその部門のみ。 */
function getEnrollment(
  db: Db,
  campusId: number,
  division?: string,
): Array<{ division: string; count: number; year_month: string }> {
  let sql =
    "SELECT e.division AS division, e.count AS count, e.year_month AS year_month " +
    "FROM enrollment e WHERE e.campus_id = ? " +
    "AND e.year_month = (SELECT MAX(year_month) FROM enrollment " +
    "WHERE campus_id = e.campus_id AND division = e.division)";
  const params: unknown[] = [campusId];
  if (division) {
    sql += " AND e.division = ?";
    params.push(division);
  }
  return db
    .prepare(sql)
    .all(...params)
    .map((r: any) => ({
      division: String(r.division),
      count: Number(r.count),
      year_month: String(r.year_month),
    }));
}

/** 重み付きで total を整数配分（最大剰余法）。重み合計が0なら均等配分。 */
function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const base = Math.floor(total / n);
    const alloc = new Array(n).fill(base);
    let rem = total - base * n;
    for (let i = 0; i < n && rem > 0; i++, rem--) alloc[i]++;
    return alloc;
  }
  const raw = weights.map((w) => (total * w) / sum);
  const alloc = raw.map((x) => Math.floor(x));
  let rem = total - alloc.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem; k++) alloc[order[k % n].i]++;
  return alloc;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

function toContent(summary: string, payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: summary },
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function errorContent(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

const server = new McpServer({ name: "haifu-tool", version: "0.1.0" });

// ── target mode ────────────────────────────────────────────────────────────
server.registerTool(
  "plan_by_target",
  {
    title: "配布計画 / target mode（目標から必要配布数を積み上げ）",
    description:
      "目標反応数から、必要な配布枚数を反応率を使って逆算する。反応率は data/distribution.db の" +
      "過去実績（配布枚数あたりの反応数）から自動算出し、実績が無ければ既定値にフォールバックする" +
      "（rate_source に db / default / manual を明示）。在籍数があれば部門別に枚数を内訳化する。",
    inputSchema: {
      campus: z.string().describe("校舎名（駅前校 / 日野校 / 大野校 / 日宇校 / 大島校）"),
      target_responses: z.number().positive().describe("目標反応数（例: 体験申込30件なら30）"),
      channel: z
        .string()
        .optional()
        .describe(`反応チャネル（体験申込 / 問い合わせ / 入塾 など）。既定: ${DEFAULT_CHANNEL}`),
      division: z
        .string()
        .optional()
        .describe("部門で絞る場合（中等部 / RED個別）。省略時は全部門。"),
      response_rate: z
        .number()
        .positive()
        .optional()
        .describe("反応率を手動指定（配布1枚あたりの反応数）。指定時はDB実績より優先。"),
      default_rate: z
        .number()
        .positive()
        .optional()
        .describe(`実績なし時のフォールバック反応率。既定: ${DEFAULT_RATE}`),
    },
  },
  async (args) => {
    const channel = args.channel ?? DEFAULT_CHANNEL;
    const fallbackRate = args.default_rate ?? DEFAULT_RATE;
    const db = openDb();
    const notes: string[] = [];

    if (!db) notes.push(`DB が見つからないため在籍内訳・実績反応率は使えません（既定値で算出）: ${DB_PATH}`);

    const campusId = db ? getCampusId(db, args.campus) : null;
    if (db && campusId === null) notes.push(`校舎「${args.campus}」が campus マスタに見つかりません。`);

    // 反応率の決定
    let rate = fallbackRate;
    let rateSource: "manual" | "db" | "default" = "default";
    let rateBasis: { responses: number; sheets: number } | null = null;
    if (args.response_rate != null) {
      rate = args.response_rate;
      rateSource = "manual";
    } else if (db && campusId !== null) {
      const rr = getResponseRate(db, campusId, channel);
      if (rr) {
        rate = rr.rate;
        rateSource = "db";
        rateBasis = { responses: rr.responses, sheets: rr.sheets };
      } else {
        notes.push(
          `校舎「${args.campus}」/ チャネル「${channel}」の過去実績が無いため既定反応率 ${fallbackRate} を使用。`,
        );
      }
    }

    const totalSheets = Math.ceil(args.target_responses / rate);

    // 在籍数で部門別に内訳化
    const enr = db && campusId !== null ? getEnrollment(db, campusId, args.division) : [];
    let breakdown: Array<{
      division: string;
      enrollment: number;
      share: number;
      sheets: number;
      expected_responses: number;
    }> = [];
    if (enr.length > 0) {
      const weights = enr.map((e) => e.count);
      const alloc = allocate(totalSheets, weights);
      const totalEnr = weights.reduce((a, b) => a + b, 0);
      breakdown = enr.map((e, i) => ({
        division: e.division,
        enrollment: e.count,
        share: totalEnr > 0 ? round1((e.count / totalEnr) * 1000) / 10 : 0, // %
        sheets: alloc[i],
        expected_responses: round1(alloc[i] * rate),
      }));
    } else if (db && campusId !== null) {
      notes.push("在籍数（enrollment）のデータが無いため部門別の内訳は省略しました。");
    }

    const payload = {
      mode: "target",
      campus: args.campus,
      channel,
      division: args.division ?? null,
      target_responses: args.target_responses,
      response_rate: round1(rate * 10000) / 10000,
      rate_source: rateSource,
      rate_basis: rateBasis,
      required_sheets: totalSheets,
      breakdown,
      db_path: DB_PATH,
      notes,
    };

    const summary =
      `【配布計画 / target】${args.campus}：${channel} を ${args.target_responses}件 取るには ` +
      `約 ${totalSheets.toLocaleString()} 枚（反応率 ${(rate * 100).toFixed(2)}% / 出所: ${rateSource}）。` +
      (notes.length ? ` ⚠ ${notes.length}件の注記あり。` : "");

    return toContent(summary, payload);
  },
);

// ── supply mode ──────────────────────────────────────────────────────────────
server.registerTool(
  "plan_by_supply",
  {
    title: "配布計画 / supply mode（手元在庫を各校舎へ配分）",
    description:
      "手元の在庫枚数を対象校舎へ配分する。配分基準は weight_by で選ぶ（enrollment=在籍数比 / " +
      "response_rate=反応率比 / equal=均等）。反応率・在籍数は data/distribution.db の実績を使い、" +
      "各校舎の想定反応数（配分枚数×反応率）も返す。",
    inputSchema: {
      total_sheets: z.number().int().positive().describe("配分する在庫の総枚数"),
      campuses: z
        .array(z.string())
        .optional()
        .describe("配分対象の校舎名リスト。省略時は全5校舎。"),
      weight_by: z
        .enum(["enrollment", "response_rate", "equal"])
        .optional()
        .describe("配分基準。enrollment=在籍数比（既定）/ response_rate=反応率比 / equal=均等"),
      channel: z
        .string()
        .optional()
        .describe(`想定反応数の算出に使う反応チャネル。既定: ${DEFAULT_CHANNEL}`),
      division: z.string().optional().describe("在籍数を部門で絞る場合（中等部 / RED個別）。"),
    },
  },
  async (args) => {
    const weightBy = args.weight_by ?? "enrollment";
    const channel = args.channel ?? DEFAULT_CHANNEL;
    const campuses = args.campuses && args.campuses.length > 0 ? args.campuses : ALL_CAMPUSES;
    const db = openDb();
    const notes: string[] = [];

    if (!db) notes.push(`DB が見つからないため在籍数・実績反応率は使えません: ${DB_PATH}`);

    type Row = {
      campus: string;
      enrollment: number;
      response_rate: number;
      rate_source: "db" | "default";
      weight: number;
    };

    const rows: Row[] = campuses.map((name) => {
      const cid = db ? getCampusId(db, name) : null;
      if (db && cid === null) notes.push(`校舎「${name}」が campus マスタに見つかりません（重み0扱い）。`);

      const enr = db && cid !== null ? getEnrollment(db, cid, args.division) : [];
      const enrollment = enr.reduce((a, e) => a + e.count, 0);

      let rate = DEFAULT_RATE;
      let rateSource: "db" | "default" = "default";
      if (db && cid !== null) {
        const rr = getResponseRate(db, cid, channel);
        if (rr) {
          rate = rr.rate;
          rateSource = "db";
        }
      }

      const weight =
        weightBy === "enrollment" ? enrollment : weightBy === "response_rate" ? rate : 1;

      return { campus: name, enrollment, response_rate: rate, rate_source: rateSource, weight };
    });

    const totalWeight = rows.reduce((a, r) => a + r.weight, 0);
    if (totalWeight <= 0) {
      notes.push(`weight_by=${weightBy} の重みが全て0のため均等配分にフォールバックしました。`);
    }

    const alloc = allocate(args.total_sheets, rows.map((r) => r.weight));

    const allocation = rows.map((r, i) => ({
      campus: r.campus,
      sheets: alloc[i],
      enrollment: r.enrollment,
      response_rate: round1(r.response_rate * 10000) / 10000,
      rate_source: r.rate_source,
      expected_responses: round1(alloc[i] * r.response_rate),
    }));

    const totalExpected = round1(allocation.reduce((a, r) => a + r.expected_responses, 0));

    const payload = {
      mode: "supply",
      total_sheets: args.total_sheets,
      weight_by: weightBy,
      channel,
      division: args.division ?? null,
      allocation,
      total_expected_responses: totalExpected,
      db_path: DB_PATH,
      notes,
    };

    const summary =
      `【配布計画 / supply】在庫 ${args.total_sheets.toLocaleString()} 枚を ${campuses.length} 校舎へ ` +
      `${weightBy} 基準で配分。想定 ${channel} 合計 約 ${totalExpected} 件。` +
      (notes.length ? ` ⚠ ${notes.length}件の注記あり。` : "");

    return toContent(summary, payload);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
