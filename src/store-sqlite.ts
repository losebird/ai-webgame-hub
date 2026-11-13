import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "./schema.js";
import type { Database, SqlValue, Statement } from "./store.js";

export function openSqlite(file: string): Database {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  return wrapSqlite(db);
}

function wrapSqlite(db: DatabaseSync): Database {
  return {
    async exec(sql: string) {
      db.exec(sql);
    },
    prepare(sql: string): Statement {
      const stmt = db.prepare(sql);
      return {
        async run(...args: SqlValue[]) {
          const result = stmt.run(...args);
          return { changes: Number(result.changes ?? 0) };
        },
        async get<T = Record<string, unknown>>(...args: SqlValue[]) {
          return stmt.get(...args) as T | undefined;
        },
        async all<T = Record<string, unknown>>(...args: SqlValue[]) {
          return stmt.all(...args) as T[];
        },
      };
    },
    async batch(ops) {
      db.exec("BEGIN");
      try {
        for (const op of ops) db.prepare(op.sql).run(...op.args);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    close() {
      db.close();
    },
  };
}
