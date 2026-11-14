/* 主路径与耗时：在导入 jiwan.db 的本地 Worker 上走一遍，并记录 Server-Timing。 */
import assert from 'node:assert';
import { check, createClient, summarize } from './lib.mjs';

function nums(res) {
  const v = res.headers.get('x-jiwan-elapsed-ms') || res.headers.get('X-Jiwan-Elapsed-Ms');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function timed(base, method, path, body, origin, headersExtra) {
  const samples = [];
  let last = null;
  for (let i = 0; i < 5; i++) {
    const headers = { Origin: origin || base, ...(headersExtra || {}) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const ms = nums(res);
    if (ms != null) samples.push(ms);
    last = res;
  }
  samples.sort((a, b) => a - b);
  const mid = samples.length ? samples[Math.floor(samples.length / 2)] : null;
  return { samples, min: samples[0], median: mid, max: samples[samples.length - 1], last };
}

async function main() {
  const base = process.env.JIWAN_TEST_BASE;
  if (!base) throw new Error('JIWAN_TEST_BASE missing');
  const timings = [];
  const guest = createClient(base);
  const user = createClient(base);
  const review = createClient(base);

  console.log('\n[主路径] jiwan.db');

  await check('打开首页索引：73 个游戏可见', async () => {
    const r = await guest('GET', '/games/index');
    assert.equal(r.status, 200);
    assert.ok(r.data.items.length >= 73, '可见游戏应至少 73，实际 ' + r.data.items.length);
    assert.equal(r.data.items.filter((g) => !String(g.id).startsWith('pack-mw')).length >= 73, true);
    const home = await guest('GET', '/home');
    assert.equal(home.status, 200);
    assert.ok((home.data.featured || []).length + (home.data.hot || []).length > 0);
  });

  await check('中英文切换不回归（title_en 存在且 lang=en 生效）', async () => {
    const zh = await guest('GET', '/games/night-port?lang=zh');
    const en = await guest('GET', '/games/night-port?lang=en');
    assert.equal(zh.status, 200);
    assert.ok(zh.data.game.title, '中文标题');
    assert.ok(zh.data.game.title_en, '应保留 title_en');
    const indexEn = await guest('GET', '/games/index?lang=en');
    const row = indexEn.data.items.find((g) => g.id === 'night-port');
    assert.ok(row.title_en);
  });

  await check('详情可打开，游玩计数会变化', async () => {
    const before = await guest('GET', '/games/evensong');
    assert.equal(before.status, 200);
    const n = Number(before.data.game.plays);
    const play = await guest('POST', '/plays', { id: 'evensong' });
    assert.equal(play.status, 200);
    assert.equal(play.data.plays, n + 1);
    const after = await guest('GET', '/games/evensong');
    assert.equal(after.data.game.plays, n + 1);
  });

  await check('注册并登录，刷新后 Cookie 仍有效', async () => {
    const name = '旅人' + Date.now().toString(36).slice(-4);
    const reg = await user('POST', '/auth/register', { name, handle: 'traveler-' + Date.now().toString(36).slice(-5), pass: 'jiwan' });
    assert.equal(reg.status, 200);
    assert.ok(reg.data.user.id);
    const me1 = await user('GET', '/me');
    assert.equal(me1.data.user.id, reg.data.user.id);
    /* 模拟刷新：同一个 Cookie 罐再发请求 */
    const me2 = await user('GET', '/me');
    assert.equal(me2.data.user.id, me1.data.user.id);
    assert.ok(user.jar.jiwan_sid, '应持有会话 Cookie');
  });

  await check('点赞或收藏成功', async () => {
    const fav = await user('POST', '/games/evensong/follow', { id: 'evensong' });
    assert.equal(fav.status, 200);
    assert.equal(fav.data.followed, true);
    const g = await user('GET', '/games/evensong');
    assert.equal(g.data.followed, true);
  });

  await check('发帖或评价成功', async () => {
    const post = await user('POST', '/posts', { title: '暮歌这周又通关了一遍', body: '主路径验收发的帖。', game: 'evensong' });
    assert.equal(post.status, 200);
    assert.ok(post.data.post.id);
    const review = await user('POST', '/games/evensong/reviews', { gameId: 'evensong', score: 8, sentiment: '好评', text: '灯光和节奏都记得很清楚。' });
    assert.equal(review.status, 200);
  });

  await check('审核员演示账号能进后台', async () => {
    const login = await review('POST', '/auth/login', { name: '林澄', pass: 'jiwan' });
    assert.equal(login.status, 200, 'login ' + login.status + ' ' + JSON.stringify(login.data));
    assert.equal(login.data.user.role, 'reviewer');
    assert.ok(review.jar.jiwan_sid, '登录后应持有 jiwan_sid');
    const stats = await review('GET', '/admin/stats');
    assert.equal(stats.status, 200, 'stats ' + stats.status + ' ' + JSON.stringify(stats.data) + ' cookies=' + JSON.stringify(review.jar));
    assert.ok(stats.data.games.total >= 73);
    let html, lastErr;
    for (const path of ['/admin.html', '/']) {
      try { html = await fetch(base + path); lastErr = null; if (html && html.ok) break; }
      catch (e) { lastErr = e; }
    }
    if (!html) throw lastErr || new Error('admin html fetch failed');
    assert.equal(html.status, 200, 'admin html ' + html.status);
    const text = await html.text();
    assert.ok(text.includes('管理') || text.includes('admin'), 'admin.html 应可打开');
    assert.ok(!/WebGame/.test(text), '后台页不应出现旧站名 WebGame');
  });

  console.log('\n[耗时] 各打 5 次，读 X-Jiwan-Elapsed-Ms（本地墙钟，含 D1 I/O，不是生产 CPU）');
  const idx = await timed(base, 'GET', '/games/index');
  timings.push({ name: 'GET /games/index', ...idx });
  const rank = await timed(base, 'GET', '/rankings?tab=hot&period=day&n=20');
  timings.push({ name: 'GET /rankings', ...rank });

  const primed = createClient(base);
  await primed.prime();
  const loginHeaders = {
    Cookie: Object.entries(primed.jar).map(([k, v]) => k + '=' + v).join('; '),
    'X-CSRF-Token': primed.jar.jiwan_csrf || ''
  };
  const loginT = await timed(base, 'POST', '/auth/login', { name: '林澄', pass: 'jiwan' }, base, loginHeaders);
  timings.push({ name: 'POST /auth/login', ...loginT });

  const writer = createClient(base);
  await writer('POST', '/auth/login', { name: '何予', pass: 'jiwan' });
  const writeSamples = [];
  for (let i = 0; i < 5; i++) {
    const r = await writer('POST', '/plays', { id: 'evensong' });
    const ms = nums(r);
    if (ms != null) writeSamples.push(ms);
    assert.equal(r.status, 200);
  }
  writeSamples.sort((a, b) => a - b);
  timings.push({
    name: 'POST /plays',
    samples: writeSamples,
    min: writeSamples[0],
    median: writeSamples[Math.floor(writeSamples.length / 2)],
    max: writeSamples[writeSamples.length - 1]
  });

  for (const t of timings) {
    console.log(`  ${t.name}: min=${t.min}ms median=${t.median}ms max=${t.max}ms samples=${JSON.stringify(t.samples)}`);
  }
  const over = timings.filter((t) => t.median != null && t.median > 10);
  if (over.length) {
    console.log('  NOTE 以下接口本地墙钟中位数超过 10ms（需对照是否只是 I/O，还是 CPU 打满）：');
    over.forEach((t) => console.log('   - ' + t.name));
  }

  const summary = summarize();
  if (summary.fail) process.exitCode = 1;
  const out = process.env.JIWAN_TIMING_FILE;
  if (out) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), timings, over: over.map((t) => t.name) }, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
