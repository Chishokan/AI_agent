import { NextResponse } from "next/server";
import { z } from "zod";
import { currentStaffId } from "@/lib/session";
import { planByTarget, planBySupply } from "@/lib/agentCalc";
import { generate } from "@/lib/claude";
import { planSystem, planUser, planFallback } from "@/lib/agentText";

export const runtime = "nodejs";

const Body = z.union([
  z.object({
    mode: z.literal("target"),
    areaId: z.number().int().positive(),
    targetResponses: z.number().positive(),
    channel: z.string().optional(),
    responseRate: z.number().positive().optional(),
  }),
  z.object({
    mode: z.literal("supply"),
    totalSheets: z.number().int().positive(),
    weightBy: z.enum(["enrollment", "response_rate", "equal"]).optional(),
    channel: z.string().optional(),
  }),
]);

export async function POST(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "入力が不正です" }, { status: 400 });

  const data = parsed.data.mode === "target" ? planByTarget(parsed.data) : planBySupply(parsed.data);
  let text: string;
  let usedClaude = false;
  try {
    const llm = await generate(planSystem(), planUser(data));
    if (llm) { text = llm; usedClaude = true; } else { text = planFallback(data); }
  } catch (e) {
    text = planFallback(data) + "\n\n（注: Claude API 呼び出しに失敗したためテンプレ出力にフォールバックしました）";
  }
  return NextResponse.json({ text, data, usedClaude });
}
