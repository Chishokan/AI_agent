import { NextResponse } from "next/server";
import { z } from "zod";
import { all, get } from "@/lib/db";
import { currentStaffId } from "@/lib/session";
import { generate } from "@/lib/claude";
import { analyzeSystem } from "@/lib/agentText";

export const runtime = "nodejs";

const Body = z.object({ areaId: z.number().int().positive().nullable().optional() });

function gather(areaId: number | null | undefined) {
  const areaName = areaId
    ? get<{ name: string }>("SELECT name FROM Area WHERE id = ?", areaId)?.name ?? null
    : "全地区";
  const distWhere = areaId ? "WHERE areaId = ?" : "";
  const distParams = areaId ? [areaId] : [];
  const totals = get<{ plan: number; actual: number }>(
    `SELECT COALESCE(SUM(plannedQty),0) plan, COALESCE(SUM(actualQty),0) actual FROM Distribution ${distWhere}`,
    ...distParams,
  );
  const monthly = all(
    `SELECT substr(date,1,7) ym, COALESCE(SUM(plannedQty),0) plan, COALESCE(SUM(actualQty),0) actual
       FROM Distribution ${distWhere} GROUP BY ym ORDER BY ym`,
    ...distParams,
  );
  const channels = areaId
    ? all(
        `SELECT r.channel, SUM(r.count) cnt FROM Response r JOIN Campus c ON c.id=r.campusId
         WHERE c.areaId=? GROUP BY r.channel ORDER BY cnt DESC`,
        areaId,
      )
    : all("SELECT channel, SUM(count) cnt FROM Response GROUP BY channel ORDER BY cnt DESC");
  const actual = totals?.actual ?? 0;
  const respTotal = channels.reduce((a, c: any) => a + Number(c.cnt), 0);
  const rate = actual > 0 ? Math.round((respTotal / actual) * 1000) / 10 : null;
  return { area: areaName, totals, monthly, channels, reactionRatePct: rate, denominatorSheets: actual };
}

export async function POST(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  const data = gather(parsed.data.areaId ?? null);

  const fallback =
    `【実績分析】${data.area}\n` +
    `- 配布: 計画 ${data.totals?.plan ?? 0} → 実績 ${data.totals?.actual ?? 0} 枚\n` +
    `- 反応率: ${data.reactionRatePct ?? "—"}${data.reactionRatePct != null ? "%" : ""}（分母=実配布 ${data.denominatorSheets}枚）\n` +
    `- チャネル別: ${data.channels.map((c: any) => `${c.channel} ${c.cnt}`).join(" / ") || "データ無し"}`;

  let text = fallback;
  let usedClaude = false;
  try {
    const llm = await generate(analyzeSystem(), "次の集計から気づきをまとめてください。\n```json\n" + JSON.stringify(data, null, 2) + "\n```");
    if (llm) { text = llm; usedClaude = true; }
  } catch {
    text = fallback + "\n\n（注: Claude API 呼び出し失敗のためテンプレ出力）";
  }
  return NextResponse.json({ text, data, usedClaude });
}
