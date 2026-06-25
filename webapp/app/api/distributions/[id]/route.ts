import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentStaffId } from "@/lib/session";

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
  const row = await prisma.distribution.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id不正" }, { status: 400 });
  await prisma.distribution.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
