// 配布数の算出ロジック（地区ベース）。haifu-tool の target/supply を v2 モデルに移植。
// 反応率は Response/Distribution 実績から算出、無ければ既定値にフォールバック。
import { all, get } from "./db";

const DEFAULT_RATE = Number(process.env.HAIFU_DEFAULT_RATE ?? "0.005"); // 配布1枚あたりの反応数
export const ALL_CHANNEL = "体験申込";

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** 最大剰余法で total を重み配分（整数）。重み合計0なら均等。 */
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
  const order = raw.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f);
  for (let k = 0; k < rem; k++) alloc[order[k % n].i]++;
  return alloc;
}

function latestMonth(): string | null {
  return get<{ ym: string | null }>("SELECT MAX(yearMonth) AS ym FROM Enrollment")?.ym ?? null;
}

/** 地区の反応率（実績）。無ければ null。 */
export function areaResponseRate(areaId: number, channel?: string) {
  const sheets = get<{ s: number }>(
    "SELECT COALESCE(SUM(actualQty),0) AS s FROM Distribution WHERE areaId = ?",
    areaId,
  )?.s ?? 0;
  if (sheets <= 0) return null;
  const respRow = channel
    ? get<{ r: number }>(
        "SELECT COALESCE(SUM(r.count),0) AS r FROM Response r JOIN Campus c ON c.id=r.campusId WHERE c.areaId=? AND r.channel=?",
        areaId, channel,
      )
    : get<{ r: number }>(
        "SELECT COALESCE(SUM(r.count),0) AS r FROM Response r JOIN Campus c ON c.id=r.campusId WHERE c.areaId=?",
        areaId,
      );
  const responses = respRow?.r ?? 0;
  return { rate: responses / sheets, responses, sheets };
}

function areaEnrollmentBreakdown(areaId: number) {
  const ym = latestMonth();
  return all<{ id: number; name: string; cnt: number }>(
    `SELECT c.id, c.name, COALESCE(e.count,0) AS cnt
       FROM Campus c
       LEFT JOIN Enrollment e ON e.campusId = c.id AND e.yearMonth = ?
       WHERE c.areaId = ? ORDER BY c.id`,
    ym ?? "", areaId,
  );
}

export type TargetResult = {
  mode: "target";
  area: string;
  channel: string;
  targetResponses: number;
  responseRate: number;
  rateSource: "db" | "default" | "manual";
  rateBasis: { responses: number; sheets: number } | null;
  requiredSheets: number;
  breakdown: { campus: string; enrollment: number; sheets: number; expected: number }[];
  notes: string[];
};

export function planByTarget(opts: {
  areaId: number;
  targetResponses: number;
  channel?: string;
  responseRate?: number;
  defaultRate?: number;
}): TargetResult {
  const channel = opts.channel ?? ALL_CHANNEL;
  const fallback = opts.defaultRate ?? DEFAULT_RATE;
  const area = get<{ name: string }>("SELECT name FROM Area WHERE id = ?", opts.areaId)?.name ?? `area#${opts.areaId}`;
  const notes: string[] = [];

  let rate = fallback;
  let rateSource: "db" | "default" | "manual" = "default";
  let rateBasis: { responses: number; sheets: number } | null = null;
  if (opts.responseRate != null) {
    rate = opts.responseRate;
    rateSource = "manual";
  } else {
    const rr = areaResponseRate(opts.areaId, channel);
    if (rr) { rate = rr.rate; rateSource = "db"; rateBasis = { responses: rr.responses, sheets: rr.sheets }; }
    else notes.push(`地区「${area}」/ チャネル「${channel}」の実績が無いため既定反応率 ${fallback} を使用。`);
  }

  const requiredSheets = Math.ceil(opts.targetResponses / rate);
  const enr = areaEnrollmentBreakdown(opts.areaId);
  const totalEnr = enr.reduce((a, e) => a + e.cnt, 0);
  let breakdown: TargetResult["breakdown"] = [];
  if (totalEnr > 0) {
    const alloc = allocate(requiredSheets, enr.map((e) => e.cnt));
    breakdown = enr.map((e, i) => ({ campus: e.name, enrollment: e.cnt, sheets: alloc[i], expected: round(alloc[i] * rate, 1) }));
  } else {
    notes.push("在籍数が無いため拠点別の内訳は省略。");
  }

  return {
    mode: "target", area, channel, targetResponses: opts.targetResponses,
    responseRate: round(rate), rateSource, rateBasis, requiredSheets, breakdown, notes,
  };
}

export type SupplyResult = {
  mode: "supply";
  totalSheets: number;
  weightBy: "enrollment" | "response_rate" | "equal";
  channel: string;
  allocation: { area: string; sheets: number; enrollment: number; responseRate: number; rateSource: "db" | "default"; expected: number }[];
  totalExpected: number;
  notes: string[];
};

export function planBySupply(opts: {
  totalSheets: number;
  weightBy?: "enrollment" | "response_rate" | "equal";
  channel?: string;
}): SupplyResult {
  const weightBy = opts.weightBy ?? "enrollment";
  const channel = opts.channel ?? ALL_CHANNEL;
  const ym = latestMonth();
  const notes: string[] = [];

  const areas = all<{ id: number; name: string }>("SELECT id, name FROM Area ORDER BY id");
  const rows = areas.map((a) => {
    const enrollment = get<{ s: number }>(
      "SELECT COALESCE(SUM(e.count),0) AS s FROM Enrollment e JOIN Campus c ON c.id=e.campusId WHERE c.areaId=? AND e.yearMonth=?",
      a.id, ym ?? "",
    )?.s ?? 0;
    const rr = areaResponseRate(a.id, channel);
    const rate = rr ? rr.rate : DEFAULT_RATE;
    const rateSource: "db" | "default" = rr ? "db" : "default";
    const weight = weightBy === "enrollment" ? enrollment : weightBy === "response_rate" ? rate : 1;
    return { id: a.id, name: a.name, enrollment, rate, rateSource, weight };
  });

  if (rows.reduce((a, r) => a + r.weight, 0) <= 0) notes.push(`weight_by=${weightBy} の重みが全て0のため均等配分にフォールバック。`);
  const alloc = allocate(opts.totalSheets, rows.map((r) => r.weight));

  const allocation = rows.map((r, i) => ({
    area: r.name, sheets: alloc[i], enrollment: r.enrollment,
    responseRate: round(r.rate), rateSource: r.rateSource, expected: round(alloc[i] * r.rate, 1),
  }));
  const totalExpected = round(allocation.reduce((a, r) => a + r.expected, 0), 1);
  return { mode: "supply", totalSheets: opts.totalSheets, weightBy, channel, allocation, totalExpected, notes };
}
