import { NextResponse } from "next/server";
import { z } from "zod";
import { get, run } from "@/lib/db";
import { currentStaffId } from "@/lib/session";

export const runtime = "nodejs";

const Patch = z.object({
  plannedQty: z.number().int().nonnegative().nullable().optional(),
  actualQty: z.number().int().nonnegative().nullable().optional(),
  item: z.string().optional(),
  note: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id不正" }, { status: 400 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "入力が不正です" }, { status: 400 });

  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    values.push(v);
  }
  if (fields.length === 0) return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
  fields.push("updatedAt = datetime('now')");
  run(`UPDATE Distribution SET ${fields.join(", ")} WHERE id = ?`, ...values, id);
  const row = get("SELECT * FROM Distribution WHERE id = ?", id);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id不正" }, { status: 400 });
  run("DELETE FROM Distribution WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
