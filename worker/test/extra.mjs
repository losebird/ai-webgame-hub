/* 本轮新增：伪造 Origin、Cookie HttpOnly、CSRF。另含 jiwan.db 数据关系检查（需 JIWAN_TEST_MODE=jiwan）。 */
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { verifyPass } from '../../src/util.js';
import { check, createClient, openQuery, summarize, TEST_PASS, TEST_PASS_NEXT, TEST_PASS_RESET } from './lib.mjs';

async function securityTests(base) {
  console.log('\n[安全] Origin / CSRF / HttpOnly');
  const ok = createClient(base);

  await check('伪造 Origin 的写操作被拒', async () => {
    const primed = createClient(base);
    await primed.prime();
    const headers = {
      Origin: 'https://evil.example',
      'Content-Type': 'application/json',
      'X-CSRF-Token': primed.jar.jiwan_csrf || '',
      Cookie: Object.entries(primed.jar).map(([k, v]) => k + '=' + v).join('; ')
    };
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: '林澄', pass: TEST_PASS })
    });
    const data = await res.json().catch(() => ({}));
    assert.equal(res.status, 403);
    assert.equal(data.message, 'origin');
  });

  await check('缺 CSRF 的写操作被拒', async () => {
    const primed = createClient(base);
    await primed.prime();
    const headers = {
      Origin: base,
      'Content-Type': 'application/json',
      Cookie: Object.entries(primed.jar).map(([k, v]) => k + '=' + v).join('; ')
    };
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: '林澄', pass: TEST_PASS })
    });
    const data = await res.json().catch(() => ({}));
    assert.equal(res.status, 403);
    assert.equal(data.message, 'csrf');
  });

  await check('会话 Cookie 含 HttpOnly，CSRF Cookie 不含', async () => {
    const r = await ok('POST', '/auth/login', { name: '林澄', pass: TEST_PASS });
    assert.equal(r.status, 200);
    const raw = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    const sid = raw.find((c) => c.startsWith('jiwan_sid='));
    assert.ok(sid, '应下发 jiwan_sid');
    assert.ok(/HttpOnly/i.test(sid), 'jiwan_sid 必须 HttpOnly：' + sid);
    assert.ok(/SameSite=Lax/i.test(sid), 'jiwan_sid 必须 SameSite=Lax');
    const https = base.startsWith('https:');
    if (https) assert.ok(/Secure/i.test(sid), 'HTTPS 下必须带 Secure');
    else assert.ok(!/Secure/i.test(sid), 'HTTP 本地开发不应带 Secure，否则 Cookie 发不出去');
    const csrf = raw.find((c) => c.startsWith('jiwan_csrf=')) || '';
    if (csrf) assert.ok(!/HttpOnly/i.test(csrf), 'CSRF Cookie 需要给 JS 读，不能 HttpOnly');
  });

  await check('HTML 注入空的 JIWAN_API_BASE', async () => {
    let res, err;
    for (const path of ['/', '/index.html', '/login.html']) {
      try {
        res = await fetch(base + path, { redirect: 'follow' });
        err = null;
        if (res.ok) break;
      } catch (e) { err = e; }
    }
    if (!res) throw err || new Error('html fetch failed');
    assert.equal(res.status, 200, 'html status ' + res.status);
    const html = await res.text();
    assert.ok(html.includes("window.JIWAN_API_BASE=window.JIWAN_API_BASE||''"), '页面应注入空 BASE，收到: ' + html.slice(0, 200));
    assert.ok(!/127\.0\.0\.1:8787/.test(html), '不应写死本机 API 端口');
  });

  await check('无验证的 /auth/reset 被拒绝', async () => {
    const r = await ok('POST', '/auth/reset', { name: '林澄', pass: TEST_PASS_NEXT });
    assert.equal(r.status, 403);
    assert.equal(r.data.code, 'forbidden');
    assert.equal(r.data.message, 'reset_disabled');
  });

  await check('旧口令 jiwan 不能登录 admin 或林澄', async () => {
    for (const name of ['admin', '林澄']) {
      const c = createClient(base);
      const r = await c('POST', '/auth/login', { name, pass: 'jiwan' });
      assert.equal(r.status, 401, name);
      assert.equal(r.data.code, 'bad_credentials', name);
    }
  });

  await check('伪造官方域名后缀的 Origin 被拒', async () => {
    const primed = createClient(base);
    await primed.prime();
    const headers = {
      Origin: 'https://jiwan.space.evil.example',
      'Content-Type': 'application/json',
      'X-CSRF-Token': primed.jar.jiwan_csrf || '',
      Cookie: Object.entries(primed.jar).map(([k, v]) => k + '=' + v).join('; ')
    };
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: '林澄', pass: TEST_PASS })
    });
    const data = await res.json().catch(() => ({}));
    assert.equal(res.status, 403);
    assert.equal(data.message, 'origin');
  });
}

