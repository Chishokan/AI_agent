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
// 中等部在籍（確定）: 中等部在籍表の「26計」(中1+中2+中3, 2026年度 4〜7月)より。最終確認日 6/19(日宇 6/9)。
const CHUTOBU_ENROLLMENT = {
  駅前校: { "2026-04": 59, "2026-05": 61, "2026-06": 63, "2026-07": 77 },
  大野校: { "2026-04": 18, "2026-05": 21, "2026-06": 23, "2026-07": 30 },
  日野校: { "2026-04": 38, "2026-05": 39, "2026-06": 42, "2026-07": 53 },
  日宇校: { "2026-04": 19, "2026-05": 19, "2026-06": 19, "2026-07": 26 },
};

// RED個別在籍（確定）: RED月次P&Lシートの「在籍数」より（2026年度 5〜7月の実績）。
// 大島教室はシート上「青雲学舎」名義。合算在籍(5月232/6月245/7月251)と一致を確認済み。
// 配布先学校マスタ [学校名, 種別(中/小), 主たる地区]。愛宕中は駅前/日野両方の配布先だが名称一意のため駅前に紐付け（配布行は地区を別途保持）。
const TARGET_SCHOOLS = [
  ["広田中", "中", "広田"], ["早岐中", "中", "広田"], ["東明中", "中", "広田"],
  ["広田小", "小", "広田"], ["早岐小", "小", "広田"], ["花高小", "小", "広田"],
  ["大崎中", "中", "大島"], ["西海中", "中", "大島"], ["西海東小", "小", "大島"], ["大崎小", "小", "大島"],
  ["佐々中", "中", "佐々"], ["小佐々中", "中", "佐々"], ["吉井中", "中", "佐々"], ["佐々小", "小", "佐々"], ["口石小", "小", "佐々"],
  ["日宇中", "中", "日宇"], ["大塔小", "小", "日宇"], ["黒髪小", "小", "日宇"], ["日宇小", "小", "日宇"],
  ["祇園中", "中", "駅前地区"], ["山澄中", "中", "駅前地区"], ["愛宕中", "中", "駅前地区"], ["福石中", "中", "駅前地区"], ["崎辺中", "中", "駅前地区"],
  ["祇園小", "小", "駅前地区"], ["白南風小", "小", "駅前地区"],
  ["日野中", "中", "日野地区"], ["相浦中", "中", "日野地区"], ["日野小", "小", "日野地区"], ["相浦小", "小", "日野地区"],
  ["大野中", "中", "大野地区"], ["中里中", "中", "大野地区"], ["柚木中", "中", "大野地区"],
  ["大野小", "小", "大野地区"], ["中里小", "小", "大野地区"], ["春日小", "小", "大野地区"],
];

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
  seedEnr(CHUTOBU_ENROLLMENT, 0); // 中等部: 確定
  seedEnr(RED_ENROLLMENT, 0); // RED個別: 確定
}

// 配布先学校マスタ + 配布実績（シート①の月次取込、検算済み）
let schoolCount = 0;
let distCount = 0;
if (withSeed) {
  // 取込データは「広田地区」等の表記、Areaマスタは単独地区を「広田」等で保持しているため吸収。
  const AREA_ALIAS = { "広田地区": "広田", "大島地区": "大島", "佐々地区": "佐々", "日宇地区": "日宇" };
  const areaId = (name) => {
    const row = db.prepare("SELECT id FROM Area WHERE name=?").get(AREA_ALIAS[name] ?? name);
    if (!row) throw new Error(`地区が見つかりません: ${name}`);
    return row.id;
  };
  const schoolId = {};
  const insSchool = db.prepare("INSERT INTO TargetSchool(name,schoolType,areaId) VALUES(?,?,?)");
  for (const [name, type, area] of TARGET_SCHOOLS) {
    schoolId[name] = Number(insSchool.run(name, type, areaId(area)).lastInsertRowid);
    schoolCount++;
  }
  const distRows = JSON.parse(readFileSync(resolve(HERE, "distribution-import-2026.json"), "utf8"));
  const insDist = db.prepare("INSERT INTO Distribution(date,areaId,targetSchoolId,plannedQty,actualQty,note) VALUES(?,?,?,?,?,?)");
  for (const r of distRows) {
    insDist.run(`${r.yearMonth}-01`, areaId(r.area), r.school ? schoolId[r.school] : null, r.planned, r.actual, r.note);
    distCount++;
  }
}

db.close();
console.log(`OK: ${DB_PATH}`);
console.log(`  職員 ${STAFF.length} / 部門 ${DIVISIONS.length} / 地区 ${AREAS.length} / 拠点 ${CAMPUSES.length}` + (withSeed ? ` / 在籍 ${enrCount} / 配布先校 ${schoolCount} / 配布 ${distCount}` : ""));
console.log(`  初期ログイン: ${STAFF.map((s) => s.email).join(", ")} / パスワード= ${SEED_PASSWORD}（必ず変更）`);
