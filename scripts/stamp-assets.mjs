// 给 HTML 里引用的本站 js/css 打内容版本号（?v=<hash>），避免浏览器拿旧 js 配新 HTML。
// 部署前跑：npm run stamp
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
const root = new URL("../public/", import.meta.url).pathname;
const re = /((?:src|href)=")(assets\/[A-Za-z0-9_./-]+\.(?:js|css))(?:\?v=[a-f0-9]+)?(")/g;
const cache = new Map();
const ver = (p) => {
  if (!cache.has(p)) cache.set(p, createHash("sha256").update(readFileSync(join(root, p))).digest("hex").slice(0, 10));
  return cache.get(p);
};
let n = 0;
for (const f of readdirSync(root).filter((x) => x.endsWith(".html"))) {
  const file = join(root, f);
  const src = readFileSync(file, "utf8");
  const out = src.replace(re, (_, a, p, b) => `${a}${p}?v=${ver(p)}${b}`);
  if (out !== src) { writeFileSync(file, out); n++; }
}
console.log(`stamped ${n} html files`);
