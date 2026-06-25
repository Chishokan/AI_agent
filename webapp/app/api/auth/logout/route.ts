import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set(sessionCookie.clear());
  return res;
}
