import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { currentStaffId } from "@/lib/session";
import { getStaff } from "@/lib/auth";

export const metadata: Metadata = {
  title: "智翔館NEP 校門配布マネージャ",
  description: "校門配布の計画・実績入力とエージェント連携",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff(currentStaffId());
  return (
    <html lang="ja">
      <body>
        {staff && (
          <header className="topbar">
            <nav>
              <Link href="/">ホーム</Link>
              <Link href="/dashboard">ダッシュボード</Link>
              <Link href="/distributions">配布計画・実績</Link>
              <Link href="/enrollment">在籍入力</Link>
            </nav>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {staff.name}（{staff.role}）
              <form action="/api/auth/logout" method="post" style={{ display: "inline", marginLeft: 12 }}>
                <button className="secondary" style={{ padding: "4px 10px" }}>ログアウト</button>
              </form>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
