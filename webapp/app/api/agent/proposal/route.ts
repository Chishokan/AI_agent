import { NextResponse } from "next/server";
import { z } from "zod";
import { get, all } from "@/lib/db";
import { currentStaffId } from "@/lib/session";
import { areaResponseRate, planByTarget } from "@/lib/agentCalc";
import { generate } from "@/lib/claude";
import { proposalSystem } from "@/lib/agentText";

export const runtime = "nodejs";

const Body = z.object({
  areaId: z.number().int().positive(),
  theme: z.string().min(1),
  channel: z.string().optional(),
  targetResponses: z.number().positive().optional(),
});

export async function POST(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  const { areaId, theme } = parsed.data;
  const channel = parsed.data.channel ?? "体験申込";

  const area = get<{ name: string }>("SELECT name FROM Area WHERE id = ?", areaId)?.name ?? `area#${areaId}`;
  const rr = areaResponseRate(areaId, channel);
  const channels = all<{ channel: string; cnt: number }>(
    `SELECT r.channel, SUM(r.count) cnt FROM Response r JOIN Campus c ON c.id=r.campusId WHERE c.areaId=? GROUP BY r.channel`,
    areaId,
  );
  // 目標未指定なら現状反応の1.5倍を仮目標に
  const currentResp = rr?.responses ?? 0;
  const target = parsed.data.targetResponses ?? Math.max(currentResp ? Math.ceil(currentResp * 1.5) : 10, 10);
  const calc = planByTarget({ areaId, targetResponses: target, channel });

  const data = {
    area, theme, channel,
    current: { responses: currentResp, sheets: rr?.sheets ?? 0, ratePct: rr ? Math.round(rr.rate * 10000) / 100 : null, rateSource: rr ? "db" : "default" },
    channels,
    targetCalc: calc,
  };

  const fallback = [
    `# 配布施策 提案ドラフト：${area} / ${theme}`,
    `> 数字はDB実績・試算に基づく。校舎特性は別途ヒアリング前提。最終判断は担当者が行う。`,
    ``,
    `## 現状`,
    `- ${channel}: ${data.current.responses}件 / 配布${data.current.sheets}枚（反応率 ${data.current.ratePct ?? "—"}${data.current.ratePct != null ? "%" : ""}・出所 ${data.current.rateSource}）`,
    ``,
    `## 課題`,
    `- ${theme}`,
    ``,
    `## 期待効果（target試算）`,
    `- ${channel} ${target}件 を狙うなら 約 ${calc.requiredSheets.toLocaleString()}枚（反応率 ${(calc.responseRate * 100).toFixed(2)}% / ${calc.rateSource}）`,
    ...(calc.notes.length ? ["", "注記:", ...calc.notes.map((n) => `- ${n}`)] : []),
  ].join("\n");

  let text = fallback;
  let usedClaude = false;
  try {
    const llm = await generate(proposalSystem(), `テーマ「${theme}」について提案ドラフトを作成。\n` + "```json\n" + JSON.stringify(data, null, 2) + "\n```");
    if (llm) { text = llm; usedClaude = true; }
  } catch {
    text = fallback + "\n\n（注: Claude API 呼び出し失敗のためテンプレ出力）";
  }
  return NextResponse.json({ text, data, usedClaude });
}
