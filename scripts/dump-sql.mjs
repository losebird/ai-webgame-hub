#!/usr/bin/env node
/* 把 server/data/{jiwan,seed}.db 导出为 D1 可执行的 INSERT SQL（不含建表，建表走 migrations）。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "sql");
const TABLES = [
  "topics", "users", "games", "posts", "comments", "likes", "favs", "follows",
  "reviews", "packs", "plays", "history", "notifs", "reports", "hidden", "meta", "sessions"
];

function sqlValue(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "bigint") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function dumpFile(dbFile, outFile, label) {
  const db = new DatabaseSync(dbFile);
  const lines = [
    `-- 即玩 D1 数据快照：${label}`,
    `-- 由 scripts/dump-sql.mjs 从 ${path.relative(root, dbFile)} 生成，可重复导入。`,
    "PRAGMA foreign_keys = OFF;",
    "BEGIN TRANSACTION;"
  ];
  for (const table of TABLES) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    if (!exists) continue;
    lines.push(`DELETE FROM ${table};`);
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    for (const row of rows) {
      const values = cols.map((c) => sqlValue(row[c]));
      lines.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${values.join(", ")});`);
    }
  }
  lines.push("COMMIT;", "PRAGMA foreign_keys = ON;", "");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join("\n"));
  db.close();
  const bytes = fs.statSync(outFile).size;
  console.log("wrote", path.relative(root, outFile), bytes, "bytes");
}

fs.mkdirSync(outDir, { recursive: true });
dumpFile(path.join(root, "server/data/jiwan.db"), path.join(outDir, "jiwan.sql"), "jiwan.db（已清会话的调试库）");
dumpFile(path.join(root, "server/data/seed.db"), path.join(outDir, "seed.sql"), "seed.db（干净演示基线）");
