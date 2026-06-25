# webapp — 校門配布 計画/実績 入力アプリ

職員が校門配布の**計画と実績を入力**し、エージェント（配布計画/実績分析/提案）を**Web UIから実行**できるアプリ。
スタック: **Next.js (App Router) + node:sqlite**。データモデルは `../docs/データモデル.md` を参照。

> 集計値のみを扱う。個人情報（生徒・保護者・問い合わせ者の氏名/連絡先）は入力・保存しない。

## なぜ node:sqlite か

当初 Prisma を予定したが、実行環境によっては Prisma のエンジン配布元
(`binaries.prisma.sh`) への到達が制限される。Node 22 標準の `node:sqlite` は
外部ダウンロード不要で動くため、こちらを採用。`prisma/schema.prisma` は
**データモデルの設計書**として残し、実行時DDLは `db/schema.sql`。

## セットアップ

Node.js 22.5 以上が必要（`node:sqlite` を使用）。

```sh
cd webapp
npm install
cp .env.example .env             # SESSION_SECRET などを設定
npm run db:init:seed             # DB作成 + 組織マスタ + 初期職員 + 中等部在籍(下書き)
npm run dev                      # http://localhost:3000
```

初期ログイン: `red@example.com` / `chu@example.com`（パスワードは `SEED_STAFF_PASSWORD`、既定 `change-me`。必ず変更）。

## 構成

- `prisma/schema.prisma` … データモデル v2 の設計書（実行には使わない）
- `db/schema.sql` … 実行時DDL（node:sqlite）
- `db/init.mjs` … DB初期化・マスタ/初期職員/在籍(下書き)投入
- `lib/db.ts` … node:sqlite の薄いヘルパ（all/get/run）
- `lib/session.ts` / `lib/auth.ts` … 署名Cookieセッション + bcrypt 認証
- `middleware.ts` … 未ログインを /login へ
- `app/` … 画面（home / login / distributions）と API（auth / distributions）

## ロードマップ

| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| 1 | データモデル確定 + 組織マスタ | ✅ |
| 2 | Next.js立ち上げ + ログイン + 配布の計画/実績入力 | ✅ |
| 3 | 在籍入力UI・ダッシュボード（反応率・計画→実績） | 予定 |
| 4 | シート①②③から集計値を移行（個人情報除外・要検証） | 予定 |
| 5 | エージェントAPI（Claude API + 配布計算）をWeb UIから実行 | 予定 |
| 6 | 既存 haifu-tool / slashコマンドと同一DBに収束 | 予定 |
