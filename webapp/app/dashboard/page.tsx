import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { currentStaffId } from "@/lib/session";

export const dynamic = "force-dynamic";

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

export default async function Dashboard() {
  if (currentStaffId() == null) redirect("/login");

  // 配布 計画→実績（地区別・全期間）
  const byArea = all<{ areaName: string; plan: number; actual: number }>(
    `SELECT a.name AS areaName,
            COALESCE(SUM(d.plannedQty),0) AS plan,
            COALESCE(SUM(d.actualQty),0)  AS actual
       FROM Area a LEFT JOIN Distribution d ON d.areaId = a.id
       GROUP BY a.id ORDER BY a.id`,
  );

  // 月別推移
  const byMonth = all<{ ym: string; plan: number; actual: number }>(
    `SELECT substr(date,1,7) AS ym,
            COALESCE(SUM(plannedQty),0) AS plan,
            COALESCE(SUM(actualQty),0)  AS actual
       FROM Distribution GROUP BY ym ORDER BY ym`,
  );

  // 反応率（地区別）: 反応数(拠点→地区) / 実配布枚数(地区)
  const actualByArea = all<{ areaId: number; actual: number }>(
    "SELECT areaId, COALESCE(SUM(actualQty),0) AS actual FROM Distribution GROUP BY areaId",
  );
  const respByArea = all<{ areaId: number; areaName: string; responses: number }>(
    `SELECT c.areaId, a.name AS areaName, COALESCE(SUM(r.count),0) AS responses
       FROM Response r JOIN Campus c ON c.id = r.campusId JOIN Area a ON a.id = c.areaId
       GROUP BY c.areaId`,
  );
  const actualMap = new Map(actualByArea.map((r) => [r.areaId, r.actual]));
  const reaction = respByArea.map((r) => ({
    areaName: r.areaName,
    responses: r.responses,
    actual: actualMap.get(r.areaId) ?? 0,
    rate: pct(r.responses, actualMap.get(r.areaId) ?? 0),
  }));

  // 在籍（最新月・地区別合計）
  const enrollment = all<{ areaName: string; total: number; anyDraft: number }>(
    `SELECT a.name AS areaName, SUM(e.count) AS total, MAX(e.draft) AS anyDraft
       FROM Enrollment e
       JOIN Campus c ON c.id = e.campusId
       JOIN Area a ON a.id = c.areaId
       WHERE e.yearMonth = (SELECT MAX(yearMonth) FROM Enrollment)
       GROUP BY a.id ORDER BY a.id`,
  );
  const latestMonth = all<{ ym: string }>("SELECT MAX(yearMonth) AS ym FROM Enrollment")[0]?.ym ?? "—";

  const totalPlan = byArea.reduce((s, r) => s + r.plan, 0);
  const totalActual = byArea.reduce((s, r) => s + r.actual, 0);

  return (
    <main>
      <h1>ダッシュボード</h1>

      <h2>配布 計画 → 実績（地区別・全期間）</h2>
      <table>
        <thead><tr><th>地区</th><th className="num">計画</th><th className="num">実績</th><th className="num">達成率</th></tr></thead>
        <tbody>
          {byArea.map((r) => (
            <tr key={r.areaName}>
              <td>{r.areaName}</td>
              <td className="num">{r.plan.toLocaleString()}</td>
              <td className="num">{r.actual.toLocaleString()}</td>
              <td className="num">{pct(r.actual, r.plan) ?? "—"}{pct(r.actual, r.plan) != null ? "%" : ""}</td>
            </tr>
          ))}
          <tr><td><strong>合計</strong></td>
            <td className="num"><strong>{totalPlan.toLocaleString()}</strong></td>
            <td className="num"><strong>{totalActual.toLocaleString()}</strong></td>
            <td className="num"><strong>{pct(totalActual, totalPlan) ?? "—"}%</strong></td></tr>
        </tbody>
      </table>

      <h2>月別推移</h2>
      <table>
        <thead><tr><th>年月</th><th className="num">計画</th><th className="num">実績</th></tr></thead>
        <tbody>
          {byMonth.length ? byMonth.map((r) => (
            <tr key={r.ym}><td>{r.ym}</td><td className="num">{r.plan.toLocaleString()}</td><td className="num">{r.actual.toLocaleString()}</td></tr>
          )) : <tr><td colSpan={3} className="muted">配布データがありません。</td></tr>}
        </tbody>
      </table>

      <h2>反応率（地区別）<span className="muted" style={{ fontWeight: 400, fontSize: "0.85rem" }}>　分母=実配布枚数</span></h2>
      {reaction.length ? (
        <table>
          <thead><tr><th>地区</th><th className="num">反応数</th><th className="num">実配布</th><th className="num">反応率</th></tr></thead>
          <tbody>
            {reaction.map((r) => (
              <tr key={r.areaName}>
                <td>{r.areaName}</td><td className="num">{r.responses}</td>
                <td className="num">{r.actual.toLocaleString()}</td>
                <td className="num">{r.rate ?? "—"}{r.rate != null ? "%" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">反応（体験申込/問い合わせ/入会）のデータがまだありません。</p>}

      <h2>在籍数（{latestMonth}・地区別合計）</h2>
      <table>
        <thead><tr><th>地区</th><th className="num">在籍合計</th><th>状態</th></tr></thead>
        <tbody>
          {enrollment.length ? enrollment.map((r) => (
            <tr key={r.areaName}>
              <td>{r.areaName}</td><td className="num">{r.total.toLocaleString()}</td>
              <td>{r.anyDraft ? <span className="badge draft">一部下書き</span> : <span className="badge">確定</span>}</td>
            </tr>
          )) : <tr><td colSpan={3} className="muted">在籍データがありません。</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
