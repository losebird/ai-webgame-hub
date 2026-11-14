#!/usr/bin/env node
/* 巡检每款游戏的 src：HTTP 状态、X-Frame-Options、CSP frame-ancestors，判断 embed 应该是几。
   用法：
     node scripts/check-src.mjs                       # 读 server/data/jiwan.db
     node scripts/check-src.mjs --base https://jiwan.space   # 读线上 /games/index
   站内相对地址（如 /vendor/2048/）视为同源可嵌。页面里若有指向别的域名的 location 跳转或
   meta refresh（2048 的 gh-pages 就会跳 play2048.co），会追到跳转目标再判一次。
   只读，不改库。输出不一致的条目；有不一致时退出码 1，方便放进部署前检查。 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : '';
const SITE = 'jiwan.space';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function loadGames() {
  if (base) {
    const r = await fetch(new URL('/games/index', base));
    return (await r.json()).items.map(g => ({ id: g.id, src: g.src || g.playUrl || '', embed: g.embed !== false }));
  }
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(root, 'server/data/jiwan.db'), { readOnly: true });
  const rows = db.prepare('SELECT id, src, embed FROM games ORDER BY ord, id').all();
  const packs = db.prepare("SELECT id, playUrl FROM packs WHERE status = 'listed'").all();
  db.close();
  const games = rows.map(r => ({ id: r.id, src: r.src || '', embed: r.embed !== 0 }));
  for (const p of packs) if (!games.some(g => g.id === p.id)) games.push({ id: p.id, src: p.playUrl || '', embed: true });
  return games;
}

/* frame-ancestors 是否放行 SITE：'none' 拒绝；'self' 只放同源；* 放行；host 通配逐个比 */
function ancestorsAllow(value) {
  const list = value.trim().split(/\s+/).slice(1);
  if (!list.length) return true;
  return list.some(s => {
    if (s === '*' || s === 'https:') return true;
    const h = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^'|'$/g, '');
    if (h === 'none' || h === 'self') return false;
    if (h.startsWith('*.')) return SITE.endsWith(h.slice(1));
    return h === SITE;
  });
}

/* 页面脚本 / meta refresh 里跳去的别域地址（iframe 里也会照跳，所以要按目标判） */
function softRedirect(raw, from) {
  const html = raw.replace(/<!--[\s\S]*?-->/g, '');
  const m = html.match(/location(?:\.href\s*=|\.replace\(|\.assign\(|\s*=)\s*["'](https?:\/\/[^"']+)["']/i)
    || html.match(/http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i);
  if (!m) return '';
  try {
    const to = new URL(m[1], from);
    return to.host !== new URL(from).host ? to.href : '';
  } catch (e) { return ''; }
}

async function probe(src, hops = 0) {
  if (src.startsWith('/')) return { status: 0, embeddable: true, why: 'same-origin (self-hosted)' };
  if (/^http:/i.test(src)) return { status: 0, embeddable: false, why: 'http only (mixed content)' };
  try {
    const r = await fetch(src, { redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
    if (/^http:/i.test(r.url)) return { status: r.status, embeddable: false, why: 'redirects to http' };
    const xfo = (r.headers.get('x-frame-options') || '').toLowerCase();
    const fa = (r.headers.get('content-security-policy') || '').split(';').map(s => s.trim()).find(s => /^frame-ancestors\b/i.test(s));
    if (r.status >= 400) return { status: r.status, embeddable: null, why: 'http ' + r.status };
    if (fa) return { status: r.status, embeddable: ancestorsAllow(fa), why: fa };
    if (xfo === 'deny' || xfo === 'sameorigin') return { status: r.status, embeddable: false, why: 'x-frame-options ' + xfo };
    const to = hops < 2 && /html/i.test(r.headers.get('content-type') || '') ? softRedirect(await r.text(), r.url) : '';
    if (to) {
      const p = await probe(to, hops + 1);
      return { ...p, why: 'soft-redirects to ' + to + ' → ' + p.why };
    }
    return { status: r.status, embeddable: true, why: 'no frame restriction' };
  } catch (e) {
    return { status: 0, embeddable: null, why: 'fetch failed: ' + (e.cause?.code || e.message) };
  }
}

const games = (await loadGames()).filter(g => g.src);
let bad = 0;
for (const g of games) {
  const p = await probe(g.src);
  const ok = p.embeddable === null ? false : p.embeddable === g.embed;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FIX '} ${g.id.padEnd(22)} embed=${g.embed ? 1 : 0} probe=${p.embeddable === null ? '?' : (p.embeddable ? 1 : 0)} ${p.status} ${p.why}  ${g.src}`);
}
console.log(`\n${games.length} 条有 src，${bad} 条需要人工看（FIX）。`);
process.exit(bad ? 1 : 0);
