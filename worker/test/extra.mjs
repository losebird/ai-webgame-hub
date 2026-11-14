/* 本轮新增：伪造 Origin、Cookie HttpOnly、CSRF。另含 jiwan.db 数据关系检查（需 JIWAN_TEST_MODE=jiwan）。 */
import assert from 'node:assert';
import { check, createClient, openQuery, summarize } from './lib.mjs';

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
      body: JSON.stringify({ name: '林澄', pass: 'jiwan' })
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
      body: JSON.stringify({ name: '林澄', pass: 'jiwan' })
    });
    const data = await res.json().catch(() => ({}));
    assert.equal(res.status, 403);
    assert.equal(data.message, 'csrf');
  });

  await check('会话 Cookie 含 HttpOnly，CSRF Cookie 不含', async () => {
    const r = await ok('POST', '/auth/login', { name: '林澄', pass: 'jiwan' });
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
  } finally {
    db.close();
  }
}

async function main() {
  const base = process.env.JIWAN_TEST_BASE;
  if (!base) throw new Error('JIWAN_TEST_BASE missing');
  if (process.env.JIWAN_TEST_MODE === 'jiwan') {
    await jiwanDataTests(base, process.env.JIWAN_PERSIST);
  }
  await securityTests(base);
  const summary = summarize();
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
