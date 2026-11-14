#!/usr/bin/env node
/* 本地 D1：执行 migrations 并导入 jiwan.sql 或 seed.sql。不需要 Cloudflare 账号。
   用法：
     node scripts/import-local-d1.mjs              # 默认导入 jiwan
     node scripts/import-local-d1.mjs seed
     node scripts/import-local-d1.mjs jiwan --persist-to /tmp/jiwan-d1
*/
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((a) => a !== "--");
let persist = "";
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--persist-to") { persist = args[++i] || ""; continue; }
  rest.push(args[i]);
}
const which = (rest[0] || "jiwan").replace(/^\-\-/, "");
if (!["jiwan", "seed"].includes(which)) {
  console.error("unknown snapshot:", which, "（用 jiwan 或 seed）");
  process.exit(1);
}

const sqlFile = path.join(root, "data/sql", which + ".sql");
if (!fs.existsSync(sqlFile)) {
  console.log("SQL 快照不存在，先导出…");
  const dump = spawnSync(process.execPath, [path.join(root, "scripts/dump-sql.mjs")], { stdio: "inherit", cwd: root });
  if (dump.status) process.exit(dump.status || 1);
}
if (!fs.existsSync(sqlFile)) {
  console.error("missing", sqlFile);
  process.exit(1);
}

function wrangler(argv) {
  const cmd = ["wrangler", ...argv];
  if (persist) cmd.push("--persist-to", persist);
  console.log("+ npx", cmd.join(" "));
  const r = spawnSync("npx", cmd, { stdio: "inherit", cwd: root, env: process.env });
  if (r.status) process.exit(r.status);
}

wrangler(["d1", "migrations", "apply", "jiwan", "--local"]);
wrangler(["d1", "execute", "jiwan", "--local", "--file", sqlFile, "--yes"]);
console.log("imported", which, persist ? ("persist-to " + persist) : "(default .wrangler)");
