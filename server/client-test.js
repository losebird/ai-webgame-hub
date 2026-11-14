'use strict';
/* 客户端回写验收：在 vm 里按浏览器的方式跑 assets/jiwan-catalog.js + assets/jiwan-api.js，
   共享同一份 localStorage，验证「登录后导航不再当游客」「启动时用 GET /me 校正角色」。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert');
const os = require('node:os');
const { openDb, SEED_DB } = require('./db');
const { createApp } = require('./index');

const API_PATH = path.join(__dirname, '..', 'assets', 'jiwan-api.js');
const catCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'jiwan-catalog.js'), 'utf8');
const apiCode = fs.readFileSync(API_PATH, 'utf8');

function makePage(base, store, jar) {
  const noop = () => {};
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    URLSearchParams, URL, TextEncoder, TextDecoder,
    document: {
      documentElement: {}, addEventListener: noop, removeEventListener: noop,
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ style: {}, addEventListener: noop })
    },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); }
    },
    location: { href: base + '/index.html', search: '', hash: '', pathname: '/index.html', origin: base },
    navigator: { language: 'zh-CN', languages: ['zh-CN'] },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    fetch: async (url, opts) => {
      const o = Object.assign({}, opts || {});
      o.headers = Object.assign({}, o.headers || {});
      if (jar.cookie) o.headers.cookie = jar.cookie;
      const res = await fetch(url, o);
      const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      list.forEach(c => {
        const kv = c.split(';')[0];
        if (kv.startsWith('jiwan_sid=')) jar.cookie = kv.split('=')[1] ? kv : '';
      });
      return res;
    }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(catCode, sandbox, { filename: 'jiwan-catalog.js' });
  const boot = () => vm.runInContext(apiCode, sandbox, { filename: 'jiwan-api.js' });
  boot();
  return { sandbox, J: sandbox.JIWAN, boot };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0;
const fails = [];
async function check(name, fn) {
  try { await fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fails.push(name); console.log('  FAIL ' + name + ' :: ' + e.message); }
}

async function main() {
  const tmp = path.join(os.tmpdir(), 'jiwan-client-' + Date.now() + '.db');
  const src = openDb(SEED_DB);
  src.exec(`VACUUM INTO '${tmp}'`);
  src.close();
  const db = openDb(tmp);
  const app = createApp({ db });
  const server = app.server.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const store = new Map();
  const jar = { cookie: '' };
  store.set('jiwan-api-base', base);

  console.log('\n[客户端] 会话回写');
  const page1 = makePage(base, store, jar);
  assert.equal(page1.J.api.base, base, '客户端应读到 BASE');

  await check('未登录时 meSync() 为 null', () => assert.equal(page1.J.api.meSync(), null));

  await check('login 成功后把 user 写进 jiwan-session', async () => {
    const r = await page1.J.api.login({ name: '林澄', pass: 'jiwan' });
    assert.equal(r.user.id, 'lincheng');
    const raw = store.get('jiwan-session');
    assert.ok(raw, 'jiwan-session 缺失 —— 这就是原来「登录后仍当游客」的缺口');
    const s = JSON.parse(raw);
    assert.equal(s.id, 'lincheng');
    assert.equal(s.role, 'reviewer');
    assert.deepEqual(Object.keys(s).sort(), ['avatar', 'bio', 'game', 'handle', 'id', 'name', 'role'], '形状应为 publicUser');
  });

  await check('同一浏览器里换页（新页面实例）导航立刻认得出人', async () => {
    const page2 = makePage(base, store, jar);
    const me = page2.J.api.meSync();
    assert.equal(me && me.id, 'lincheng');
  });

  await check('getNotifs 之后未读计数同步到本地', async () => {
    await page1.J.api.login({ name: '何予', pass: 'jiwan' });
    const data = await page1.J.api.getNotifs();
    const unread = (data.items || []).filter(n => !n.read).length;
    assert.equal(page1.J.api.unreadCount(), unread);
  });

  await check('likePost 之后本地点赞集合被镜像（心形不会掉）', async () => {
    const posts = await page1.J.api.getPosts({ pageSize: 20 });
    const target = (posts.items || []).find(p => p.user !== '何予');
    assert.ok(target, '需要一条别人的帖');
    const r = await page1.J.api.likePost(target.id);
    const set = page1.J.api.likes();
    assert.equal(set.has(target.id), r.liked);
  });

  await check('启动时用 GET /me 校正角色（本地角色被改坏也能修回）', async () => {
    await page1.J.api.login({ name: '林澄', pass: 'jiwan' });
    const stale = JSON.parse(store.get('jiwan-session'));
    stale.role = '';
    stale.id = 'lincheng';
    stale.name = '林澄';
    store.set('jiwan-session', JSON.stringify(stale));
    const page3 = makePage(base, store, jar);
    await wait(150);
    assert.equal(page3.J.api.meSync().role, 'reviewer', 'GET /me 未把角色校正回来');
  });

  await check('logout 清掉 jiwan-session', async () => {
    await page1.J.api.logout();
    assert.equal(store.has('jiwan-session'), false);
    assert.equal(page1.J.api.meSync(), null);
  });

  await check('本地残留的旧会话在无 Cookie 时被清掉', async () => {
    store.set('jiwan-session', JSON.stringify({ id: 'lincheng', name: '林澄', role: 'reviewer' }));
    const page4 = makePage(base, store, jar);
    await wait(150);
    assert.equal(page4.J.api.meSync(), null);
  });

  await check('客户端错误码透传（错密码 err.code=bad_credentials）', async () => {
    let code = '';
    try { await page1.J.api.login({ name: '林澄', pass: 'nope' }); }
    catch (e) { code = e.code; }
    assert.equal(code, 'bad_credentials');
  });

  await check('后端模式下 getGame / getHome 字段齐全（页面不空）', async () => {
    const home = await page1.J.api.getHome({ rank: 'hot', period: 'day' });
    ['featured', 'hot', 'neu', 'rank', 'workshop', 'kept', 'posts', 'resume'].forEach(k => assert.ok(k in home, k + ' 缺失'));
    const g = await page1.J.api.getGame('night-port');
    ['game', 'related', 'followed', 'playUrl', 'playable'].forEach(k => assert.ok(k in g, k + ' 缺失'));
  });

  await check('空 id 的详情请求在本地判 not_found（不打接口，不返回集合体）', async () => {
    for (const call of ['getPost', 'getGame', 'getUser']) {
      const err = await page1.J.api[call]('').then(() => null, e => e);
      assert.ok(err, call + ' 应当拒绝');
      assert.equal(err.code, 'not_found', call + ' 的错误码');
    }
  });

  server.close();
  db.close();
  console.log('\n' + (fails.length ? 'FAILED ' + fails.length + ' / ' + (pass + fails.length) : 'ALL PASS ' + pass));
  if (fails.length) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
