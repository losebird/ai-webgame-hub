/* 即玩 Workers 冒烟：语义对齐 server/smoke.js，跑在 wrangler dev --local 上（seed 快照）。 */
import assert from 'node:assert';
import { check, createClient, openQuery, summarize, TEST_PASS, TEST_PASS_NEXT, TEST_PASS_RESET } from './lib.mjs';

async function main() {
  const base = process.env.JIWAN_TEST_BASE;
  if (!base) throw new Error('JIWAN_TEST_BASE missing');
  const persist = process.env.JIWAN_PERSIST;
  const db = openQuery(persist);
  const anon = createClient(base);
  const lin = createClient(base);
  const he = createClient(base);
  const adm = createClient(base);

  console.log('\n[1] 协议与鉴权');
  await check('未知路由 404 + code=not_found', async () => {
    const r = await anon('GET', '/nope');
    assert.equal(r.status, 404); assert.equal(r.data.code, 'not_found');
  });
  await check('未登录 GET /notifs 401 auth', async () => {
    const r = await anon('GET', '/notifs');
    assert.equal(r.status, 401); assert.equal(r.data.code, 'auth');
  });
  await check('OPTIONS 预检带 credentials 与回显 Origin', async () => {
    const res = await fetch(base + '/home', {
      method: 'OPTIONS', headers: { Origin: base, 'Access-Control-Request-Method': 'GET' }
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), base);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });
  await check('错密码 401 bad_credentials', async () => {
    const r = await anon('POST', '/auth/login', { name: '林澄', pass: 'x' });
    assert.equal(r.status, 401); assert.equal(r.data.code, 'bad_credentials');
  });

  console.log('\n[2] 林澄（审核员）');
  await check('登录成功且 role=reviewer', async () => {
    const r = await lin('POST', '/auth/login', { name: '林澄', pass: TEST_PASS });
    assert.equal(r.status, 200); assert.equal(r.data.user.id, 'lincheng');
    assert.equal(r.data.user.role, 'reviewer');
  });
  await check('GET /me 走 Cookie 返回同一人', async () => {
    const r = await lin('GET', '/me');
    assert.equal(r.data.user.id, 'lincheng');
  });
  await check('能看举报表', async () => {
    const r = await lin('GET', '/reports');
    assert.equal(r.status, 200); assert.ok(Array.isArray(r.data.items));
  });
  await check('何予看举报表 403 forbidden', async () => {
    await he('POST', '/auth/login', { name: '何予', pass: TEST_PASS });
    const r = await he('GET', '/reports');
    assert.equal(r.status, 403); assert.equal(r.data.code, 'forbidden');
  });

  console.log('\n[3] 收藏 / 关注 / 通知分桶');
  await check('何予发布帖子', async () => {
    const r = await he('POST', '/posts', { title: '潮汐回廊的灯塔测试', body: '水位一变就跳。' });
    assert.equal(r.status, 200); assert.ok(r.data.post.id);
    global.heyuPost = r.data.post.id;
  });
  await check('林澄点赞何予的帖 → 只有何予未读 +1', async () => {
    const like = await lin('POST', '/posts/' + global.heyuPost + '/like', { id: global.heyuPost });
    assert.equal(like.data.liked, true);
    const hn = await he('GET', '/notifs');
    assert.equal(hn.data.items.length, 1);
    assert.equal(hn.data.items[0].type, 'like');
    assert.equal(hn.data.items[0].from, '林澄');
    const ln = await lin('GET', '/notifs');
    assert.equal(ln.data.items.filter(n => n.type === 'like').length, 0, '自己点赞不应产生通知');
  });
  await check('何予关注林澄 → 林澄收到 follow，何予自己无', async () => {
    const off = await he('POST', '/users/lincheng/follow', { id: 'lincheng' });
    assert.equal(off.data.followed, false, '种子关系里何予已关注林澄，第一次点击是取消');
    const r = await he('POST', '/users/lincheng/follow', { id: 'lincheng' });
    assert.equal(r.data.followed, true);
    const ln = await lin('GET', '/notifs');
    assert.ok(ln.data.items.some(n => n.type === 'follow' && n.from === '何予'));
    const hn = await he('GET', '/notifs');
    assert.ok(!hn.data.items.some(n => n.type === 'follow'));
  });
  await check('不能关注自己 422 invalid:self', async () => {
    const r = await lin('POST', '/users/lincheng/follow', { id: 'lincheng' });
    assert.equal(r.status, 422); assert.equal(r.data.message, 'self');
  });
  await check('收藏按账号分桶（何予收藏了 harbor，林澄没有）', async () => {
    const h = await he('GET', '/users/heyu');
    const l = await lin('GET', '/users/lincheng');
    assert.ok(h.data.favs.some(g => g.id === 'harbor'));
    assert.ok(l.data.favs.some(g => g.id === 'night-port'));
    assert.ok(!l.data.favs.some(g => g.id === 'harbor'));
  });
  await check('他人主页 favs 不返回（仅主人可见）', async () => {
    const r = await lin('GET', '/users/heyu');
    assert.equal(r.data.isMe, false);
    assert.deepEqual(r.data.favs, []);
  });
  await check('未读计数按人隔离（markNotifsRead 只清自己）', async () => {
    await he('POST', '/notifs/read');
    const hn = await he('GET', '/notifs');
    assert.equal(hn.data.items.filter(n => !n.read).length, 0);
    const ln = await lin('GET', '/notifs');
    assert.ok(ln.data.items.some(n => !n.read), '林澄的未读不该被何予清掉');
  });

  console.log('\n[4] 自己的内容：发 / 改 / 删');
  await check('何予改自己的帖', async () => {
    const r = await he('POST', '/posts/' + global.heyuPost, { id: global.heyuPost, title: '潮汐回廊：灯塔按潮位开关', body: '改过一次。' });
    assert.equal(r.status, 200); assert.equal(r.data.post.title, '潮汐回廊：灯塔按潮位开关');
  });
  await check('林澄改何予的帖 403 owner', async () => {
    const r = await lin('POST', '/posts/' + global.heyuPost, { id: global.heyuPost, title: '这不是你能改的标题' });
    assert.equal(r.status, 403); assert.equal(r.data.message, 'owner');
  });
  await check('标题 4–48 字校验 422 invalid:title', async () => {
    const r = await he('POST', '/posts', { title: '短' });
    assert.equal(r.status, 422); assert.equal(r.data.message, 'title');
  });
  await check('何予给自己帖评论并改删评论', async () => {
    const c = await he('POST', '/posts/' + global.heyuPost + '/comments', { postId: global.heyuPost, text: '自评一句。' });
    assert.equal(c.status, 200);
    const cid = c.data.comment.id;
    const u = await he('POST', '/comments/' + cid, { id: cid, text: '改过的评论。' });
    assert.equal(u.data.comment.text, '改过的评论。');
    const other = await lin('POST', '/comments/' + cid, { id: cid, text: '别人不能改。' });
    assert.equal(other.status, 404);
    const del = await he('POST', '/comments/' + cid + '/delete', { id: cid });
    assert.equal(del.status, 200);
  });
  await check('何予评价游戏 → 一人一评 → 删评', async () => {
    const r1 = await he('POST', '/games/night-port/reviews', { gameId: 'night-port', score: 8, sentiment: '好评', text: '灯一盏一盏关，节奏很稳。' });
    assert.equal(r1.status, 200);
    const r2 = await he('POST', '/games/night-port/reviews', { gameId: 'night-port', score: 9, sentiment: '好评', text: '再看一遍还是这句。' });
    assert.equal(r2.status, 200);
    const g = await he('GET', '/games/night-port');
    const mine = g.data.game.reviews.filter(r => r.userId === 'heyu');
    assert.equal(mine.length, 1, '一人一评');
    assert.equal(mine[0].score, 9);
    const d = await he('POST', '/games/night-port/reviews/delete', { gameId: 'night-port' });
    assert.equal(d.status, 200);
    const g2 = await he('GET', '/games/night-port');
    assert.equal(g2.data.game.reviews.filter(r => r.userId === 'heyu').length, 0);
  });
  await check('分数越界 / 评论过短 422', async () => {
    const a = await he('POST', '/games/night-port/reviews', { gameId: 'night-port', score: 11, sentiment: '好评', text: '长度够的评论' });
    assert.equal(a.status, 422); assert.equal(a.data.message, 'score');
    const b = await he('POST', '/games/night-port/reviews', { gameId: 'night-port', score: 7, sentiment: '好评', text: '短' });
    assert.equal(b.status, 422); assert.equal(b.data.message, 'text');
  });

  console.log('\n[5] 审核动作');
  await check('林澄藏帖 → 普通用户 404，作者仍可打开', async () => {
    const h = await lin('POST', '/posts/' + global.heyuPost + '/hide', { id: global.heyuPost });
    assert.equal(h.status, 200);
    const a = await anon('GET', '/posts/' + global.heyuPost);
    assert.equal(a.status, 404);
    const owner = await he('GET', '/posts/' + global.heyuPost);
    assert.equal(owner.status, 200); assert.equal(owner.data.hidden, true);
    const list = await anon('GET', '/posts');
    assert.ok(!list.data.items.some(p => String(p.id) === String(global.heyuPost)), '列表里不该出现已藏帖');
  });
  await check('藏帖通知写给帖主（何予收到 postHidden）', async () => {
    const hn = await he('GET', '/notifs');
    assert.ok(hn.data.items.some(n => n.type === 'postHidden'));
  });
  await check('何予藏帖 403', async () => {
    const r = await he('POST', '/posts/' + global.heyuPost + '/hide', { id: global.heyuPost });
    assert.equal(r.status, 403);
  });
  await check('林澄下架 bayhaven → 匿名 404，审核员 200', async () => {
    const t = await lin('POST', '/games/bayhaven/takedown', { id: 'bayhaven' });
    assert.equal(t.status, 200);
    const a = await anon('GET', '/games/bayhaven');
    assert.equal(a.status, 404);
    const l = await lin('GET', '/games/bayhaven');
    assert.equal(l.status, 200);
  });
  await check('下架后不在目录与排行里', async () => {
    const gs = await anon('GET', '/games?pageSize=200');
    assert.ok(!gs.data.items.some(g => g.id === 'bayhaven'));
  });
  await check('举报 → 审核员看到 title/gone → 标记已处理', async () => {
    const rep = await he('POST', '/reports', { kind: 'game', id: 'bayhaven', reason: '封面与内容不符' });
    assert.equal(rep.status, 200);
    const list = await lin('GET', '/reports');
    const row = list.data.items.find(r => r.target === 'bayhaven');
    assert.ok(row); assert.equal(row.gone, true);
    assert.ok(row.title);
    const d = await lin('POST', '/reports/' + row.id + '/dismiss', { id: row.id });
    assert.equal(d.status, 200);
    const after = await lin('GET', '/reports');
    assert.ok(!after.data.items.some(r => r.id === row.id));
  });
  await check('举报理由 <2 字 422', async () => {
    const r = await he('POST', '/reports', { kind: 'post', id: '1', reason: '差' });
    assert.equal(r.status, 422);
  });

  console.log('\n[6] 工坊审核');
  await check('何予队列 403；林澄队列含他的 pending 包', async () => {
    const h = await he('GET', '/workshop/queue');
    assert.equal(h.status, 403);
    const l = await lin('GET', '/workshop/queue');
    assert.ok(l.data.items.some(p => p.id === 'pack-seed-tide'));
  });
  await check('过审 → listed 且并入可发现列表 → 通知 packOn', async () => {
    const r = await lin('POST', '/workshop/packs/pack-seed-tide/review', { id: 'pack-seed-tide', status: 'listed' });
    assert.equal(r.status, 200); assert.equal(r.data.pack.status, 'listed');
    const gs = await anon('GET', '/games?pageSize=200');
    assert.ok(gs.data.items.some(g => g.id === 'pack-seed-tide'));
    const ws = await anon('GET', '/games?source=workshop&pageSize=200');
    assert.ok(ws.data.items.some(g => g.id === 'pack-seed-tide'));
    assert.ok(ws.data.items.every(g => g.packStatus === 'listed'), '工坊来源只能包含过审上架的用户作品');
    assert.ok(!ws.data.items.some(g => g.id === 'evensong'), '普通目录游戏不能混入工坊来源');
    const home = await anon('GET', '/home');
    assert.ok(home.data.workshop.every(g => g.packStatus === 'listed'), '首页工坊栏只能包含过审上架的用户作品');
    const hn = await he('GET', '/notifs');
    assert.ok(hn.data.items.some(n => n.type === 'packOn'));
  });
  await check('下架该工坊包 → 变 unlisted + 通知 gameDown', async () => {
    await lin('POST', '/games/pack-seed-tide/takedown', { id: 'pack-seed-tide' });
    const mine = await he('GET', '/workshop/mine');
    const p = mine.data.items.find(x => x.id === 'pack-seed-tide');
    assert.equal(p.status, 'unlisted');
    const hn = await he('GET', '/notifs');
    assert.ok(hn.data.items.some(n => n.type === 'gameDown'));
    assert.equal((await he('GET', '/games/pack-seed-tide')).status, 404, '普通用户应 404');
    assert.equal((await lin('GET', '/games/pack-seed-tide')).status, 200, '审核员仍能打开');
    const ws = await anon('GET', '/games?source=workshop&pageSize=200');
    assert.ok(!ws.data.items.some(g => g.id === 'pack-seed-tide'), '下架后立即离开工坊来源列表');
    const home = await anon('GET', '/home');
    assert.ok(!home.data.workshop.some(g => g.id === 'pack-seed-tide'), '下架后立即离开首页工坊栏');
  });
  await check('拒稿写原因 + packOff 通知', async () => {
    const sub = await he('POST', '/workshop/packs', { title: '雾港试作', blurb: '还没想好。', vis: 'public', cat: 'story' });
    assert.equal(sub.status, 200);
    const pid = sub.data.pack.id;
    const rv = await lin('POST', '/workshop/packs/' + pid + '/review', { id: pid, status: 'rejected', reason: '封面缺失' });
    assert.equal(rv.data.pack.status, 'rejected');
    assert.equal(rv.data.pack.reason, '封面缺失');
    const hn = await he('GET', '/notifs');
    assert.ok(hn.data.items.some(n => n.type === 'packOff' && n.title === '雾港试作'));
    global.rejPack = pid;
  });
  await check('审核员不能审自己的包 403 self', async () => {
    const own = await lin('POST', '/workshop/packs', { title: '林澄自己的包', vis: 'public' });
    const pid = own.data.pack.id;
    const q = await lin('GET', '/workshop/queue');
    assert.ok(!q.data.items.some(p => p.id === pid), '队列不含自己的包');
    const r = await lin('POST', '/workshop/packs/' + pid + '/review', { id: pid, status: 'listed' });
    assert.equal(r.status, 403);
  });
  await check('作者 resubmit 拒稿包 → 回到 pending', async () => {
    const r = await he('POST', '/workshop/packs/' + global.rejPack + '/resubmit', { id: global.rejPack });
    assert.equal(r.data.pack.status, 'pending');
  });
  await check('指派给工坊的目录游戏：工坊/首页可见、归属作者、数据保留', async () => {
    const ws = await anon('GET', '/games?source=workshop&pageSize=200');
    const hb = ws.data.items.find(g => g.id === 'harbor');
    assert.ok(hb, '港口调度应在工坊来源里');
    assert.equal(hb.packStatus, 'listed');
    assert.equal(hb.ownerId, 'heyu', '归属作者何予');
    assert.ok(hb.score >= 8, '指派后评分不丢');
    const home = await anon('GET', '/home');
    assert.ok(home.data.workshop.some(g => g.id === 'harbor'), '首页工坊栏应含指派游戏');
    assert.ok(home.data.workshop.length >= 4, '首页工坊栏应有足够内容');
    const mine = await he('GET', '/workshop/mine');
    assert.ok(mine.data.items.some(p => p.id === 'harbor'), '应出现在作者的我的投稿里');
  });
  await check('作者下架指派包 → 离开工坊但目录保留；重新过审后回来', async () => {
    const r = await he('POST', '/workshop/packs/harbor/unlist', { id: 'harbor' });
    assert.equal(r.data.pack.status, 'unlisted');
    const ws = await anon('GET', '/games?source=workshop&pageSize=200');
    assert.ok(!ws.data.items.some(g => g.id === 'harbor'), '下架后离开工坊来源');
    const home = await anon('GET', '/home');
    assert.ok(!home.data.workshop.some(g => g.id === 'harbor'), '下架后离开首页工坊栏');
    const d = await anon('GET', '/games/harbor');
    assert.equal(d.status, 200, '目录里仍应可打开（数据不丢）');
    assert.ok(!d.data.game.packStatus, 'packStatus 应同步清空');
    await he('POST', '/workshop/packs/harbor/resubmit', { id: 'harbor' });
    const q = await lin('GET', '/workshop/queue');
    assert.ok(q.data.items.some(p => p.id === 'harbor'), '重提交后进入审核队列');
    const rv = await lin('POST', '/workshop/packs/harbor/review', { id: 'harbor', status: 'listed' });
    assert.equal(rv.data.pack.status, 'listed');
    const ws2 = await anon('GET', '/games?source=workshop&pageSize=200');
    assert.ok(ws2.data.items.some(g => g.id === 'harbor' && g.packStatus === 'listed'), '重新过审后回到工坊');
  });

  console.log('\n[7] 接着玩 / 播放计数');
  await check('首页 resume 跟账号历史走', async () => {
    const topOf = uid => db.get('SELECT gameId FROM history WHERE userId = ? ORDER BY at DESC LIMIT 1', uid);
    const l = await lin('GET', '/home');
    const h = await he('GET', '/home');
    assert.equal(l.data.resume[0].id, topOf('lincheng').gameId, '林澄的接着玩应为他自己最近在玩');
    assert.equal(h.data.resume[0].id, topOf('heyu').gameId, '何予的接着玩应为他自己最近在玩');
    assert.notEqual(l.data.resume[0].id, h.data.resume[0].id, '两个账号的历史必须分桶');
  });
  await check('recordPlay 累加并写个人历史', async () => {
    const before = (await anon('GET', '/games/harbor')).data.game.plays;
    const r = await he('POST', '/plays', { id: 'harbor' });
    assert.equal(r.data.plays, before + 1);
    const hm = await he('GET', '/home');
    assert.equal(hm.data.resume[0].id, 'harbor');
  });
  await check('播放不存在的游戏 404', async () => {
    const r = await he('POST', '/plays', { id: 'nope-404' });
    assert.equal(r.status, 404);
  });
  await check('游客游玩记录登录后认领', async () => {
    const g = createClient(base);
    await g('POST', '/plays', { id: 'cookie-clicker' });
    await g('POST', '/auth/login', { name: 'kevinngo', pass: TEST_PASS });
    const h = await g('GET', '/home');
    assert.equal(h.data.resume[0].id, 'cookie-clicker');
  });

  console.log('\n[8] 搜索 / 排行 / 注册');
  await check('搜索返回 games/posts/users 与 suggest', async () => {
    const r = await anon('GET', '/search?q=' + encodeURIComponent('saltline'));
    assert.ok(r.data.games.length || r.data.posts.length);
    assert.equal(typeof r.data.gameTotal, 'number');
  });
  await check('排行 tab/period 生效', async () => {
    const a = await anon('GET', '/rankings?tab=score&period=month&n=5');
    assert.equal(a.data.items.length, 5);
    assert.equal(a.data.tab, 'score');
  });
  await check('注册 2–16 名、重复冲突、能登录', async () => {
    const bad = await anon('POST', '/auth/register', { name: 'A', handle: 'aa', pass: '1234' });
    assert.equal(bad.status, 422);
    const short = await anon('POST', '/auth/register', { name: '测试用户', handle: 'tester', pass: '1234' });
    assert.equal(short.status, 422);
    const ok = await anon('POST', '/auth/register', { name: '测试用户', handle: 'tester', pass: TEST_PASS });
    assert.equal(ok.status, 200); assert.equal(ok.data.user.id, 'tester');
    const dup = await anon('POST', '/auth/register', { name: '测试用户', handle: 'tester', pass: TEST_PASS });
    assert.equal(dup.status, 409);
    const c = createClient(base);
    const login = await c('POST', '/auth/login', { name: '测试用户', pass: TEST_PASS });
    assert.equal(login.status, 200);
  });
  await check('目录里出现过的作者都能用测试口令登录', async () => {
    const names = db.all("SELECT DISTINCT author FROM games WHERE author != ''").map(r => r.author);
    let bad = [];
    for (const name of names) {
      const c = createClient(base);
      const r = await c('POST', '/auth/login', { name, pass: TEST_PASS });
      if (r.status !== 200) bad.push(name);
    }
    assert.deepEqual(bad, [], '登录失败的作者: ' + bad.join(', '));
  });
  await check('改密码：旧密码错 401，改完新密码可登录', async () => {
    const c = createClient(base);
    await c('POST', '/auth/login', { name: '测试用户', pass: TEST_PASS });
    const bad = await c('POST', '/me/password', { oldPass: 'xxxx', pass: TEST_PASS_NEXT });
    assert.equal(bad.status, 401);
    const short = await c('POST', '/me/password', { oldPass: TEST_PASS, pass: '5678' });
    assert.equal(short.status, 422);
    const ok = await c('POST', '/me/password', { oldPass: TEST_PASS, pass: TEST_PASS_NEXT });
    assert.equal(ok.status, 200);
    const c2 = createClient(base);
    const login = await c2('POST', '/auth/login', { name: '测试用户', pass: TEST_PASS_NEXT });
    assert.equal(login.status, 200);
  });
  await check('logout 清 Cookie 后 /me 为 null', async () => {
    const c = createClient(base);
    await c('POST', '/auth/login', { name: '何予', pass: TEST_PASS });
    assert.equal((await c('GET', '/me')).data.user.id, 'heyu');
    await c('POST', '/logout');
    assert.equal((await c('GET', '/me')).data.user, null);
  });
  await check('feed=follow 只看关注的人（何予关注林澄后能看到林澄的帖）', async () => {
    const p = await lin('POST', '/posts', { title: '夜航港这周的小改动', body: '灯号重排。' });
    assert.equal(p.status, 200);
    const f = await he('GET', '/posts?feed=follow&pageSize=50');
    assert.ok(f.data.items.some(x => x.user === '林澄'));
    const all = await anon('GET', '/posts?pageSize=50');
    assert.ok(all.data.items.length >= f.data.items.length);
  });


  console.log('\n[9] 后台（admin）');
  await check('管理员账号能登录且 role=admin', async () => {
    const r = await adm('POST', '/auth/login', { name: 'admin', pass: TEST_PASS });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, 'admin');
    assert.equal(r.data.user.name, '站务');
  });
  await check('后台权限：匿名 401，普通用户 403，审核员能读统计读不到用户表', async () => {
    const a = await createClient(base)('GET', '/admin/stats');
    assert.equal(a.status, 401, '未登录应当是 401');
    const h = await he('GET', '/admin/stats');
    assert.equal(h.status, 403);
    const l = await lin('GET', '/admin/stats');
    assert.equal(l.status, 200, '审核员应当能进后台看统计');
    const lu = await lin('GET', '/admin/users');
    assert.equal(lu.status, 403, '用户管理只有 admin');
    const au = await adm('GET', '/admin/users');
    assert.equal(au.status, 200);
  });
  await check('统计与库对得上', async () => {
    const r = await adm('GET', '/admin/stats');
    const s = r.data;
    const base = db.get('SELECT COUNT(*) AS n FROM games').n;
    assert.ok(s.games.total >= base, '世界至少等于目录条数（已下架的工坊包仍留在世界里给审核员看）');
    assert.equal(s.posts.total, db.get('SELECT COUNT(*) AS n FROM posts WHERE deleted = 0').n);
    assert.equal(s.posts.hidden, db.get("SELECT COUNT(*) AS n FROM hidden WHERE kind = 'post'").n);
    assert.equal(s.users.admin, db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").n);
    assert.equal(s.users.disabled, db.get('SELECT COUNT(*) AS n FROM users WHERE disabled = 1').n);
    assert.equal(s.reviews.seed, db.get('SELECT COUNT(*) AS n FROM reviews WHERE seed = 1').n);
    assert.equal(s.reports.pending, db.get('SELECT COUNT(*) AS n FROM reports WHERE done = 0').n);
  });
  await check('举报闭环：管理员看到 → 隐帖 → 标处理 → 匿名 404 → 恢复', async () => {
    const fresh = await he('POST', '/posts', { title: '这条会被举报的测试帖', body: '仅用于后台闭环验收。' });
    assert.equal(fresh.status, 200);
    const target = fresh.data.post.id;
    const rep = await he('POST', '/reports', { kind: 'post', id: target, reason: '测试举报理由' });
    assert.equal(rep.status, 200);
    const list = await adm('GET', '/reports');
    const row = list.data.items.find(x => String(x.target) === String(target) && x.kind === 'post');
    assert.ok(row, '管理员应看到这条举报');
    assert.equal(row.gone, false);
    await adm('POST', '/posts/' + target + '/hide', { id: target });
    await adm('POST', '/reports/' + row.id + '/dismiss', {});
    const anonView = await createClient(base)('GET', '/posts/' + target);
    assert.equal(anonView.status, 404, '隐藏后游客打不开');
    const authorView = await he('GET', '/posts/' + target);
    assert.equal(authorView.status, 200, '作者仍能打开');
    const hidden = await adm('GET', '/admin/posts?hidden=1');
    assert.ok(hidden.data.items.some(x => String(x.id) === String(target)));
    const back = await adm('POST', '/admin/posts/' + target + '/restore', { id: target });
    assert.equal(back.data.hidden, false);
    const again = await createClient(base)('GET', '/posts/' + target);
    assert.equal(again.status, 200, '恢复后游客可读');
    const done = await adm('GET', '/reports?all=1');
    assert.ok(done.data.items.some(x => x.id === row.id && x.done));
  });
  await check('角色调整：升审核员 → 能进后台；降回 → 403', async () => {
    const up = await adm('POST', '/admin/users/heyu', { id: 'heyu', role: 'reviewer' });
    assert.equal(up.data.user.role, 'reviewer');
    const can = await he('GET', '/admin/stats');
    assert.equal(can.status, 200);
    const down = await adm('POST', '/admin/users/heyu', { id: 'heyu', role: '' });
    assert.equal(down.data.user.role, '');
    const no = await he('GET', '/admin/stats');
    assert.equal(no.status, 403);
  });
  await check('禁用：会话立刻失效、再登录被拒，解禁后恢复', async () => {
    const off = await adm('POST', '/admin/users/heyu', { id: 'heyu', disabled: true });
    assert.equal(off.data.disabled, true);
    const me = await he('GET', '/me');
    assert.equal(me.data.user, null, '被禁用的会话不再算登录');
    const login = await createClient(base)('POST', '/auth/login', { name: '何予', pass: TEST_PASS });
    assert.equal(login.status, 403);
    assert.equal(login.data.message, 'disabled');
    await adm('POST', '/admin/users/heyu', { id: 'heyu', disabled: false });
    const back = await he('POST', '/auth/login', { name: '何予', pass: TEST_PASS });
    assert.equal(back.status, 200);
  });
  await check('管理员不能改自己，也不能把最后一个管理员降级', async () => {
    const self = await adm('POST', '/admin/users/admin', { id: 'admin', role: 'reviewer' });
    assert.equal(self.status, 403);
    assert.equal(self.data.message, 'self');
    const selfOff = await adm('POST', '/admin/users/admin', { id: 'admin', disabled: true });
    assert.equal(selfOff.status, 403);
    /* 造第二个管理员并降掉自己以外的唯一 admin：先升 heyu，再降 admin 应被拒（仍剩他） */
    await adm('POST', '/admin/users/heyu', { id: 'heyu', role: 'admin' });
    const demote = await adm('POST', '/admin/users/admin', { id: 'admin', role: 'reviewer' });
    assert.equal(demote.status, 403, '不能动自己');
    await adm('POST', '/admin/users/heyu', { id: 'heyu', role: '' });
  });
  await check('管理员重置密码后新密码可用（再改回）', async () => {
    const r = await adm('POST', '/admin/users/heyu/password', { id: 'heyu', pass: TEST_PASS_RESET });
    assert.equal(r.status, 200);
    const ok = await createClient(base)('POST', '/auth/login', { name: '何予', pass: TEST_PASS_RESET });
    assert.equal(ok.status, 200);
    await adm('POST', '/admin/users/heyu/password', { id: 'heyu', pass: TEST_PASS });
    const back = await createClient(base)('POST', '/auth/login', { name: '何予', pass: TEST_PASS });
    assert.equal(back.status, 200);
  });
  await check('游戏下架 / 恢复：普通用户 404，审核员可见', async () => {
    await adm('POST', '/games/evensong/takedown', { id: 'evensong' });
    const anonView = await anon('GET', '/games/evensong');
    assert.equal(anonView.status, 404);
    const revView = await lin('GET', '/games/evensong');
    assert.equal(revView.status, 200);
    const list = await adm('GET', '/admin/games?down=1');
    assert.ok(list.data.items.some(g => g.id === 'evensong'));
    await adm('POST', '/admin/games/evensong/restore', { id: 'evensong' });
    const back = await anon('GET', '/games/evensong');
    assert.equal(back.status, 200);
  });
  await check('后台给游戏指派来源（可选项 + 校验 + 工坊包不可改）', async () => {
    const list = await adm('GET', '/admin/games?pageSize=200');
    assert.ok(list.data.sources.includes('X'), '来源选项里应有 X');
    assert.ok(list.data.items.some(g => g.id === 'evensong' && g.editable), '目录游戏应可指派来源');
    const r = await adm('POST', '/admin/games/evensong', { source: 'X' });
    assert.equal(r.status, 200); assert.equal(r.data.source, 'X');
    const view = await anon('GET', '/games/evensong');
    assert.equal(view.data.game.source, 'X', '指派后详情应带新来源');
    const bad = await adm('POST', '/admin/games/evensong', { source: '不存在的来源' });
    assert.equal(bad.status, 422); assert.equal(bad.data.message, 'source');
    const pack = await adm('POST', '/admin/games/pack-seed-tide', { source: 'X' });
    assert.equal(pack.status, 404, '工坊包没有目录来源，不应可指派');
  });

  db.close();
  const summary = summarize();
  if (summary.fail) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
