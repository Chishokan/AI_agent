import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/auth";
import { sessionCookie } from "@/lib/session";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const staff = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!staff) {
    return NextResponse.json({ error: "メールまたはパスワードが違います" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, name: staff.name });
  res.cookies.set(sessionCookie.build(staff.id));
  return res;
}
