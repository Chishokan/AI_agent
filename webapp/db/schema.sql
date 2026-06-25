-- 校門配布マネージャ Webアプリ DBスキーマ（node:sqlite 用）
-- データモデル v2。設計は ../prisma/schema.prisma / ../../docs/データモデル.md と対応。
-- 集計値のみ。個人情報は持たない（Staff は社内アカウントの最小情報のみ）。

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Staff (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  role         TEXT NOT NULL,              -- RED個別担当 / 中等部担当 / 管理
  createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Division (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE               -- 中等部 / RED個別
);

CREATE TABLE IF NOT EXISTS Area (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  plannerRole TEXT NOT NULL,              -- RED個別担当 / 中等部担当
  note        TEXT
);

CREATE TABLE IF NOT EXISTS Campus (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  divisionId INTEGER NOT NULL REFERENCES Division(id),
  areaId     INTEGER NOT NULL REFERENCES Area(id)
);

CREATE TABLE IF NOT EXISTS TargetSchool (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  schoolType TEXT NOT NULL,               -- 中 / 小
  students   INTEGER,                     -- 全校生徒数（母数）
  bottom     INTEGER,                     -- ボトム配布目標
  areaId     INTEGER REFERENCES Area(id)
);

CREATE TABLE IF NOT EXISTS Enrollment (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  campusId  INTEGER NOT NULL REFERENCES Campus(id),
  yearMonth TEXT NOT NULL,                -- 'YYYY-MM'
  count     INTEGER NOT NULL,
  draft     INTEGER NOT NULL DEFAULT 0,   -- 1=要検証
  UNIQUE(campusId, yearMonth)
);

CREATE TABLE IF NOT EXISTS Campaign (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  periodStart TEXT,
  periodEnd   TEXT,
  areaId      INTEGER REFERENCES Area(id),
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS Distribution (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT NOT NULL,           -- 'YYYY-MM-DD'
  areaId         INTEGER NOT NULL REFERENCES Area(id),
  targetSchoolId INTEGER REFERENCES TargetSchool(id),
  item           TEXT,
  plannedQty     INTEGER,
  actualQty      INTEGER,
  campaignId     INTEGER REFERENCES Campaign(id),
  note           TEXT,
  createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dist_date ON Distribution(date);
CREATE INDEX IF NOT EXISTS idx_dist_area ON Distribution(areaId);

CREATE TABLE IF NOT EXISTS Response (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  campusId   INTEGER NOT NULL REFERENCES Campus(id),
  date       TEXT,
  channel    TEXT NOT NULL,               -- 体験申込 / 問い合わせ / 入会
  count      INTEGER NOT NULL,
  campaignId INTEGER REFERENCES Campaign(id)
);

CREATE TABLE IF NOT EXISTS KpiTarget (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaignId  INTEGER NOT NULL REFERENCES Campaign(id),
  metric      TEXT NOT NULL,
  targetValue INTEGER NOT NULL,
  asOf        TEXT
);
