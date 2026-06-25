"use client";
import { useCallback, useEffect, useState } from "react";

type Area = { id: number; name: string };
type School = { id: number; name: string; areaId: number | null };
type Row = {
  id: number;
  date: string;
  areaId: number;
  area: { name: string };
  targetSchool: { name: string } | null;
  item: string | null;
  plannedQty: number | null;
  actualQty: number | null;
  note: string | null;
};

function thisMonth() {
  // 表示用の既定月。タイムゾーン影響を避けるため UTC ベースで YYYY-MM。
  return new Date().toISOString().slice(0, 7);
}

export default function DistributionsUI({ areas, targetSchools }: { areas: Area[]; targetSchools: School[] }) {
  const [month, setMonth] = useState(thisMonth());
  const [filterArea, setFilterArea] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 新規入力フォーム
  const [form, setForm] = useState({
    date: "",
    areaId: areas[0]?.id ?? 0,
    targetSchoolId: "",
    item: "ティッシュ",
    plannedQty: "",
    actualQty: "",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    if (filterArea) qs.set("areaId", filterArea);
    const res = await fetch(`/api/distributions?${qs}`);
    setLoading(false);
    if (!res.ok) { setError("読み込みに失敗しました"); return; }
    setRows((await res.json()).rows);
  }, [month, filterArea]);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      date: form.date,
      areaId: Number(form.areaId),
      targetSchoolId: form.targetSchoolId ? Number(form.targetSchoolId) : null,
      item: form.item || undefined,
      plannedQty: form.plannedQty === "" ? null : Number(form.plannedQty),
      actualQty: form.actualQty === "" ? null : Number(form.actualQty),
      note: form.note || undefined,
    };
    const res = await fetch("/api/distributions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "登録に失敗しました"); return; }
    setForm({ ...form, date: "", targetSchoolId: "", plannedQty: "", actualQty: "", note: "" });
    load();
  }

  async function updateActual(id: number, value: string) {
    const actualQty = value === "" ? null : Number(value);
    const res = await fetch(`/api/distributions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actualQty }),
    });
    if (!res.ok) setError("実績の更新に失敗しました");
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, actualQty } : r)));
  }

  async function remove(id: number) {
    if (!confirm("この配布レコードを削除しますか？")) return;
    const res = await fetch(`/api/distributions/${id}`, { method: "DELETE" });
    if (res.ok) setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const schoolsForArea = (areaId: number) =>
    targetSchools.filter((s) => s.areaId == null || s.areaId === areaId);

  const totalPlan = rows.reduce((s, r) => s + (r.plannedQty ?? 0), 0);
  const totalActual = rows.reduce((s, r) => s + (r.actualQty ?? 0), 0);

  return (
    <main>
      <h1>配布計画・実績</h1>

      <form className="card" onSubmit={create}>
        <strong>新規入力</strong>
        <div className="row">
          <div>
            <label>日付</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label>地区</label>
            <select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: Number(e.target.value), targetSchoolId: "" })}>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label>配布先学校（任意）</label>
            <select value={form.targetSchoolId} onChange={(e) => setForm({ ...form, targetSchoolId: e.target.value })}>
              <option value="">—</option>
              {schoolsForArea(Number(form.areaId)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label>配布物</label>
            <input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </div>
        </div>
        <div className="row">
          <div>
            <label>計画枚数</label>
            <input type="number" min={0} value={form.plannedQty} onChange={(e) => setForm({ ...form, plannedQty: e.target.value })} />
          </div>
          <div>
            <label>実績枚数（任意）</label>
            <input type="number" min={0} value={form.actualQty} onChange={(e) => setForm({ ...form, actualQty: e.target.value })} />
          </div>
          <div style={{ flex: 2 }}>
            <label>メモ（個人名は入れない）</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button style={{ marginTop: 14 }}>追加</button>
      </form>

      <h2>一覧</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <label>対象月</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div>
          <label>地区で絞る</label>
          <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
            <option value="">すべて</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <p className="muted">
        計画 {totalPlan.toLocaleString()} 枚 → 実績 {totalActual.toLocaleString()} 枚
        {loading && "（読み込み中…）"}
      </p>

      <table>
        <thead>
          <tr>
            <th>日付</th><th>地区</th><th>配布先</th><th>配布物</th>
            <th className="num">計画</th><th className="num">実績</th><th>メモ</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.date}</td>
              <td>{r.area.name}</td>
              <td>{r.targetSchool?.name ?? "—"}</td>
              <td>{r.item ?? "—"}</td>
              <td className="num">{r.plannedQty ?? "—"}</td>
              <td className="num">
                <input
                  type="number" min={0} defaultValue={r.actualQty ?? ""}
                  style={{ width: 80, textAlign: "right" }}
                  onBlur={(e) => updateActual(r.id, e.target.value)}
                />
              </td>
              <td>{r.note ?? ""}</td>
              <td><button className="secondary" style={{ padding: "4px 8px" }} onClick={() => remove(r.id)}>削除</button></td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr><td colSpan={8} className="muted">該当データがありません。</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
