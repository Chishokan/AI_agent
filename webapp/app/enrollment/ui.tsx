"use client";
import { useCallback, useEffect, useState } from "react";

type Campus = { id: number; name: string; divisionName: string; areaName: string };
type Row = {
  id: number; campusId: number; yearMonth: string; count: number; draft: number;
  campusName: string; divisionName: string; areaName: string;
};

export default function EnrollmentUI({ campuses }: { campuses: Campus[] }) {
  const [month, setMonth] = useState("2026-04");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ campusId: campuses[0]?.id ?? 0, yearMonth: "2026-04", count: "" });

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/enrollments?month=${month}`);
    if (!res.ok) { setError("読み込みに失敗しました"); return; }
    setRows((await res.json()).rows);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/enrollments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campusId: Number(form.campusId),
        yearMonth: form.yearMonth,
        count: Number(form.count),
        draft: false,
      }),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "保存に失敗しました"); return; }
    setForm({ ...form, count: "" });
    if (form.yearMonth === month) load();
  }

  async function updateCount(id: number, value: string) {
    if (value === "") return;
    const res = await fetch(`/api/enrollments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: Number(value), draft: false }),
    });
    if (res.ok) setRows((rs) => rs.map((r) => (r.id === id ? { ...r, count: Number(value), draft: 0 } : r)));
    else setError("更新に失敗しました");
  }

  return (
    <main>
      <h1>在籍数の入力</h1>
      <p className="muted">拠点×月の在籍数。中等部=中1〜3、RED個別=全学年計。下書き(要検証)は値の確定で解除されます。</p>

      <form className="card" onSubmit={save}>
        <strong>入力・更新</strong>
        <div className="row">
          <div>
            <label>拠点</label>
            <select value={form.campusId} onChange={(e) => setForm({ ...form, campusId: Number(e.target.value) })}>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.areaName} / {c.name}（{c.divisionName}）</option>
              ))}
            </select>
          </div>
          <div>
            <label>年月</label>
            <input type="month" value={form.yearMonth} onChange={(e) => setForm({ ...form, yearMonth: e.target.value })} />
          </div>
          <div>
            <label>在籍数</label>
            <input type="number" min={0} value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} required />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button style={{ marginTop: 14 }}>保存</button>
      </form>

      <h2>一覧</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <label>対象月</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>
      <table>
        <thead>
          <tr><th>地区</th><th>拠点</th><th>部門</th><th className="num">在籍数</th><th>状態</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.areaName}</td>
              <td>{r.campusName}</td>
              <td>{r.divisionName}</td>
              <td className="num">
                <input type="number" min={0} defaultValue={r.count} style={{ width: 90, textAlign: "right" }}
                  onBlur={(e) => updateCount(r.id, e.target.value)} />
              </td>
              <td>{r.draft ? <span className="badge draft">下書き</span> : <span className="badge">確定</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted">この月のデータはありません。</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
