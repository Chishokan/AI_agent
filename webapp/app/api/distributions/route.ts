import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentStaffId } from "@/lib/session";

const Create = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD で入力してください"),
  areaId: z.number().int().positive(),
  targetSchoolId: z.number().int().positive().nullable().optional(),
  item: z.string().optional(),
  plannedQty: z.number().int().nonnegative().nullable().optional(),
  actualQty: z.number().int().nonnegative().nullable().optional(),
  note: z.string().optional(),
});

export async function GET(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const areaId = searchParams.get("areaId");
  const month = searchParams.get("month"); // 'YYYY-MM'
  const where: Record<string, unknown> = {};
  if (areaId) where.areaId = Number(areaId);
  if (month) where.date = { startsWith: month };
  const rows = await prisma.distribution.findMany({
    where,
    include: { area: true, targetSchool: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 500,
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const created = await prisma.distribution.create({ data: parsed.data });
  return NextResponse.json({ row: created }, { status: 201 });
}
