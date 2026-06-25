# webapp — 校門配布 計画/実績 入力アプリ

職員が校門配布の**計画と実績を入力**し、エージェント（配布計画/実績分析/提案）を**Web UIから実行**できるアプリ。
スタック: **Next.js + Prisma(SQLite)**。データモデルは `../docs/データモデル.md` を参照。

> 集計値のみを扱う。個人情報（生徒・保護者・問い合わせ者の氏名/連絡先）は入力・保存しない。

## セットアップ（フェーズ2で実施）

```sh
cd webapp
npm install
cp .env.example .env            # DATABASE_URL を設定
npx prisma migrate dev --name init
npm run db:seed                 # 組織マスタ + 中等部在籍(下書き) を投入
npm run dev                     # http://localhost:3000
```

## 構成

- `prisma/schema.prisma` … データモデル v2（部門/地区/拠点/配布先学校/在籍/配布/反応/施策/KPI）
- `prisma/seed.ts` … 組織マスタ（確定）+ 中等部在籍（下書き・要検証）
- `app/` … Next.js App Router（フェーズ3で画面、フェーズ5でエージェントAPI）

## ロードマップ

| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| 1 | データモデル確定 + 組織マスタseed | ✅ |
| 2 | Next.js + Prisma 立ち上げ・マイグレーション | 予定 |
| 3 | 配布の計画/実績 入力UI・在籍入力・一覧/ダッシュボード | 予定 |
| 4 | シート①②③から集計値を移行（個人情報除外・値は要検証） | 予定 |
| 5 | エージェントAPI（Claude API + 配布計算）をWeb UIから実行 | 予定 |
| 6 | 既存 haifu-tool / slashコマンドと同一DBに収束 | 予定 |
