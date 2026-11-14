'use strict';
/* 即玩空间后端路由。语义以 assets/jiwan-api.js 的 mock 为准：
   同一批字段、同一批错误码、同一批分桶规则（关注/点赞/收藏/通知/历史按账号）。 */
const { hashPass, verifyPass, slug, DUMMY_PASS_HASH, MIN_PASS_LENGTH } = require('./db');
const S = require('./store');

const STATUS = { auth: 401, bad_credentials: 401, forbidden: 403, not_found: 404, invalid: 422, conflict: 409 };
const CAT_HUE = { story: 155, action: 25, puzzle: 50, idle: 230 };
/* 后台可指派的「来源」：空 = 未标记。工坊包不在此列（来源固定为工坊投稿）。 */
const GAME_SOURCES = ['', 'fable52.games', 'X', 'Claude Gaming', '腾讯（IP）', '字节 CDN'];

class HttpError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.code = code;
    this.status = status || STATUS[code] || 400;
  }
}
function fail(code, message) { throw new HttpError(code, message); }
function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function num(v, dft, min, max) {
  let n = Number(v);
  if (!Number.isFinite(n)) n = dft;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}
function str(v) { return String(v == null ? '' : v).trim(); }

function createApi({ db, onLogin, onLogout }) {
  const stmts = new Map();
  function sql(text) {
    let s = stmts.get(text);
    if (!s) { s = db.prepare(text); stmts.set(text, s); }
    return s;
  }
  const all = (text, ...p) => sql(text).all(...p);
  const get = (text, ...p) => sql(text).get(...p);
  const run = (text, ...p) => sql(text).run(...p);

  /* ---------- 用户 ---------- */
  function userById(id) { return id ? (get('SELECT * FROM users WHERE id = ?', String(id)) || null) : null; }
  function userByAny(v) {
    const s = String(v == null ? '' : v);
    if (!s) return null;
    return get('SELECT * FROM users WHERE id = ? OR handle = ? OR name = ?', s, s, s) || null;
  }
  function publicUser(u) {
    if (!u) return null;
    return { id: u.id, name: u.name, handle: u.handle || u.id, bio: u.bio || '', game: u.game || '', avatar: u.avatar || '', role: u.role || '' };
  }
  function isAdmin(u) { return !!(u && (u.role === 'admin' || u.id === 'admin')); }
  /* admin 拥有审核员全部权限，审核员的接口不用逐个改 */
  function isReviewer(u) { return !!(u && (u.role === 'reviewer' || u.role === 'admin' || u.id === 'lincheng' || u.id === 'admin')); }
  function requireUser(ctx) { if (!ctx.user) fail('auth', 'login'); return ctx.user; }
  function requireReviewer(ctx) { const u = requireUser(ctx); if (!isReviewer(u)) fail('forbidden', 'reviewer'); return u; }
  function requireAdmin(ctx) { const u = requireUser(ctx); if (!isAdmin(u)) fail('forbidden', 'admin'); return u; }

  /* ---------- 世界（每次请求重建：目录 + 已过审工坊包 + 评价 + 播放数 + 下架） ---------- */
  function packsAll() {
    return all('SELECT * FROM packs')
      .map(p => ({
        id: p.id, ownerId: p.ownerId, title: p.title, author: p.author, blurb: p.blurb, cat: p.cat,
        tags: p.tags, vis: p.vis, file: p.file, cover: p.cover, coverData: p.coverData,
        playUrl: p.playUrl, status: p.status, reason: p.reason, at: Number(p.at) || 0
      }))
      .sort((a, b) => b.at - a.at);
  }

  /* 分给工坊的目录游戏（与 packs 同 id 的 games 行）：packs.status 变化时同步 games.packStatus，
     过审上架=listed，其余情况清空 → 游戏退回普通目录，不会从站内消失。 */
  function syncPackFlag(pid) {
    const p = get('SELECT status FROM packs WHERE id = ?', pid);
    if (!p) return;
    run('UPDATE games SET packStatus = ? WHERE id = ?', p.status === 'listed' ? 'listed' : '', pid);
  }

  function packToGame(p) {
    const tags = String(p.tags || '').split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    if (!tags.length) tags.push('工坊');
    return {
      id: p.id, title: p.title, author: p.author, ownerId: p.ownerId,
      score: null, players: '本周上架', plays: 0, tags, cat: p.cat || 'story', year: 2026,
      hue: CAT_HUE[p.cat] || 70, chroma: 0.1, play: 'story',
      featured: false, pick: false, hot: false, neu: true, fable: true, demo: false,
      duration: 'mid', origin: 'fable52', blurb: p.blurb || '', about: p.blurb || '',
      poster: p.coverData || '', pw: 640, ph: 360, pos: 'center',
      shots: p.coverData ? [p.coverData] : [], shotSize: p.coverData ? [[640, 360]] : [],
      dist: [0, 0, 0, 0, 0], reviews: [], src: p.playUrl || '', playUrl: p.playUrl || '',
      packStatus: p.status, vis: p.vis
    };
  }

  function overlayReviews(games) {
    const rows = all('SELECT * FROM reviews');
    const byGame = new Map();
    rows.forEach(r => {
      if (!byGame.has(r.gameId)) byGame.set(r.gameId, []);
      byGame.get(r.gameId).push(r);
    });
    games.forEach(g => {
      const mine = byGame.get(g.id) || [];
      g.reviews = mine.filter(r => !r.deleted)
        .map(r => ({ id: r.id, u: r.name, s: r.s, t: r.t, score: r.score == null ? null : Number(r.score), userId: r.userId, seed: !!r.seed }));
      const scored = g.reviews.filter(r => typeof r.score === 'number');
      if (scored.length) {
        const avg = scored.reduce((a, r) => a + r.score, 0) / scored.length;
        g.score = Math.round(avg * 10) / 10;
        const buckets = [0, 0, 0, 0, 0];
        scored.forEach(r => { buckets[Math.min(4, Math.max(0, Math.floor((r.score - 1) / 2)))] += 1; });
        const tot = scored.length;
        g.dist = buckets.map(n => Math.round(n * 100 / tot));
      }
    });
  }

  function buildWorld(lang) {
    const games = S.loadGames(db);
    const packs = packsAll();
    const down = new Set(all('SELECT id FROM hidden WHERE kind = ?', 'game').map(r => r.id));
    const listed = packs.filter(p => p.status === 'listed' && p.vis === 'public');
    const listedIds = new Set(listed.map(p => p.id));
    for (let i = games.length - 1; i >= 0; i--) {
      if (games[i].packStatus && !listedIds.has(games[i].id)) games.splice(i, 1);
    }
    listed.forEach(p => { if (!games.some(g => g.id === p.id)) games.push(packToGame(p)); });
    /* 被下架的工坊包会变 unlisted，但仍要留给审核员打开详情（契约：审核员仍能看）。 */
    packs.filter(p => p.status !== 'listed' && down.has(p.id)).forEach(p => {
      if (!games.some(g => g.id === p.id)) games.push(packToGame(p));
    });
    overlayReviews(games);
    const plays = new Map(all('SELECT gameId, n FROM plays').map(r => [r.gameId, Number(r.n) || 0]));
    games.forEach(g => { g.plays = plays.get(g.id) || 0; });
    games.forEach(g => { g.takedown = down.has(g.id); });
    return { games, packs, lang: lang || 'zh' };
  }

  function gameOf(world, id) { return world.games.find(g => String(g.id) === String(id)) || null; }
  function visibleGame(world, id, user) {
    const g = gameOf(world, id);
    if (!g) return null;
    if (g.takedown && !isReviewer(user)) return null;
    return g;
  }
  function relatedFor(world, g) {
    const tags = new Set(g.tags || []);
    return world.games.filter(x => x.id !== g.id && !x.takedown).map(x => {
      let s = 0;
      if (x.cat === g.cat) s += 4;
      (x.tags || []).forEach(tag => { if (tags.has(tag)) s += 2; });
      if (x.hot) s += 1;
      if (x.fable === g.fable) s += 1;
      s += (x.score || 0) / 10;
      s += Math.log10(1 + S.parsePlayers(x));
      return { x, s };
    }).sort((a, b) => b.s - a.s).slice(0, 6).map(r => r.x);
  }
  function playingFor(world, userId) {
    const rows = all('SELECT gameId, at FROM history WHERE userId = ? ORDER BY at DESC', userId || 'guest');
    const seen = new Set();
    const out = [];
    rows.forEach(r => {
      if (seen.has(r.gameId)) return;
      seen.add(r.gameId);
      const g = gameOf(world, r.gameId);
      if (g && !g.takedown) out.push(g);
    });
    return out;
  }

  /* ---------- 帖子 ---------- */
  function isHidden(kind, id) {
    return !!get('SELECT 1 AS x FROM hidden WHERE kind = ? AND id = ?', kind, String(id));
  }
  function toPost(row) {
    return {
      id: row.id, userId: row.userId, user: row.user, game: row.game || '', title: row.title,
      body: row.body || '', likes: Number(row.likes) || 0, time: row.time || '', at: Number(row.at) || 0
    };
  }
  function allPosts(includeHidden) {
    const list = all('SELECT * FROM posts WHERE deleted = 0 ORDER BY at DESC, id DESC').map(toPost);
    return includeHidden ? list : list.filter(p => !isHidden('post', p.id));
  }
  function decoratePosts(list, user) {
    if (!list.length) return list;
    const ids = list.map(p => String(p.id));
    const counts = new Map();
    all(`SELECT postId, COUNT(*) AS n FROM likes WHERE postId IN (${ids.map(() => '?').join(',')}) GROUP BY postId`, ...ids)
      .forEach(r => counts.set(String(r.postId), Number(r.n) || 0));
    const mine = user ? new Set(all('SELECT postId FROM likes WHERE userId = ?', user.id).map(r => String(r.postId))) : new Set();
    list.forEach(p => {
      const on = mine.has(String(p.id));
      const total = Number(p.likes || 0) + (counts.get(String(p.id)) || 0);
      p.likes = Math.max(0, total - (on ? 1 : 0));
      p.liked = on;
      p.hidden = isHidden('post', p.id);
    });
    return list;
  }
  function commentsFor(postId) {
    return all('SELECT * FROM comments WHERE postId = ? ORDER BY at ASC', String(postId))
      .map(c => ({ id: c.id, postId: c.postId, userId: c.userId, name: c.name, text: c.text, time: c.time || '', at: Number(c.at) || 0 }));
  }
  function topicMatch(world, p, topic) {
    const g = gameOf(world, p.game);
    if (topic === 'fable') return !!(g && g.fable);
    if (topic === 'io') return !!(g && g.tags && g.tags.includes('IO'));
    if (topic === 'night') return p.game === 'last-light' || p.game === 'night-port';
    if (topic === 'idle') return !!(g && g.cat === 'idle');
    return true;
  }

  /* ---------- 通知 / 关注 / 收藏 ---------- */
  function pushNotif(n) {
    if (!n || !n.to) return;
    run('INSERT INTO notifs (id, toId, type, fromName, fromId, href, title, read, at) VALUES (?,?,?,?,?,?,?,0,?)',
      uid('n'), String(n.to), n.type, n.from || '', n.fromId || '', n.href || '', n.title || '', Date.now());
    run('DELETE FROM notifs WHERE toId = ? AND id NOT IN (SELECT id FROM notifs WHERE toId = ? ORDER BY at DESC LIMIT 40)', String(n.to), String(n.to));
  }
  function notifsFor(userId) {
    return all('SELECT * FROM notifs WHERE toId = ? ORDER BY at DESC', userId).map(n => ({
      id: n.id, type: n.type, from: n.fromName || '', fromId: n.fromId || '',
      href: n.href || '', title: n.title || '', read: !!n.read, at: Number(n.at) || 0
    }));
  }
  function favSet(userId) {
    return new Set(userId ? all('SELECT gameId FROM favs WHERE userId = ?', userId).map(r => r.gameId) : []);
  }
  function followSet(userId) {
    return new Set(userId ? all('SELECT targetId FROM follows WHERE userId = ?', userId).map(r => r.targetId) : []);
  }

  /* ---------- 路由 ---------- */
  function handle(ctx) {
    const { method, parts, query, body } = ctx;
    const q = query || {};
    const b = body || {};
    const lang = str(q.lang) === 'en' ? 'en' : 'zh';
    const world = buildWorld(lang);
    const me = ctx.user;
    const p0 = parts[0] || '';

    if (method === 'GET' && p0 === 'home') {
      const rankTab = ['hot', 'new', 'score'].includes(q.rank) ? q.rank : 'hot';
      const period = ['day', 'week', 'month'].includes(q.period) ? q.period : 'day';
      const live = world.games.filter(g => !g.takedown);
      const hot = S.rankList(world.games, 'hot', period, 6, lang).filter(g => !g.takedown);
      const hotIds = new Set(hot.map(g => g.id));
      const posts = decoratePosts(allPosts(false), me).slice(0, 8);
      const prevPeriod = ['day', 'week', 'month'].includes(q.prev)
        ? q.prev : (period === 'day' ? 'week' : 'day');
      return {
        featured: live.filter(g => g.featured),
        hot,
        neu: live.filter(g => g.neu),
        rank: S.rankList(world.games, rankTab, period, 10, lang).filter(g => !g.takedown),
        /* 首页「工坊」栏只收真正过审上架的工坊包；没上架过就没有这一栏 */
        workshop: live.filter(g => g.packStatus === 'listed').slice(0, 4),
        kept: live.filter(g => !hotIds.has(g.id) && !g.fable).sort((a, b2) => (b2.score || 0) - (a.score || 0)).slice(0, 4),
        posts,
        resume: playingFor(world, me ? me.id : 'guest').slice(0, 8),
        prev: { period: prevPeriod, map: S.rankIndexMap(world.games, rankTab, prevPeriod, lang) }
      };
    }

    if (method === 'GET' && p0 === 'games' && parts.length === 1) {
      const filtered = S.filterGames(world.games, {
        genre: q.genre || 'all', duration: q.duration || 'all', fable: q.fable || 'all',
        q: q.q || '', tag: q.tag || '', source: q.source || ''
      });
      const fromRank = q.from === 'rank' && ['hot', 'new', 'score'].includes(q.sort);
      const period = ['day', 'week', 'month'].includes(q.period) ? q.period : 'day';
      const list = fromRank
        ? S.rankFull(filtered, q.sort, period, lang)
        : S.sortGames(filtered, q.sort || 'hot', lang);
      const page = num(q.page, 1, 1);
      const pageSize = num(q.pageSize, 60, 1, 200);
      const start = (page - 1) * pageSize;
      const out = { items: list.slice(start, start + pageSize), total: list.length, page, pageSize };
      if (fromRank) {
        const prevPeriod = ['day', 'week', 'month'].includes(q.prev)
          ? q.prev : (period === 'day' ? 'week' : 'day');
        out.prev = { period: prevPeriod, map: S.rankIndexMap(world.games, q.sort, prevPeriod, lang) };
      }
      return out;
    }

    /* 前端 byId 的索引：一次取全部游戏的展示字段（不含 shots 等大字段） */
    if (method === 'GET' && p0 === 'games' && parts[1] === 'index') {
      return {
        items: world.games.map(g => ({
          id: g.id, title: g.title, title_en: g.title_en, author: g.author, maker: g.maker, source: g.source,
          score: g.score, players: g.players, plays: g.plays, year: g.year, cat: g.cat, tags: g.tags,
          hue: g.hue, chroma: g.chroma, play: g.play, src: g.src, demo: g.demo, fable: g.fable,
          hot: g.hot, neu: g.neu, featured: g.featured, pick: g.pick, wide: g.wide,
          duration: g.duration, origin: g.origin, banner: g.banner, banner_en: g.banner_en,
          blurb: g.blurb, blurb_en: g.blurb_en, about: g.about, about_en: g.about_en,
          poster: g.poster, pw: g.pw, ph: g.ph, pos: g.pos, takedown: g.takedown,
          packStatus: g.packStatus || '', ownerId: g.ownerId || '',
          reviews: g.reviews
        })),
        total: world.games.length,
        people: all('SELECT id, name, handle FROM users').map(u => ({ id: u.id, name: u.name, handle: u.handle || u.id }))
      };
    }

    if (method === 'GET' && p0 === 'games' && parts.length === 2) {
      const g = world.games.find(x => String(x.id) === String(parts[1]));
      if (!g || (g.takedown && !isReviewer(me))) fail('not_found', 'missing');
      const favs = favSet(me && me.id);
      return {
        game: g, related: relatedFor(world, g), followed: favs.has(g.id),
        playUrl: g.src || g.playUrl || '', playable: !!(g.src || g.playUrl)
      };
    }

    if (method === 'GET' && p0 === 'rankings') {
      const tab = ['hot', 'new', 'score'].includes(q.tab) ? q.tab : 'hot';
      const period = ['day', 'week', 'month'].includes(q.period) ? q.period : 'day';
      const n = num(q.n, 20, 1, 100);
      const prevPeriod = ['day', 'week', 'month'].includes(q.prev) ? q.prev : (period === 'day' ? 'week' : 'day');
      return {
        items: S.rankList(world.games, tab, period, n, lang), tab, period,
        prev: { period: prevPeriod, map: S.rankIndexMap(world.games, tab, prevPeriod, lang) }
      };
    }

    if (method === 'GET' && p0 === 'search') {
      const query2 = str(q.q);
      const games = query2
        ? S.filterGames(world.games, { q: query2 })
        : S.sortGames(world.games.filter(g => !g.takedown && (g.hot || g.featured)), 'hot', lang);
      const postsAll = query2
        ? allPosts(false).filter(p => {
          const g = gameOf(world, p.game);
          const blob = (p.title + ' ' + (p.body || '') + ' ' + p.user + ' ' + (g ? g.title + ' ' + S.titleOf(g, lang) : '')).toLowerCase();
          if (blob.includes(query2.toLowerCase())) return true;
          return g ? S.matchesQuery(g, query2) : false;
        })
        : allPosts(false);
      const page = num(q.page, 1, 1);
      const pageSize = num(q.pageSize, 12, 1, 60);
      const postPage = num(q.postPage, 1, 1);
      const postPageSize = num(q.postPageSize, 8, 1, 40);
      const start = (page - 1) * pageSize;
      const pStart = (postPage - 1) * postPageSize;
      const qLow = query2.toLowerCase();
      const userRows = query2
        ? all('SELECT * FROM users').filter(u => (u.name + ' ' + (u.handle || '') + ' ' + (u.bio || '') + ' ' + (u.game || '')).toLowerCase().includes(qLow))
        : [];
      return {
        games: games.slice(start, start + pageSize),
        gameTotal: games.length,
        posts: decoratePosts(postsAll.slice(pStart, pStart + postPageSize), me),
        postTotal: postsAll.length,
        users: userRows.slice(0, 8).map(publicUser),
        userTotal: userRows.length,
        q: query2, page, pageSize, postPage, postPageSize,
        suggest: (!query2 || games.length) ? '' : S.suggestQuery(world.games, query2)
      };
    }

    if (p0 === 'posts' && parts.length === 1) {
      if (method === 'GET') {
        const feed = ['all', 'follow', 'fable'].includes(q.feed) ? q.feed : 'all';
        const topic = str(q.topic);
        const game = str(q.game);
        const follows = followSet(me && me.id);
        const list = allPosts(false).filter(p => {
          const g = gameOf(world, p.game);
          if (game && p.game !== game) return false;
          if (feed === 'fable') return !!(g && g.fable);
          if (feed === 'follow') return follows.has(p.userId) || follows.has(slug(p.user)) || follows.has(p.user);
          if (topic) return topicMatch(world, p, topic);
          return true;
        });
        const topics = S.loadTopics(db).map(tp => Object.assign({}, tp, {
          count: allPosts(false).filter(p => topicMatch(world, p, tp.id)).length
        }));
        const page = num(q.page, 1, 1);
        const pageSize = num(q.pageSize, game ? 40 : 8, 1, 100);
        const start = (page - 1) * pageSize;
        return { items: decoratePosts(list.slice(start, start + pageSize), me), total: list.length, page, pageSize, topics };
      }
      if (method === 'POST') {
        const u = requireUser(ctx);
        const title = str(b.title);
        const text = str(b.body);
        if (title.length < 4 || title.length > 48) fail('invalid', 'title');
        const row = {
          id: uid('p'), userId: u.id, user: u.name, game: str(b.game), title, body: text,
          likes: 0, time: '刚刚', at: Date.now()
        };
        run('INSERT INTO posts (id, userId, user, game, title, body, likes, time, at, deleted) VALUES (?,?,?,?,?,?,?,?,?,0)',
          row.id, row.userId, row.user, row.game, row.title, row.body, 0, row.time, row.at);
        return { post: row };
      }
    }

    if (p0 === 'posts' && parts.length >= 2) {
      const pid = String(parts[1]);
      const sub = parts[2] || '';
      const post = allPosts(true).find(p => String(p.id) === pid);

      if (method === 'GET' && parts.length === 2) {
        if (!post) fail('not_found', 'missing');
        const hiddenNow = isHidden('post', pid);
        if (hiddenNow && !(isReviewer(me) || (me && me.id === post.userId))) fail('not_found', 'missing');
        const [deco] = decoratePosts([Object.assign({}, post)], me);
        return { post: deco, game: gameOf(world, post.game) || null, liked: deco.liked, comments: commentsFor(pid), hidden: hiddenNow };
      }

      if (method === 'POST' && parts.length === 2) {
        const u = requireUser(ctx);
        const title = str(b.title);
        const text = str(b.body);
        if (title.length < 4 || title.length > 48) fail('invalid', 'title');
        if (!post) fail('not_found', 'missing');
        if (post.userId !== u.id) fail('forbidden', 'owner');
        const game = b.game == null ? post.game : str(b.game);
        run('INSERT OR REPLACE INTO posts (id, userId, user, game, title, body, likes, time, at, deleted) VALUES (?,?,?,?,?,?,?,?,?,0)',
          post.id, post.userId, post.user, game, title, text, post.likes || 0, '刚刚', Date.now());
        const row = get('SELECT * FROM posts WHERE id = ?', pid);
        return { post: toPost(row) };
      }

      if (method === 'POST' && sub === 'delete') {
        const u = requireUser(ctx);
        if (!post || post.userId !== u.id) fail('not_found', 'missing');
        run('INSERT OR REPLACE INTO posts (id, userId, user, game, title, body, likes, time, at, deleted) VALUES (?,?,?,?,?,?,?,?,?,1)',
          post.id, post.userId, post.user, post.game || '', post.title || '', '', post.likes || 0, post.time || '', Date.now());
        run('DELETE FROM comments WHERE postId = ?', pid);
        run('DELETE FROM likes WHERE postId = ?', pid);
        return { ok: true };
      }

      if (method === 'POST' && sub === 'like') {
        const u = requireUser(ctx);
        if (!post) fail('not_found', 'missing');
        const on = !!get('SELECT 1 AS x FROM likes WHERE userId = ? AND postId = ?', u.id, pid);
        if (on) run('DELETE FROM likes WHERE userId = ? AND postId = ?', u.id, pid);
        else run('INSERT OR IGNORE INTO likes (userId, postId, at) VALUES (?,?,?)', u.id, pid, Date.now());
        if (!on && post.userId && post.userId !== u.id) {
          pushNotif({ to: post.userId, type: 'like', from: u.name, fromId: u.id, href: 'post.html?id=' + encodeURIComponent(pid) });
        }
        return { liked: !on, id: pid };
      }

      if (method === 'POST' && sub === 'comments') {
        const u = requireUser(ctx);
        if (!post) fail('not_found', 'missing');
        const text = str(b.text);
        if (text.length < 2) fail('invalid', 'text');
        const row = { id: uid('c'), postId: post.id, userId: u.id, name: u.name, text, time: '刚刚', at: Date.now() };
        run('INSERT INTO comments (id, postId, userId, name, text, time, at) VALUES (?,?,?,?,?,?,?)',
          row.id, String(row.postId), row.userId, row.name, row.text, row.time, row.at);
        if (post.userId && post.userId !== u.id) {
          pushNotif({ to: post.userId, type: 'comment', from: u.name, fromId: u.id, href: 'post.html?id=' + encodeURIComponent(post.id) });
        }
        return { comment: { id: row.id, postId: row.postId, userId: row.userId, name: row.name, text: row.text } };
      }

      if (method === 'POST' && sub === 'hide') {
        const u = requireReviewer(ctx);
        if (!post) fail('not_found', 'missing');
        run('INSERT OR IGNORE INTO hidden (kind, id, at) VALUES (?,?,?)', 'post', pid, Date.now());
        if (post.userId) {
          pushNotif({ to: post.userId, type: 'postHidden', from: u.name, fromId: u.id, href: 'community.html' });
        }
        return { ok: true, id: pid };
      }
    }

    if (p0 === 'comments' && parts.length >= 2 && method === 'POST') {
      const u = requireUser(ctx);
      const cid = String(parts[1]);
      const row = get('SELECT * FROM comments WHERE id = ?', cid);
      if (!row || row.userId !== u.id) fail('not_found', 'missing');
      if (parts[2] === 'delete') {
        run('DELETE FROM comments WHERE id = ?', cid);
        return { ok: true };
      }
      const text = str(b.text);
      if (text.length < 2) fail('invalid', 'text');
      run('UPDATE comments SET text = ?, time = ?, at = ? WHERE id = ?', text, '刚刚', Date.now(), cid);
      return { comment: { id: cid, postId: row.postId, userId: row.userId, name: row.name, text } };
    }

    if (p0 === 'reports') {
      if (method === 'POST' && parts.length === 1) {
        const u = requireUser(ctx);
        const why = str(b.reason);
        if (why.length < 2) fail('invalid', 'reason');
        const kind = b.kind === 'post' ? 'post' : 'game';
        const id = str(b.id);
        if (!id) fail('invalid', 'id');
        run('INSERT INTO reports (id, kind, target, reason, userId, at, done) VALUES (?,?,?,?,?,?,0)',
          uid('rp'), kind, id, why, u.id, Date.now());
        return { ok: true };
      }
      if (method === 'GET' && parts.length === 1) {
        requireReviewer(ctx);
        const includeDone = str(q.all) === '1';
        const items = all('SELECT * FROM reports' + (includeDone ? '' : ' WHERE done = 0') + ' ORDER BY at DESC').map(r => {
          let title = r.target;
          let gone = false;
          if (r.kind === 'post') {
            const p = allPosts(true).find(x => String(x.id) === String(r.target));
            title = p ? p.title : r.target;
            gone = !p || isHidden('post', r.target);
          } else {
            const g = gameOf(world, r.target);
            title = g ? (S.titleOf(g, lang) || g.title) : r.target;
            gone = !g || !!g.takedown;
          }
          return { id: r.id, kind: r.kind, target: r.target, reason: r.reason, userId: r.userId, at: Number(r.at), title, gone, done: !!r.done };
        });
        return { items };
      }
      if (method === 'POST' && parts.length === 3 && parts[2] === 'dismiss') {
        requireReviewer(ctx);
        run('UPDATE reports SET done = 1 WHERE id = ?', String(parts[1]));
        return { ok: true };
      }
    }

    if (p0 === 'games' && method === 'POST') {
      const gid = String(parts[1] || '');
      const sub = parts[2] || '';
      if (sub === 'takedown') {
        const u = requireReviewer(ctx);
        const g = gameOf(world, gid);
        if (!g) fail('not_found', 'missing');
        run('INSERT OR IGNORE INTO hidden (kind, id, at) VALUES (?,?,?)', 'game', gid, Date.now());
        const pack = get('SELECT * FROM packs WHERE id = ?', gid);
        if (pack && pack.status === 'listed') { run('UPDATE packs SET status = ? WHERE id = ?', 'unlisted', gid); syncPackFlag(gid); }
        const owner = g.ownerId || (userByAny(g.author) || {}).id || '';
        if (owner) pushNotif({ to: owner, type: 'gameDown', from: u.name, fromId: u.id, href: 'workshop.html' });
        return { ok: true, id: gid };
      }
      if (sub === 'follow') {
        const u = requireUser(ctx);
        const g = gameOf(world, gid);
        if (!g) fail('not_found', 'missing');
        const on = !!get('SELECT 1 AS x FROM favs WHERE userId = ? AND gameId = ?', u.id, gid);
        if (on) run('DELETE FROM favs WHERE userId = ? AND gameId = ?', u.id, gid);
        else run('INSERT OR IGNORE INTO favs (userId, gameId, at) VALUES (?,?,?)', u.id, gid, Date.now());
        return { followed: !on, id: gid };
      }
      if (sub === 'reviews') {
        const u = requireUser(ctx);
        const g = gameOf(world, gid);
        if (!g) fail('not_found', 'missing');
        if (parts[3] === 'delete') {
          run('DELETE FROM reviews WHERE gameId = ? AND userId = ?', gid, u.id);
          run('INSERT INTO reviews (id, gameId, userId, name, s, score, t, at, deleted) VALUES (?,?,?,?,?,?,?,?,1)',
            uid('r'), gid, u.id, u.name, '好评', null, '', Date.now());
          return { ok: true };
        }
        const score = Number(b.score);
        if (!(score >= 1 && score <= 10)) fail('invalid', 'score');
        const text = str(b.text);
        if (text.length < 4) fail('invalid', 'text');
        const sentiment = b.sentiment === '吐槽' ? '吐槽' : '好评';
        run('DELETE FROM reviews WHERE gameId = ? AND userId = ?', gid, u.id);
        run('INSERT INTO reviews (id, gameId, userId, name, s, score, t, at, deleted) VALUES (?,?,?,?,?,?,?,?,0)',
          uid('r'), gid, u.id, u.name, sentiment, Math.round(score), text, Date.now());
        return { ok: true };
      }
    }

    if (p0 === 'auth' && method === 'POST') {
      const sub = parts[1];
      if (sub === 'login') {
        const u = userByAny(b.name);
        const ok = verifyPass(b.pass, u ? u.pass_hash : DUMMY_PASS_HASH);
        if (!ok || !u) fail('bad_credentials', 'bad_credentials');
        if (u.disabled) fail('forbidden', 'disabled');
        const guest = all('SELECT gameId, at FROM history WHERE userId = ?', 'guest');
        guest.forEach(h => run('INSERT OR REPLACE INTO history (userId, gameId, at) VALUES (?,?,?)', u.id, h.gameId, h.at));
        run('DELETE FROM history WHERE userId = ?', 'guest');
        onLogin(ctx, u.id);
        return { user: publicUser(u) };
      }
      if (sub === 'register') {
        const name = str(b.name);
        const handle = slug(str(b.handle) || name);
        const pass = String(b.pass || '');
        if (name.length < 2 || name.length > 16) fail('invalid', 'name');
        if (pass.length < MIN_PASS_LENGTH) fail('invalid', 'pass');
        if (userByAny(handle) || userByAny(name)) fail('conflict', 'exists');
        run('INSERT INTO users (id, name, handle, pass_hash, bio, game, avatar, role, at) VALUES (?,?,?,?,?,?,?,?,?)',
          handle, name, handle, hashPass(pass), '', '', '', '', Date.now());
        const u = userById(handle);
        onLogin(ctx, u.id);
        return { user: publicUser(u) };
      }
      if (sub === 'reset') {
        fail('forbidden', 'reset_disabled');
      }
    }

    if (p0 === 'me') {
      if (method === 'GET' && parts.length === 1) return { user: publicUser(me) };
      if (method === 'POST' && parts.length === 1) {
        const u = requireUser(ctx);
        const name = b.name == null ? u.name : str(b.name);
        if (name.length < 2 || name.length > 16) fail('invalid', 'name');
        const dup = get('SELECT id FROM users WHERE name = ? AND id <> ?', name, u.id);
        if (dup) fail('conflict', 'exists');
        const bio = b.bio == null ? u.bio : str(b.bio).slice(0, 80);
        const avatar = b.avatar == null ? u.avatar : String(b.avatar || '').slice(0, 180000);
        run('UPDATE users SET name = ?, bio = ?, avatar = ? WHERE id = ?', name, bio, avatar, u.id);
        return { user: publicUser(userById(u.id)) };
      }
      if (method === 'POST' && parts[1] === 'password') {
        const u = requireUser(ctx);
        if (!verifyPass(b.oldPass, u.pass_hash)) fail('auth', 'bad_credentials');
        const pass = String(b.pass || '');
        if (pass.length < MIN_PASS_LENGTH) fail('invalid', 'pass');
        run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPass(pass), u.id);
        return { ok: true };
      }
    }

    if (p0 === 'logout' && method === 'POST') {
      onLogout(ctx);
      return { ok: true };
    }

    if (p0 === 'users' && parts.length >= 2) {
      const u = userByAny(parts[1]);
      if (!u) fail('not_found', 'missing');
      if (method === 'POST' && parts[2] === 'follow') {
        const viewer = requireUser(ctx);
        if (viewer.id === u.id) fail('invalid', 'self');
        const on = !!get('SELECT 1 AS x FROM follows WHERE userId = ? AND targetId = ?', viewer.id, u.id);
        if (on) run('DELETE FROM follows WHERE userId = ? AND targetId = ?', viewer.id, u.id);
        else {
          run('INSERT OR IGNORE INTO follows (userId, targetId, at) VALUES (?,?,?)', viewer.id, u.id, Date.now());
          pushNotif({ to: u.id, type: 'follow', from: viewer.name, fromId: viewer.id, href: 'user.html?id=' + encodeURIComponent(viewer.id) });
        }
        return { followed: !on, id: u.id, name: u.name };
      }
      if (method === 'GET') {
        const made = world.games.filter(g => !g.takedown && (g.author === u.name || g.ownerId === u.id));
        const revs = all('SELECT * FROM reviews WHERE userId = ? AND deleted = 0', u.id)
          .map(r => ({ id: r.id, game: r.gameId, s: r.s, t: r.t, score: r.score }));
        world.games.forEach(g => {
          (g.reviews || []).forEach(r => {
            if (r.userId === u.id && !revs.some(x => x.id === r.id || (x.game === g.id && x.t === r.t))) {
              revs.push({ id: r.id, game: g.id, s: r.s, t: r.t, score: r.score });
            }
          });
        });
        const posts = decoratePosts(allPosts(false).filter(p => p.userId === u.id || p.user === u.name), me);
        const mine = me && me.id === u.id;
        const favGames = mine
          ? all('SELECT gameId FROM favs WHERE userId = ?', u.id).map(r => gameOf(world, r.gameId)).filter(Boolean)
          : [];
        const people = all('SELECT targetId FROM follows WHERE userId = ?', u.id).map(r => publicUser(userById(r.targetId))).filter(Boolean);
        const followers = all('SELECT userId FROM follows WHERE targetId = ?', u.id).map(r => publicUser(userById(r.userId))).filter(Boolean);
        return {
          user: publicUser(u), made, reviews: revs, posts,
          playing: playingFor(world, u.id),
          favs: favGames, people, followers,
          packs: packsAll().filter(p => p.ownerId === u.id),
          following: !!(me && followSet(me.id).has(u.id)),
          isMe: !!mine, isReviewer: isReviewer(u)
        };
      }
    }

    if (p0 === 'workshop') {
      if (method === 'POST' && parts[1] === 'packs' && parts.length === 2) {
        const u = requireUser(ctx);
        const title = str(b.title);
        if (title.length < 2 || title.length > 24) fail('invalid', 'title');
        const vis = b.vis === 'link' || b.vis === 'draft' ? b.vis : 'public';
        const row = {
          id: uid('pack'), ownerId: u.id, title, author: str(b.author) || u.name,
          blurb: str(b.blurb), cat: b.cat || 'story', tags: str(b.tags), vis,
          file: b.file || '', cover: b.cover || '', coverData: b.coverData || '',
          playUrl: str(b.playUrl), status: vis === 'draft' ? 'draft' : 'pending', reason: '', at: Date.now()
        };
        run('INSERT INTO packs (id, ownerId, title, author, blurb, cat, tags, vis, file, cover, coverData, playUrl, status, reason, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          row.id, row.ownerId, row.title, row.author, row.blurb, row.cat, row.tags, row.vis, row.file, row.cover, row.coverData, row.playUrl, row.status, '', row.at);
        return { pack: row };
      }
      if (method === 'POST' && parts[1] === 'packs' && parts.length >= 3) {
        const u = requireUser(ctx);
        const pid = String(parts[2]);
        const sub = parts[3] || '';
        const pack = get('SELECT * FROM packs WHERE id = ?', pid);
        if (!pack) fail('not_found', 'missing');
        if (sub === 'review') {
          const reviewer = requireReviewer(ctx);
          if (pack.ownerId === reviewer.id) fail('forbidden', 'self');
          const status = b.status;
          if (status !== 'listed' && status !== 'rejected') fail('invalid', 'status');
          const reason = status === 'rejected' ? (str(b.reason) || '未写明原因') : '';
          run('UPDATE packs SET status = ?, reason = ? WHERE id = ?', status, reason, pid);
          syncPackFlag(pid);
          if (status === 'listed') {
            pushNotif({ to: pack.ownerId, type: 'packOn', from: reviewer.name, fromId: reviewer.id, title: pack.title, href: 'game-detail.html?id=' + encodeURIComponent(pid) });
          } else {
            pushNotif({ to: pack.ownerId, type: 'packOff', from: reviewer.name, fromId: reviewer.id, title: pack.title, href: 'workshop.html#publish' });
          }
          return { pack: get('SELECT * FROM packs WHERE id = ?', pid) };
        }
        if (pack.ownerId !== u.id) fail('not_found', 'missing');
        if (!sub) {
          const title = str(b.title == null ? pack.title : b.title);
          if (title.length < 2 || title.length > 24) fail('invalid', 'title');
          const vis = b.vis ? (b.vis === 'link' || b.vis === 'draft' ? b.vis : 'public') : pack.vis;
          const status = pack.status === 'listed' && vis !== 'public' ? 'pending' : pack.status;
          run(`UPDATE packs SET title = ?, author = ?, blurb = ?, cat = ?, tags = ?, vis = ?, file = ?, cover = ?, coverData = ?, playUrl = ?, status = ?, at = ? WHERE id = ?`,
            title,
            b.author == null ? pack.author : (str(b.author) || u.name),
            b.blurb == null ? pack.blurb : str(b.blurb),
            b.cat || pack.cat,
            b.tags == null ? pack.tags : str(b.tags),
            vis, b.file || pack.file, b.cover || pack.cover, b.coverData || pack.coverData,
            b.playUrl == null ? pack.playUrl : str(b.playUrl), status, Date.now(), pid);
          syncPackFlag(pid);
          return { pack: get('SELECT * FROM packs WHERE id = ?', pid) };
        }
        if (sub === 'unlist') {
          run('UPDATE packs SET status = ? WHERE id = ?', 'unlisted', pid);
          syncPackFlag(pid);
          return { pack: get('SELECT * FROM packs WHERE id = ?', pid) };
        }
        if (sub === 'resubmit') {
          if (!['rejected', 'draft', 'unlisted'].includes(pack.status)) fail('invalid', 'status');
          run('UPDATE packs SET status = ?, reason = ?, at = ? WHERE id = ?', pack.vis === 'draft' ? 'draft' : 'pending', '', Date.now(), pid);
          syncPackFlag(pid);
          return { pack: get('SELECT * FROM packs WHERE id = ?', pid) };
        }
      }
      if (method === 'GET' && parts[1] === 'mine') {
        const u = requireUser(ctx);
        return { items: packsAll().filter(p => p.ownerId === u.id) };
      }
      if (method === 'GET' && parts[1] === 'queue') {
        const u = requireReviewer(ctx);
        return { items: packsAll().filter(p => p.status === 'pending' && p.ownerId !== u.id), reviewer: true };
      }
    }

    if (p0 === 'plays' && method === 'POST') {
      const gid = str(b.id);
      const g = gameOf(world, gid);
      if (!g) fail('not_found', 'missing');
      const cur = get('SELECT n FROM plays WHERE gameId = ?', gid);
      const n = (cur ? Number(cur.n) : 0) + 1;
      run('INSERT OR REPLACE INTO plays (gameId, n) VALUES (?,?)', gid, n);
      run('INSERT OR REPLACE INTO history (userId, gameId, at) VALUES (?,?,?)', me ? me.id : 'guest', gid, Date.now());
      g.plays = n;
      return {
        plays: n,
        live: S.livePlayers(g),
        players: S.playerLine(g)
      };
    }

    if (p0 === 'notifs') {
      const u = requireUser(ctx);
      if (method === 'GET' && parts.length === 1) return { items: notifsFor(u.id) };
      if (method === 'POST' && parts[1] === 'read') {
        run('UPDATE notifs SET read = 1 WHERE toId = ?', u.id);
        return { ok: true };
      }
      if (method === 'POST' && parts.length === 3 && parts[2] === 'read') {
        run('UPDATE notifs SET read = 1 WHERE id = ? AND toId = ?', String(parts[1]), u.id);
        return { ok: true };
      }
    }

    /* ---------- 后台（admin） ---------- */
    if (p0 === 'admin') {
      /* 审核员能进后台（举报、工坊、内容治理），只有用户管理是 admin 专属 */
      const admin = requireReviewer(ctx);
      const isAdminUser = isAdmin(admin);
      const needAdmin = () => { if (!isAdminUser) fail('forbidden', 'admin'); };
      const U = parts[1] || '';

      if (method === 'GET' && parts.length === 1) {
        return { ok: true, admin: publicUser(admin) };
      }

      if (method === 'GET' && U === 'stats') {
        const now = Date.now();
        const week = now - 7 * 864e5;
        const one = (sqlText, ...a) => Number((get(sqlText, ...a) || { n: 0 }).n) || 0;
        const games = world.games;
        const packs = packsAll();
        return {
          games: { total: games.length, down: games.filter(g => g.takedown).length },
          users: {
            total: one('SELECT COUNT(*) AS n FROM users'),
            admin: one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
            reviewer: one("SELECT COUNT(*) AS n FROM users WHERE role = 'reviewer'"),
            disabled: one('SELECT COUNT(*) AS n FROM users WHERE disabled = 1'),
            new7: one('SELECT COUNT(*) AS n FROM users WHERE at >= ?', week)
          },
          posts: {
            total: one('SELECT COUNT(*) AS n FROM posts WHERE deleted = 0'),
            hidden: one("SELECT COUNT(*) AS n FROM hidden WHERE kind = 'post'"),
            new7: one('SELECT COUNT(*) AS n FROM posts WHERE deleted = 0 AND at >= ?', week)
          },
          comments: { total: one('SELECT COUNT(*) AS n FROM comments'), new7: one('SELECT COUNT(*) AS n FROM comments WHERE at >= ?', week) },
          reviews: { total: one('SELECT COUNT(*) AS n FROM reviews WHERE deleted = 0'), seed: one('SELECT COUNT(*) AS n FROM reviews WHERE seed = 1') },
          plays: { total: one('SELECT COALESCE(SUM(n),0) AS n FROM plays'), week: one('SELECT COUNT(*) AS n FROM history WHERE at >= ? AND userId <> ?', week, 'guest') },
          packs: {
            pending: packs.filter(x => x.status === 'pending').length,
            listed: packs.filter(x => x.status === 'listed').length,
            rejected: packs.filter(x => x.status === 'rejected').length
          },
          reports: {
            pending: one('SELECT COUNT(*) AS n FROM reports WHERE done = 0'),
            done: one('SELECT COUNT(*) AS n FROM reports WHERE done = 1')
          }
        };
      }

      if (method === 'GET' && U === 'users') {
        needAdmin();
        const kw = str(q.q).toLowerCase();
        const role = str(q.role);
        const page = num(q.page, 1, 1, 1e6);
        const pageSize = num(q.pageSize, 20, 5, 100);
        let rows = all(`SELECT u.*,
            (SELECT COUNT(*) FROM posts p WHERE p.userId = u.id AND p.deleted = 0) AS posts,
            (SELECT COUNT(*) FROM reviews r WHERE r.userId = u.id AND r.deleted = 0) AS reviews,
            (SELECT MAX(at) FROM history h WHERE h.userId = u.id) AS lastAt
          FROM users u ORDER BY u.at DESC, u.id ASC`);
        if (kw) rows = rows.filter(r => (r.name + ' ' + r.handle + ' ' + r.id).toLowerCase().includes(kw));
        if (role === 'admin') rows = rows.filter(r => r.role === 'admin');
        else if (role === 'reviewer') rows = rows.filter(r => r.role === 'reviewer');
        else if (role === 'user') rows = rows.filter(r => r.role !== 'admin' && r.role !== 'reviewer');
        else if (role === 'disabled') rows = rows.filter(r => r.disabled);
        const total = rows.length;
        rows = rows.slice((page - 1) * pageSize, page * pageSize);
        return {
          items: rows.map(r => ({
            id: r.id, name: r.name, handle: r.handle || r.id, role: r.role || '',
            disabled: !!r.disabled, at: Number(r.at) || 0, posts: Number(r.posts) || 0,
            reviews: Number(r.reviews) || 0, lastAt: Number(r.lastAt) || 0,
            isMe: r.id === admin.id
          })),
          total, page, pageSize
        };
      }

      if (method === 'POST' && U === 'users' && parts.length >= 3) {
        needAdmin();
        const target = userById(parts[2]);
        if (!target) fail('not_found', 'missing');
        const sub = parts[3] || '';

        if (sub === 'password') {
          const pass = String(b.pass || '');
          if (pass.length < MIN_PASS_LENGTH) fail('invalid', 'pass');
          run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPass(pass), target.id);
          return { ok: true, id: target.id };
        }

        const nextRole = b.role == null ? target.role : str(b.role);
        if (!['', 'reviewer', 'admin'].includes(nextRole)) fail('invalid', 'role');
        const nextDisabled = b.disabled == null ? !!target.disabled : !!b.disabled;
        if (target.id === admin.id && (nextRole !== 'admin' || nextDisabled)) fail('forbidden', 'self');
        if (target.role === 'admin' && nextRole !== 'admin') {
          const admins = Number((get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0") || { n: 0 }).n);
          if (admins <= 1) fail('forbidden', 'last_admin');
        }
        const nextName = b.name == null ? target.name : str(b.name);
        if (nextName.length < 2 || nextName.length > 16) fail('invalid', 'name');
        if (nextName !== target.name) {
          const dup = get('SELECT id FROM users WHERE name = ? AND id <> ?', nextName, target.id);
          if (dup) fail('conflict', 'exists');
          run('UPDATE users SET name = ? WHERE id = ?', nextName, target.id);
        }
        run('UPDATE users SET role = ?, disabled = ? WHERE id = ?', nextRole, nextDisabled ? 1 : 0, target.id);
        if (nextDisabled && !target.disabled) run('DELETE FROM sessions WHERE userId = ?', target.id);
        const fresh = userById(target.id);
        return { user: publicUser(fresh), disabled: !!fresh.disabled };
      }

      if (method === 'GET' && U === 'posts') {
        const kw = str(q.q).toLowerCase();
        const onlyHidden = str(q.hidden) === '1';
        const page = num(q.page, 1, 1, 1e6);
        const pageSize = num(q.pageSize, 20, 5, 100);
        const hiddenSet = new Set(all("SELECT id FROM hidden WHERE kind = 'post'").map(r => r.id));
        let rows = all('SELECT * FROM posts WHERE deleted = 0 ORDER BY at DESC, id DESC').map(toPost);
        if (kw) rows = rows.filter(p => (p.title + ' ' + (p.body || '') + ' ' + p.user).toLowerCase().includes(kw));
        if (onlyHidden) rows = rows.filter(p => hiddenSet.has(String(p.id)));
        const total = rows.length;
        const items = rows.slice((page - 1) * pageSize, page * pageSize).map(p => Object.assign({}, p, {
          hidden: hiddenSet.has(String(p.id)),
          comments: Number((get('SELECT COUNT(*) AS n FROM comments WHERE postId = ?', String(p.id)) || { n: 0 }).n)
        }));
        return { items, total, page, pageSize };
      }

      if (method === 'POST' && U === 'posts' && parts.length >= 4) {
        const pid = String(parts[2]);
        const act = String(parts[3]);
        const post = allPosts(true).find(p => String(p.id) === pid);
        if (!post) fail('not_found', 'missing');
        if (act === 'delete') {
          run('UPDATE posts SET deleted = 1 WHERE id = ?', pid);
          run('DELETE FROM comments WHERE postId = ?', pid);
          run('DELETE FROM likes WHERE postId = ?', pid);
          if (post.userId && post.userId !== admin.id) {
            pushNotif({ to: post.userId, type: 'postHidden', from: admin.name, fromId: admin.id, href: 'community.html' });
          }
          return { ok: true, id: pid, deleted: true };
        }
        if (act === 'restore') {
          run("DELETE FROM hidden WHERE kind = 'post' AND id = ?", pid);
          return { ok: true, id: pid, hidden: false };
        }
      }

      if (method === 'GET' && U === 'games') {
        const kw = str(q.q).toLowerCase();
        const onlyDown = str(q.down) === '1';
        const page = num(q.page, 1, 1, 1e6);
        const pageSize = num(q.pageSize, 20, 5, 100);
        let rows = world.games.map(g => ({
          id: g.id, title: S.titleOf(g, lang) || g.title, author: g.author || '',
          maker: g.maker || '', source: g.source || '', takedown: !!g.takedown,
          score: g.score, plays: g.plays || 0, packStatus: g.packStatus || '',
          editable: !g.packStatus
        }));
        if (kw) rows = rows.filter(r => (r.title + ' ' + r.author + ' ' + r.id).toLowerCase().includes(kw));
        if (onlyDown) rows = rows.filter(r => r.takedown);
        const total = rows.length;
        return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, sources: GAME_SOURCES };
      }

      /* 指派目录游戏的来源（只改署名来源；封面出处 origin 不动） */
      if (method === 'POST' && U === 'games' && parts.length === 3) {
        const gid = String(parts[2]);
        if (!get('SELECT id FROM games WHERE id = ?', gid)) fail('not_found', 'missing');
        const source = b.source == null ? '' : str(b.source);
        if (!GAME_SOURCES.includes(source)) fail('invalid', 'source');
        run('UPDATE games SET source = ? WHERE id = ?', source, gid);
        return { ok: true, id: gid, source };
      }

      if (method === 'POST' && U === 'games' && parts.length >= 4 && String(parts[3]) === 'restore') {
        const gid = String(parts[2]);
        const g = world.games.find(x => String(x.id) === gid);
        if (!g) fail('not_found', 'missing');
        run("DELETE FROM hidden WHERE kind = 'game' AND id = ?", gid);
        const pack = get('SELECT * FROM packs WHERE id = ?', gid);
        if (pack && pack.status === 'unlisted' && pack.vis === 'public') {
          run('UPDATE packs SET status = ? WHERE id = ?', 'listed', gid);
          syncPackFlag(gid);
          pushNotif({ to: pack.ownerId, type: 'packOn', from: admin.name, fromId: admin.id, title: pack.title, href: 'game-detail.html?id=' + encodeURIComponent(gid) });
        }
        return { ok: true, id: gid, takedown: false };
      }

      fail('not_found', 'route');
    }

    fail('not_found', 'route');
  }

  return { handle, HttpError, publicUser, isAdmin, isReviewer, userByAny, userById };
}

module.exports = { createApi, HttpError, STATUS };
