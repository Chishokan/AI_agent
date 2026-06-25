import { NextResponse } from "next/server";
import { z } from "zod";
import { all, get, run } from "@/lib/db";
import { currentStaffId } from "@/lib/session";

export const runtime = "nodejs";

const Create = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD で入力してください"),
  areaId: z.number().int().positive(),
  targetSchoolId: z.number().int().positive().nullable().optional(),
  item: z.string().optional(),
  plannedQty: z.number().int().nonnegative().nullable().optional(),
  actualQty: z.number().int().nonnegative().nullable().optional(),
  note: z.string().optional(),
});

type Row = Record<string, unknown> & {
  areaName: string;
  targetSchoolName: string | null;
};

export async function GET(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const areaId = searchParams.get("areaId");
  const month = searchParams.get("month");
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (areaId) { conds.push("d.areaId = ?"); params.push(Number(areaId)); }
  if (month) { conds.push("d.date LIKE ?"); params.push(`${month}%`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = all<Row>(
    `SELECT d.*, a.name AS areaName, t.name AS targetSchoolName
       FROM Distribution d
       JOIN Area a ON a.id = d.areaId
       LEFT JOIN TargetSchool t ON t.id = d.targetSchoolId
       ${where}
       ORDER BY d.date DESC, d.id DESC
       LIMIT 500`,
    ...params,
  );
  const shaped = rows.map((r) => ({
    ...r,
    area: { name: r.areaName },
    targetSchool: r.targetSchoolName ? { name: r.targetSchoolName } : null,
  }));
  return NextResponse.json({ rows: shaped });
}

export async function POST(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const d = parsed.data;
  const res = run(
    `INSERT INTO Distribution(date, areaId, targetSchoolId, item, plannedQty, actualQty, note)
     VALUES(?,?,?,?,?,?,?)`,
    d.date, d.areaId, d.targetSchoolId ?? null, d.item ?? null,
    d.plannedQty ?? null, d.actualQty ?? null, d.note ?? null,
  );
  const row = get("SELECT * FROM Distribution WHERE id = ?", Number(res.lastInsertRowid));
  return NextResponse.json({ row }, { status: 201 });
}
