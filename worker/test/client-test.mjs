/* 客户端回写验收：在 vm 里跑 jiwan-catalog.js + jiwan-api.js，针对同源 Workers。
   不设置 JIWAN_API_BASE / localStorage jiwan-api-base，验证空 BASE 也能请求。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { check, summarize } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catCode = fs.readFileSync(path.join(root, 'assets/jiwan-catalog.js'), 'utf8');
const apiCode = fs.readFileSync(path.join(root, 'assets/jiwan-api.js'), 'utf8');

function parseSetCookie(list, jar) {
  for (const raw of list || []) {
    const kv = raw.split(';')[0];
    const i = kv.indexOf('=');
    if (i < 0) continue;
    const name = kv.slice(0, i).trim();
    const value = kv.slice(i + 1).trim();
    if (!value) delete jar[name];
    else jar[name] = value;
  }
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
}

function makePage(base, store, jar) {
  const noop = () => {};
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    URLSearchParams, URL, TextEncoder, TextDecoder,
    document: {
      documentElement: {}, addEventListener: noop, removeEventListener: noop,
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ style: {}, addEventListener: noop }),
      get cookie() { return cookieHeader(jar); },
      set cookie(v) {
        const kv = String(v).split(';')[0];
        const i = kv.indexOf('=');
        if (i < 0) return;
        const name = kv.slice(0, i).trim();
        const value = kv.slice(i + 1).trim();
        if (!value) delete jar[name];
        else jar[name] = value;
      }
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
      const abs = String(url).startsWith('http') ? url : base + url;
      const o = Object.assign({}, opts || {});
      o.headers = Object.assign({ Origin: base }, o.headers || {});
      if (!o.headers.Origin && !o.headers.origin) o.headers.Origin = base;
      const ch = cookieHeader(jar);
      if (ch) o.headers.cookie = ch;
      if (o.headers.Cookie && !o.headers.cookie) o.headers.cookie = o.headers.Cookie;
      const res = await fetch(abs, o);
      parseSetCookie(res.headers.getSetCookie ? res.headers.getSetCookie() : [], jar);
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

async function main() {
  const base = process.env.JIWAN_TEST_BASE;
  if (!base) throw new Error('JIWAN_TEST_BASE missing');

  const store = new Map();
  const jar = Object.create(null);

  console.log('\n[客户端] 同源、未配置 JIWAN_API_BASE');
  const page1 = makePage(base, store, jar);
  assert.equal(page1.J.api.base, '', '同源时 BASE 应为空字符串');

  await check('未登录时 meSync() 为 null', () => assert.equal(page1.J.api.meSync(), null));

  await check('未配置 JIWAN_API_BASE 也能请求 API', async () => {
    const home = await page1.J.api.getHome({ rank: 'hot', period: 'day' });
    assert.ok(Array.isArray(home.featured), 'getHome 应成功');
    assert.ok((home.hot || []).length + (home.featured || []).length > 0);
  });

  await check('login 成功后把 user 写进 jiwan-session', async () => {
    const r = await page1.J.api.login({ name: '林澄', pass: 'jiwan' });
    assert.equal(r.user.id, 'lincheng');
    const raw = store.get('jiwan-session');
    assert.ok(raw, 'jiwan-session 缺失');
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
    const emptyJar = Object.create(null);
    const page4 = makePage(base, store, emptyJar);
    await wait(200);
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

  const summary = summarize();
  if (summary.fail) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
