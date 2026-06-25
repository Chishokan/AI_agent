# 智翔館NEP マーケティング・エージェント

校門配布の「配布計画・実績分析・提案」を支援する Claude Code プロジェクト。

## セットアップ

1. 認証（会社の Claude Console アカウント / 商用規約）
   - `export ANTHROPIC_API_KEY="（会社アカウントのAPIキー）"`
   - Console 側で spend limit（上限）を設定しておく
2. データDBの初期化（`sqlite3` CLI が必要）
   - `sqlite3 ./data/distribution.db < ./data/schema.sql`
   - 動作確認用にサンプルデータを入れる場合（任意・ダミー）:
     `sqlite3 ./data/distribution.db < ./examples/seed.example.sql`
3. MCPツール1号 のビルド（`mcp/README.md` 参照）
   - `cd mcp/mcp-tool-1 && npm install && npm run build`
4. このディレクトリで `claude` を起動。`.mcp.json` のサーバー承認は初回プロンプトで許可。

## 使い方（スラッシュコマンド）

- `/配布計画 駅前校 目標30件`
- `/実績分析 2026-04`
- `/提案作成 大島校 体験申込の底上げ`

## 集計クエリ

- `/実績分析` は `sql/分析/` の既製クエリを使う（`sql/README.md` 参照）。
- 配布・反応は**校舎単位**で部門の列を持たない。部門の粒度は在籍数（enrollment）のみ。

## データの扱い

- `data/distribution.db` は集計値のみ。個人情報は持ち込まない。
- `data/`（schema.sql 以外）・`.env`・`secrets/` はコミットしない（`.gitignore` 済み）。
- 権限は `.claude/settings.json` を参照。`deny` は best-effort のため、強い分離が要るならコンテナ実行を検討。

## 部門・校舎

- 校舎：駅前校 / 日野校 / 大野校 / 日宇校 / 大島校
- 部門：中等部 / RED個別
