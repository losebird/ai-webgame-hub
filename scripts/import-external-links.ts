import path from "node:path";
import { openDb } from "../src/db.js";
import { importSeedFile } from "../src/links/import.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run import:links -- <file.json>");
  process.exit(2);
}

const dataDir = process.env.DATA_DIR ?? "data";
const db = openDb(path.join(dataDir, "hub.sqlite"));
const result = importSeedFile(db, file);
db.close();

for (const row of result.rejected) {
  const title = row.title || "(no title)";
  console.error(`rejected ${row.placement}[${row.index}] ${title}: ${row.reason}`);
}
if (result.documentError) {
  console.error(result.documentError);
  process.exit(1);
}
console.log(`imported ${result.imported} (homepage ${result.homepage}, hidden ${result.hidden})`);
if (result.rejected.length) process.exit(1);