async function jiwanDataTests(base, persist) {
  console.log('\n[数据] jiwan.db 导入后的差异关系');
  const db = openQuery(persist);
  const anon = createClient(base);
  try {
    await check('目录 73 部，已上架工坊包并入可见列表', async () => {
      const r = await anon('GET', '/games/index');
      assert.equal(r.status, 200);
      assert.equal(db.get('SELECT COUNT(*) AS n FROM games').n, 73);
      assert.ok(r.data.total >= 73, '可见数应至少覆盖 73 部目录');
      assert.ok(r.data.items.some((g) => g.id === 'pack-seed-tide'), '应包含已过审的潮汐回廊');
      assert.ok(r.data.items.some((g) => g.id === 'pack-mwfbgncbfpoc'), '应包含灯塔守夜人');
    });
    await check('潮汐回廊与灯塔守夜人已过审上架', async () => {
      const tide = db.get("SELECT id, status FROM packs WHERE id = 'pack-seed-tide'");
      const light = db.get("SELECT id, status, title FROM packs WHERE id = 'pack-mwfbgncbfpoc'");
      assert.equal(tide.status, 'listed');
      assert.equal(light.status, 'listed');
      assert.equal(light.title, '灯塔守夜人');
      const gs = await anon('GET', '/games?source=workshop&pageSize=200');
      assert.ok(gs.data.items.some((g) => g.id === 'pack-seed-tide'));
      assert.ok(gs.data.items.some((g) => g.id === 'pack-mwfbgncbfpoc' || g.title.includes('灯塔')));
    });
    await check('试玩次数与源库一致（evensong=11，13 条 plays）', async () => {
      assert.equal(db.get('SELECT COUNT(*) AS n FROM plays').n, 13);
      assert.equal(db.get("SELECT n FROM plays WHERE gameId = 'evensong'").n, 11);
      const g = await anon('GET', '/games/evensong');
      assert.equal(g.data.game.plays, 11);
    });
    await check('匿名 /games/index 与 /home 可短缓存，带会话的 /home 不缓存', async () => {
      const idx = await anon('GET', '/games/index');
      const home = await anon('GET', '/home');
      const re = /public/i;
      assert.match(idx.headers.get('cache-control') || '', re);
      assert.match(idx.headers.get('cache-control') || '', /s-maxage=120/);
      assert.match(home.headers.get('cache-control') || '', re);
      const user = createClient(base);
      const login = await user('POST', '/auth/login', { name: '林澄', pass: TEST_PASS });
      assert.equal(login.status, 200);
      const mine = await user('GET', '/home');
      assert.equal(mine.status, 200);
      assert.match(mine.headers.get('cache-control') || '', /no-store/);
      const font = await fetch(base + '/assets/fonts/NotoSerifSC-500.woff2');
      assert.equal(font.status, 200);
      assert.match(font.headers.get('cache-control') || '', /max-age=604800/);
      const css = await fetch(base + '/assets/jiwan-press.css');
      assert.equal(css.status, 200);
      assert.match(css.headers.get('cache-control') || '', /max-age=86400/);
      const page = await fetch(base + '/index.html');
      assert.equal(page.status, 200);
      const pageCc = page.headers.get('cache-control') || '';
      assert.match(pageCc, /private/i);
      assert.match(pageCc, /no-cache/i);
      assert.equal(/no-store/i.test(pageCc), false, 'HTML 用 no-store 会禁止 bfcache');
      const html = await page.text();
      assert.equal(html.includes('fonts.googleapis.com') || html.includes('fonts.gstatic.com'), false);
      assert.ok(html.includes('assets/fonts/fonts.css'));
      const cookieOf = (res) => {
        const h = res.headers;
        const list = h.getSetCookie ? h.getSetCookie() : (h.get('set-cookie') ? [h.get('set-cookie')] : []);
        return list.join(';');
      };
      for (const path of [
        '/assets/posters/icons/2048.webp',
        '/assets/posters/thumbs/2048.webp',
        '/assets/posters/detail/2048.webp',
        '/assets/fonts/NotoSerifSC-500.woff2',
        '/assets/jiwan-catalog.js'
      ]) {
        const r = await fetch(base + path);
        assert.equal(r.status, 200, path);
        assert.equal(cookieOf(r), '', path + ' 不得 Set-Cookie');
      }
      assert.match((await fetch(base + '/assets/posters/thumbs/2048.webp')).headers.get('content-type') || '', /webp/i);
    });
  } finally {
    db.close();
  }
}

async function productionHashTests() {
  console.log('\n[密码] 未注入测试口令的生产库');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  await check('生产库 admin/林澄 为 PBKDF2 且旧口令 jiwan 不能通过', async () => {
    for (const rel of ['server/data/jiwan.db', 'server/data/seed.db']) {
      const db = new DatabaseSync(path.join(root, rel), { readOnly: true });
      try {
        for (const id of ['admin', 'lincheng']) {
          const row = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(id);
          assert.ok(row && row.pass_hash, rel + ' ' + id);
          assert.ok(String(row.pass_hash).startsWith('pbkdf2$sha256$'), rel + ' ' + id + ' 应为 PBKDF2');
          assert.equal(await verifyPass('jiwan', row.pass_hash), false, rel + ' ' + id + ' 旧口令不应通过');
        }
      } finally { db.close(); }
    }
    const { hashPass: hashCjs, verifyPass: verifyCjs } = createRequire(import.meta.url)('../../server/db.js');
    const salt = Buffer.from('11'.repeat(16), 'hex');
    const { hashPass } = await import('../../src/util.js');
    const a = await hashPass('secret-word', { iters: 1000, salt: new Uint8Array(salt) });
    const b = hashCjs('secret-word', { iters: 1000, salt });
    assert.equal(a, b, 'Workers 与 Node 对照版哈希必须一致');
    assert.equal(verifyCjs('secret-word', a), true);
  });
}

async function main() {
  const base = process.env.JIWAN_TEST_BASE;
  if (!base) throw new Error('JIWAN_TEST_BASE missing');
  await productionHashTests();
  if (process.env.JIWAN_TEST_MODE === 'jiwan') {
    await jiwanDataTests(base, process.env.JIWAN_PERSIST);
  }
  await securityTests(base);
  const summary = summarize();
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
