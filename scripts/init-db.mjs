#!/usr/bin/env node
/**
 * DB初期化スクリプト（sqlite3 CLI が無い環境向けの代替）。
 * Node の組み込み node:sqlite を使うため Node >=22.5 が必要。
 *
 * 使い方:
 *   node --experimental-sqlite scripts/init-db.mjs            # schema のみ
 *   node --experimental-sqlite scripts/init-db.mjs --seed     # schema + サンプルseed（ダミー）
 *   node --experimental-sqlite scripts/init-db.mjs --force    # 既存DBを作り直す
 *
 * 出力先は既定で ./data/distribution.db（HAIFU_DB_PATH で上書き可）。
 * sqlite3 CLI がある環境では README の手順（< schema.sql）でも可。
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB = process.env.HAIFU_DB_PATH
  ? resolve(process.env.HAIFU_DB_PATH)
  : resolve(ROOT, "data/distribution.db");

const flags = new Set(process.argv.slice(2));
const withSeed = flags.has("--seed");
const force = flags.has("--force");

if (existsSync(DB)) {
  if (!force) {
    console.error(`既にDBがあります: ${DB}\n作り直すには --force を付けてください（既存データは消えます）。`);
    process.exit(1);
  }
  rmSync(DB);
}

const db = new DatabaseSync(DB);
try {
  db.exec(readFileSync(resolve(ROOT, "data/schema.sql"), "utf8"));
  let msg = "schema 適用";
  if (withSeed) {
    db.exec(readFileSync(resolve(ROOT, "examples/seed.example.sql"), "utf8"));
    msg += " + サンプルseed投入（ダミーデータ）";
  }
  console.log(`OK: ${DB} を初期化しました（${msg}）`);
} finally {
  db.close();
}
