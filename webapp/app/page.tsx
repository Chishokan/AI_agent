import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentStaffId } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (currentStaffId() == null) redirect("/login");

  const areas = await prisma.area.findMany({
    include: { campuses: { include: { division: true } } },
    orderBy: { id: "asc" },
  });
  const enrollments = await prisma.enrollment.count();
  const distributions = await prisma.distribution.count();

  return (
    <main>
      <h1>校門配布マネージャ</h1>
      <p className="muted">
        校門配布の計画・実績を入力し、エージェント（配布計画／実績分析／提案）と連携します。
      </p>

      <div className="row">
        <div className="card">
          <div className="muted">登録済みの配布レコード</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{distributions}</div>
          <Link href="/distributions">配布計画・実績を入力 →</Link>
        </div>
        <div className="card">
          <div className="muted">在籍データ（拠点×月）</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{enrollments}</div>
          <span className="muted">※一部は下書き（要検証）</span>
        </div>
      </div>

      <h2>組織（地区 → 拠点）</h2>
      <table>
        <thead>
          <tr><th>地区</th><th>計画担当</th><th>拠点（部門）</th></tr>
        </thead>
        <tbody>
          {areas.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.plannerRole}</td>
              <td>{a.campuses.map((c) => `${c.name}(${c.division.name})`).join(" / ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
