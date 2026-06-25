-- 智翔館NEP マーケティング・エージェント / 業務データ層スキーマ
-- 方針: 集計値のみを保持し、個人情報（氏名・連絡先等）は持たない。
-- 反応は人数（カウント）で扱う。
-- 適用: sqlite3 ./data/distribution.db < ./data/schema.sql

PRAGMA foreign_keys = ON;

-- 校舎マスタ -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,   -- 駅前校 / 日野校 / 大野校 / 日宇校 / 大島校
  area      TEXT                    -- 立地メモ（任意）
);

-- 在籍数（target mode の積み上げ根拠）----------------------------------------
CREATE TABLE IF NOT EXISTS enrollment (
  id          INTEGER PRIMARY KEY,
  campus_id   INTEGER NOT NULL REFERENCES campus(id),
  division    TEXT NOT NULL,        -- 中等部 / RED個別
  year_month  TEXT NOT NULL,        -- 'YYYY-MM'
  count       INTEGER NOT NULL,     -- 在籍人数
  UNIQUE(campus_id, division, year_month)
);

-- 施策マスタ -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  period_start  TEXT,               -- 'YYYY-MM-DD'
  period_end    TEXT,
  target_segment TEXT,              -- 例: 中3 / 県中対策 など
  notes         TEXT
);

-- 配布実績 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribution (
  id           INTEGER PRIMARY KEY,
  date         TEXT NOT NULL,       -- 'YYYY-MM-DD'
  campus_id    INTEGER NOT NULL REFERENCES campus(id),
  campaign_id  INTEGER REFERENCES campaign(id),
  location     TEXT,                -- 配布場所（対象の校門など）
  item         TEXT,                -- ティッシュ / チラシ 等
  planned_qty  INTEGER,             -- 計画枚数
  actual_qty   INTEGER,             -- 実配布枚数
  staff        TEXT                 -- 担当（個人名ではなく役割推奨）
);

-- 反応・成果（カウントのみ。個人情報は持たない）------------------------------
CREATE TABLE IF NOT EXISTS response (
  id              INTEGER PRIMARY KEY,
  distribution_id INTEGER REFERENCES distribution(id),
  campaign_id     INTEGER REFERENCES campaign(id),
  date            TEXT,             -- 'YYYY-MM-DD'
  channel         TEXT NOT NULL,    -- 体験申込 / 問い合わせ / 入塾 など
  count           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dist_date   ON distribution(date);
CREATE INDEX IF NOT EXISTS idx_dist_campus ON distribution(campus_id);
CREATE INDEX IF NOT EXISTS idx_resp_dist   ON response(distribution_id);

-- 校舎の初期データ -----------------------------------------------------------
INSERT OR IGNORE INTO campus (id, name) VALUES
  (1, '駅前校'),
  (2, '日野校'),
  (3, '大野校'),
  (4, '日宇校'),
  (5, '大島校');
