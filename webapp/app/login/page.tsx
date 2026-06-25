"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push(params.get("next") || "/");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "ログインに失敗しました");
    }
  }

  return (
    <main style={{ maxWidth: 380 }}>
      <h1>ログイン</h1>
      <p className="muted">智翔館NEP 校門配布マネージャ</p>
      <form className="card" onSubmit={onSubmit}>
        <label>メールアドレス</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <label>パスワード</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <p className="error">{error}</p>}
        <button style={{ marginTop: 16, width: "100%" }} disabled={busy}>
          {busy ? "確認中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
