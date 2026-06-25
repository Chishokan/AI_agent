#!/usr/bin/env node
/**
 * Webアプリ DB初期化（node:sqlite）。
 *   node --experimental-sqlite db/init.mjs          # schema + 組織マスタ + 初期職員
 *   node --experimental-sqlite db/init.mjs --seed   # 上記 + 中等部在籍(下書き)
 *   node --experimental-sqlite db/init.mjs --force   # 既存DBを作り直す
 * 出力先: data/app.db（DATABASE_PATH で上書き可）。個人情報は入れない。
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DB_PATH = process.env.DATABASE_PATH ? resolve(process.env.DATABASE_PATH) : resolve(ROOT, "data/app.db");
const flags = new Set(process.argv.slice(2));
const withSeed = flags.has("--seed");
const force = flags.has("--force");

const SEED_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? "change-me";
const STAFF = [
  { email: "red@example.com", name: "RED個別担当", role: "RED個別担当" },
  { email: "chu@example.com", name: "中等部担当", role: "中等部担当" },
];
const DIVISIONS = ["中等部", "RED個別"];
const AREAS = [
  ["駅前地区", "RED個別担当", "駅前校+京町教室+ネクスタ"],
  ["大野地区", "RED個別担当", "大野校+大野教室"],
  ["日野地区", "RED個別担当", "日野校+日野教室"],
  ["日宇", "中等部担当", "中等部単独（例外）"],
  ["広田", "RED個別担当", "単独RED戦略"],
  ["大島", "RED個別担当", "単独RED戦略"],
  ["佐々", "RED個別担当", "単独RED戦略"],
];
const CAMPUSES = [
  ["駅前校", "中等部", "駅前地区"], ["京町教室", "RED個別", "駅前地区"], ["ネクスタ", "RED個別", "駅前地区"],
  ["大野校", "中等部", "大野地区"], ["大野教室", "RED個別", "大野地区"],
  ["日野校", "中等部", "日野地区"], ["日野教室", "RED個別", "日野地区"],
  ["日宇校", "中等部", "日宇"], ["広田教室", "RED個別", "広田"],
  ["大島教室", "RED個別", "大島"], ["佐々教室", "RED個別", "佐々"],
];
// 中等部在籍（下書き・要検証）: シート② 智翔館 中1〜3 計（今年=2026年度, 4〜7月）。
const CHUTOBU_ENROLLMENT_DRAFT = {
  駅前校: { "2026-04": 59, "2026-05": 59, "2026-06": 53, "2026-07": 53 },
  大野校: { "2026-04": 18, "2026-05": 18, "2026-06": 16, "2026-07": 16 },
  日宇校: { "2026-04": 19, "2026-05": 19, "2026-06": 16, "2026-07": 16 },
  日野校: { "2026-04": 38, "2026-05": 38, "2026-06": 32, "2026-07": 32 },
};

// RED個別在籍（確定）: RED月次P&Lシートの「在籍数」より（2026年度 5〜7月の実績）。
// 大島教室はシート上「青雲学舎」名義。合算在籍(5月232/6月245/7月251)と一致を確認済み。
const RED_ENROLLMENT = {
  京町教室: { "2026-05": 50, "2026-06": 54, "2026-07": 55 },
  広田教室: { "2026-05": 54, "2026-06": 56, "2026-07": 56 },
  大野教室: { "2026-05": 12, "2026-06": 14, "2026-07": 16 },
  日野教室: { "2026-05": 37, "2026-06": 36, "2026-07": 38 },
  佐々教室: { "2026-05": 17, "2026-06": 18, "2026-07": 19 },
  ネクスタ: { "2026-05": 30, "2026-06": 33, "2026-07": 34 },
  大島教室: { "2026-05": 32, "2026-06": 34, "2026-07": 33 },
};

if (existsSync(DB_PATH)) {
  if (!force) { console.error(`既にDBがあります: ${DB_PATH}\n作り直すには --force を付けてください。`); process.exit(1); }
  rmSync(DB_PATH);
}
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(readFileSync(resolve(HERE, "schema.sql"), "utf8"));

const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);
const insStaff = db.prepare("INSERT INTO Staff(email,name,passwordHash,role) VALUES(?,?,?,?)");
for (const s of STAFF) insStaff.run(s.email, s.name, passwordHash, s.role);

for (const name of DIVISIONS) db.prepare("INSERT INTO Division(name) VALUES(?)").run(name);
for (const [name, role, note] of AREAS) db.prepare("INSERT INTO Area(name,plannerRole,note) VALUES(?,?,?)").run(name, role, note);
for (const [name, div, area] of CAMPUSES) {
  const divisionId = db.prepare("SELECT id FROM Division WHERE name=?").get(div).id;
  const areaId = db.prepare("SELECT id FROM Area WHERE name=?").get(area).id;
  db.prepare("INSERT INTO Campus(name,divisionId,areaId) VALUES(?,?,?)").run(name, divisionId, areaId);
}

let enrCount = 0;
if (withSeed) {
  const insEnr = db.prepare("INSERT INTO Enrollment(campusId,yearMonth,count,draft) VALUES(?,?,?,?)");
  const seedEnr = (table, draft) => {
    for (const [campusName, byMonth] of Object.entries(table)) {
      const campusId = db.prepare("SELECT id FROM Campus WHERE name=?").get(campusName).id;
      for (const [yearMonth, count] of Object.entries(byMonth)) {
        insEnr.run(campusId, yearMonth, count, draft);
        enrCount++;
      }
    }
  };
  seedEnr(CHUTOBU_ENROLLMENT_DRAFT, 1); // 中等部: 下書き
  seedEnr(RED_ENROLLMENT, 0); // RED個別: 確定
}

db.close();
console.log(`OK: ${DB_PATH}`);
console.log(`  職員 ${STAFF.length} / 部門 ${DIVISIONS.length} / 地区 ${AREAS.length} / 拠点 ${CAMPUSES.length}` + (withSeed ? ` / 在籍(下書き) ${enrCount}` : ""));
console.log(`  初期ログイン: ${STAFF.map((s) => s.email).join(", ")} / パスワード= ${SEED_PASSWORD}（必ず変更）`);
