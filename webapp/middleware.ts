import { NextRequest, NextResponse } from "next/server";

// 認証Cookieが無ければ /login へ。署名の厳密検証はページ/APIで行う（middlewareは存在チェックのみ）。
const PUBLIC = ["/login", "/api/auth/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const hasSession = req.cookies.has("nep_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // 静的アセット・画像最適化・faviconは除外
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
