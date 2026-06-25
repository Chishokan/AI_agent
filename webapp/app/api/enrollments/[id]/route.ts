import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run } from "@/lib/db";
import { currentStaffId } from "@/lib/session";

export const runtime = "nodejs";

const Patch = z.object({
  count: z.number().int().nonnegative().optional(),
  draft: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id不正" }, { status: 400 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "入力が不正です" }, { status: 400 });

  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (parsed.data.count !== undefined) { fields.push("count = ?"); values.push(parsed.data.count); }
  if (parsed.data.draft !== undefined) { fields.push("draft = ?"); values.push(parsed.data.draft ? 1 : 0); }
  if (fields.length === 0) return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
  run(`UPDATE Enrollment SET ${fields.join(", ")} WHERE id = ?`, ...values, id);
  const row = get("SELECT id, campusId, yearMonth, count, draft FROM Enrollment WHERE id = ?", id);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id不正" }, { status: 400 });
  run("DELETE FROM Enrollment WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
