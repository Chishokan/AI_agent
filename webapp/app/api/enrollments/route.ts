import { NextResponse } from "next/server";
import { z } from "zod";
import { all, get, run } from "@/lib/db";
import { currentStaffId } from "@/lib/session";

export const runtime = "nodejs";

const Upsert = z.object({
  campusId: z.number().int().positive(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM で入力してください"),
  count: z.number().int().nonnegative(),
  draft: z.boolean().optional(),
});

export async function GET(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (month) { conds.push("e.yearMonth = ?"); params.push(month); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = all(
    `SELECT e.id, e.campusId, e.yearMonth, e.count, e.draft,
            c.name AS campusName, d.name AS divisionName, a.name AS areaName
       FROM Enrollment e
       JOIN Campus c ON c.id = e.campusId
       JOIN Division d ON d.id = c.divisionId
       JOIN Area a ON a.id = c.areaId
       ${where}
       ORDER BY e.yearMonth DESC, a.id, c.id`,
    ...params,
  );
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  if (currentStaffId() == null) return NextResponse.json({ error: "未認証" }, { status: 401 });
  const parsed = Upsert.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const { campusId, yearMonth, count, draft } = parsed.data;
  run(
    `INSERT INTO Enrollment(campusId, yearMonth, count, draft) VALUES(?,?,?,?)
     ON CONFLICT(campusId, yearMonth) DO UPDATE SET count = excluded.count, draft = excluded.draft`,
    campusId, yearMonth, count, draft ? 1 : 0,
  );
  const row = get(
    "SELECT id, campusId, yearMonth, count, draft FROM Enrollment WHERE campusId = ? AND yearMonth = ?",
    campusId, yearMonth,
  );
  return NextResponse.json({ row }, { status: 201 });
}
