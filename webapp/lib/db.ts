import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

// DBファイルの場所。既定は webapp/data/app.db（DATABASE_PATH で上書き可）。
const DB_PATH = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : resolve(process.cwd(), "data/app.db");

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA foreign_keys = ON;");
  }
  return _db;
}

// 値はSQLiteの入力型に合わせる（@types/node の SQLInputValue）。
// 呼び出し側は string | number | bigint | null | Uint8Array を渡す想定。
type Param = string | number | bigint | null | Uint8Array;

export function all<T = Record<string, unknown>>(sql: string, ...params: Param[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, ...params: Param[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: Param[]) {
  return db().prepare(sql).run(...params);
}
