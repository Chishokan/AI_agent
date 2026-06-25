"use client";
import { useState } from "react";

type Area = { id: number; name: string };

function useAction() {
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<{ usedClaude?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(url: string, body: unknown) {
    setBusy(true); setError(""); setText(""); setMeta(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "失敗しました"); return; }
      setText(j.text); setMeta({ usedClaude: j.usedClaude });
    } finally { setBusy(false); }
  }
  return { text, meta, busy, error, run };
}

function Output({ text, meta, busy, error }: ReturnType<typeof useAction>) {
  if (busy) return <p className="muted">生成中…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!text) return null;
  return (
    <div className="card" style={{ whiteSpace: "pre-wrap" }}>
      <div style={{ marginBottom: 8 }}>
        <span className={`badge ${meta?.usedClaude ? "" : "draft"}`}>
          {meta?.usedClaude ? "Claude生成" : "テンプレ出力（APIキー未設定）"}
        </span>
      </div>
      {text}
    </div>
  );
}

export default function AgentUI({ areas, claudeEnabled }: { areas: Area[]; claudeEnabled: boolean }) {
  const [tab, setTab] = useState<"plan" | "analyze" | "proposal">("plan");

  // 配布計画
  const plan = useAction();
  const [planMode, setPlanMode] = useState<"target" | "supply">("target");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? 0);
  const [target, setTarget] = useState("30");
  const [channel, setChannel] = useState("体験申込");
  const [totalSheets, setTotalSheets] = useState("10000");
  const [weightBy, setWeightBy] = useState("enrollment");

  // 実績分析
  const analyze = useAction();
  const [analyzeArea, setAnalyzeArea] = useState("");

  // 提案
  const proposal = useAction();
  const [propArea, setPropArea] = useState(areas[0]?.id ?? 0);
  const [theme, setTheme] = useState("体験申込の底上げ");

  return (
    <main>
      <h1>エージェント実行</h1>
      {!claudeEnabled && (
        <p className="muted">
          ⚠ ANTHROPIC_API_KEY が未設定のため、出力はテンプレ（算出値ベース）になります。会社のキーを設定すると Claude が文章化します。
        </p>
      )}

      <div className="row" style={{ marginBottom: 16 }}>
        <button className={tab === "plan" ? "" : "secondary"} onClick={() => setTab("plan")}>配布計画</button>
        <button className={tab === "analyze" ? "" : "secondary"} onClick={() => setTab("analyze")}>実績分析</button>
        <button className={tab === "proposal" ? "" : "secondary"} onClick={() => setTab("proposal")}>提案作成</button>
      </div>

      {tab === "plan" && (
        <section>
          <div className="card">
            <div className="row">
              <div>
                <label>モード</label>
                <select value={planMode} onChange={(e) => setPlanMode(e.target.value as "target" | "supply")}>
                  <option value="target">target（目標→必要枚数）</option>
                  <option value="supply">supply（在庫を配分）</option>
                </select>
              </div>
              <div>
                <label>チャネル</label>
                <input value={channel} onChange={(e) => setChannel(e.target.value)} />
              </div>
            </div>
            {planMode === "target" ? (
              <div className="row">
                <div>
                  <label>地区</label>
                  <select value={areaId} onChange={(e) => setAreaId(Number(e.target.value))}>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>目標反応数</label>
                  <input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="row">
                <div>
                  <label>在庫（総枚数）</label>
                  <input type="number" min={1} value={totalSheets} onChange={(e) => setTotalSheets(e.target.value)} />
                </div>
                <div>
                  <label>配分基準</label>
                  <select value={weightBy} onChange={(e) => setWeightBy(e.target.value)}>
                    <option value="enrollment">在籍数比</option>
                    <option value="response_rate">反応率比</option>
                    <option value="equal">均等</option>
                  </select>
                </div>
              </div>
            )}
            <button style={{ marginTop: 14 }} disabled={plan.busy}
              onClick={() => plan.run("/api/agent/plan", planMode === "target"
                ? { mode: "target", areaId, targetResponses: Number(target), channel }
                : { mode: "supply", totalSheets: Number(totalSheets), weightBy, channel })}>
              配布計画を作成
            </button>
          </div>
          <Output {...plan} />
        </section>
      )}

      {tab === "analyze" && (
        <section>
          <div className="card">
            <label>対象地区</label>
            <select value={analyzeArea} onChange={(e) => setAnalyzeArea(e.target.value)}>
              <option value="">全地区</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button style={{ marginTop: 14 }} disabled={analyze.busy}
              onClick={() => analyze.run("/api/agent/analyze", { areaId: analyzeArea ? Number(analyzeArea) : null })}>
              実績を分析
            </button>
          </div>
          <Output {...analyze} />
        </section>
      )}

      {tab === "proposal" && (
        <section>
          <div className="card">
            <div className="row">
              <div>
                <label>対象地区</label>
                <select value={propArea} onChange={(e) => setPropArea(Number(e.target.value))}>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label>テーマ</label>
                <input value={theme} onChange={(e) => setTheme(e.target.value)} />
              </div>
            </div>
            <button style={{ marginTop: 14 }} disabled={proposal.busy}
              onClick={() => proposal.run("/api/agent/proposal", { areaId: propArea, theme })}>
              提案ドラフトを作成
            </button>
          </div>
          <Output {...proposal} />
        </section>
      )}
    </main>
  );
}
