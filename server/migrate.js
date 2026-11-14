'use strict';
/*
 * 一次性数据导入：把历史上放在 assets/jiwan-catalog.js 里的数据写进 SQLite。
 * 运行时（server/index.js → api.js → store.js）只读库，不再读这个 JS。
 *
 *   node server/migrate.js            # 导入到 server/data/jiwan.db
 *   JIWAN_DB=/tmp/x.db node server/migrate.js
 *
 * 可重复执行：games / topics 按 id upsert；用户、帖子、种子评价只在缺失时补。
 */
const { openDb, unusablePassHash, slug } = require('./db');

const PLACEHOLDER_AUTHOR = 'fable52.games';

/* 目录里少数条目把 IP 方或托管方写进了 author，这里按事实拆开：
   署名（author）为空 = 没有可考的创作者；maker = 谁生成的；source = 从哪来。 */
const CREDIT_FIX = {
  'feiche-3d': { source: '腾讯（IP）', maker: '' },
  'transport-ship': { source: '腾讯（IP）', maker: '' },
  'pelican-bike': { source: '字节 CDN', maker: 'Fable 5.2' }
};

function resolveCredit(g) {
  const raw = String(g.author || '').trim();
  if (raw && raw !== PLACEHOLDER_AUTHOR) {
    const source = g.origin === 'x' ? 'X' : (g.origin === 'claudegaming' ? 'Claude Gaming' : '');
    return { author: raw, maker: '', source };
  }
  if (CREDIT_FIX[g.id]) return Object.assign({ author: '' }, CREDIT_FIX[g.id]);
  return { author: '', maker: g.fable ? 'Fable 5.2' : '', source: 'fable52.games' };
}

const json = v => JSON.stringify(v == null ? [] : v);
const bool = v => (v ? 1 : 0);

function ensureColumns(db) {
  const cols = db.prepare('PRAGMA table_info(reviews)').all().map(r => r.name);
  if (!cols.includes('seed')) db.exec('ALTER TABLE reviews ADD COLUMN seed INTEGER NOT NULL DEFAULT 0');
  const gcols = db.prepare('PRAGMA table_info(games)').all().map(r => r.name);
  if (!gcols.includes('maker')) db.exec("ALTER TABLE games ADD COLUMN maker TEXT NOT NULL DEFAULT ''");
  if (!gcols.includes('source')) db.exec("ALTER TABLE games ADD COLUMN source TEXT NOT NULL DEFAULT ''");
  if (!gcols.includes('banner_en')) db.exec("ALTER TABLE games ADD COLUMN banner_en TEXT NOT NULL DEFAULT ''");
}

function importGames(db, J) {
  const EN = J.__en || {};
  const PY = J.__py || {};
  const up = db.prepare(`INSERT OR REPLACE INTO games
    (id,title,title_en,pinyin,author,maker,source,score,players,plays,year,cat,tags,hue,chroma,play,src,
     demo,fable,hot,neu,featured,pick,wide,duration,origin,banner,blurb,blurb_en,about,about_en,poster,
     banner_en,pw,ph,pos,shots,shotSize,dist,ord,at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const now = Date.now();
  J.GAMES.forEach((g, i) => {
    const credit = resolveCredit(g);
    const en = EN[g.id] || [];
    const tags = Array.isArray(g.tags) ? g.tags : [];
    up.run(
      g.id,
      g.title || g.id,
      en[0] || '',
      PY[g.id] || '',
      credit.author,
      credit.maker,
      credit.source,
      g.score == null ? null : Number(g.score),
      g.players == null ? '' : String(g.players),
      Number(g.plays) || 0,
      g.year == null ? null : Number(g.year),
      g.cat || 'story',
      json(tags),
      Number(g.hue) || 70,
      g.chroma == null ? 0.1 : Number(g.chroma),
      g.play || 'story',
      g.src || '',
      bool(g.demo), bool(g.fable), bool(g.hot), bool(g.neu),
      bool(g.featured), bool(g.pick), bool(g.wide),
      g.duration || 'mid',
      g.origin || '',
      g.banner || '',
      g.blurb || '',
      en[1] || '',
      g.about || '',
      en[2] || '',
      en[3] || '',
      g.poster || '',
      Number(g.pw) || 960,
      Number(g.ph) || 540,
      g.pos || 'center',
      json(g.shots),
      json(g.shotSize),
      json(g.dist || [0, 0, 0, 0, 0]),
      i,
      now
    );
  });
  return J.GAMES.length;
}

function importTopics(db, J) {
  const up = db.prepare('INSERT OR REPLACE INTO topics (id,name,hint,ord,count) VALUES (?,?,?,?,?)');
  (J.TOPICS || []).forEach((tp, i) => up.run(tp.id, tp.name || tp.id, tp.hint || '', i, Number(tp.count) || 0));
  return (J.TOPICS || []).length;
}

function importUsers(db, J) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO users (id, name, handle, pass_hash, bio, game, avatar, role, at) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  const has = db.prepare('SELECT id FROM users WHERE id = ? OR name = ?');
  const now = Date.now();
  const add = (id, name, bio, game, role) => {
    const clean = String(name || '').trim();
    if (!clean || clean === PLACEHOLDER_AUTHOR) return false;
    const uid = id || slug(clean);
    if (has.get(uid, clean)) return false;
    insert.run(uid, clean, uid, unusablePassHash(), bio || '', game || '', '', role || '', now);
    return true;
  };
  let n = 0;
  (J.AUTHORS || []).forEach(a => { if (add(a.id || slug(a.name), a.name, a.note, a.game, a.id === 'lincheng' ? 'reviewer' : '')) n++; });
  if (add('lincheng', '林澄', '夜航港', 'night-port', 'reviewer')) n++;
  if (add('heyu', '何予', '港口调度', 'harbor', '')) n++;
  J.GAMES.forEach(g => {
    const credit = resolveCredit(g);
    if (credit.author && add(null, credit.author, '', g.id, '')) n++;
  });
  /* 平台名不该是账号（历史误种），顺手清掉 */
  const bogus = db.prepare('SELECT id FROM users WHERE name = ?').get(PLACEHOLDER_AUTHOR);
  if (bogus) {
    db.prepare('DELETE FROM users WHERE id = ?').run(bogus.id);
    db.prepare('DELETE FROM follows WHERE userId = ? OR targetId = ?').run(bogus.id, bogus.id);
    db.prepare('DELETE FROM favs WHERE userId = ?').run(bogus.id);
    db.prepare('DELETE FROM history WHERE userId = ?').run(bogus.id);
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(bogus.id);
    n--;
  }
  return n;
}

function importPosts(db, J) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO posts (id, userId, user, game, title, body, likes, time, at, deleted) VALUES (?,?,?,?,?,?,?,?,?,0)'
  );
  const fixAt = db.prepare('UPDATE posts SET at = ? WHERE id = ? AND userId = ?');
  const findUser = db.prepare('SELECT id FROM users WHERE name = ? OR id = ?');
  const now = Date.now();
  const list = J.POSTS || [];
  let n = 0;
  /* 目录顺序 = 从新到旧，at 按索引递减，这样 ORDER BY at DESC 就是原来的顺序 */
  list.forEach((p, i) => {
    const u = findUser.get(p.user, slug(p.user));
    const uidv = u ? u.id : slug(p.user);
    const at = now - i * 3600000;
    const r = insert.run(String(p.id), uidv, p.user, p.game || '', p.title, p.body || '', Number(p.likes) || 0, p.time || '', at);
    if (r.changes) n++;
    else fixAt.run(at, String(p.id), uidv);
  });
  return n;
}

function importSeedReviews(db, J) {
  const up = db.prepare(`INSERT OR REPLACE INTO reviews
    (id,gameId,userId,name,s,score,t,at,deleted,seed) VALUES (?,?,?,?,?,?,?,?,0,1)`);
  const findUser = db.prepare('SELECT id FROM users WHERE name = ? OR id = ?');
  let n = 0;
  J.GAMES.forEach(g => {
    (g.reviews || []).forEach((r, i) => {
      const u = findUser.get(r.u, slug(r.u));
      up.run(`seed-${g.id}-${i}`, g.id, u ? u.id : slug(r.u), r.u, r.s || '好评',
        typeof r.score === 'number' ? r.score : null, r.t || '', Date.now() - i * 60000);
      n++;
    });
  });
  return n;
}

/* 分给工坊的目录游戏：挑「作者就是站内账号」的条目，与 packs 同 id 建过审上架包。
   游戏本体留在 games 表，封面/评分/标签全保留；world 合并时优先用游戏行，packToGame 不再兜底。 */
const WORKSHOP_ASSIGNED = ['harbor', 'night-port', 'lift', 'warm-toy-room'];
function assignWorkshop(db) {
  const findUser = db.prepare('SELECT id, name FROM users WHERE name = ? OR id = ?');
  const upPack = db.prepare(`INSERT OR REPLACE INTO packs
    (id, ownerId, title, author, blurb, cat, tags, vis, file, cover, coverData, playUrl, status, reason, at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const setGame = db.prepare('UPDATE games SET packStatus = ?, ownerId = ? WHERE id = ?');
  let n = 0;
  const now = Date.now();
  WORKSHOP_ASSIGNED.forEach((id, i) => {
    const g = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!g) return;
    const u = findUser.get(g.author, g.author);
    if (!u) return;
    let tags = '';
    try { const t = JSON.parse(g.tags || '[]'); if (Array.isArray(t)) tags = t.join('、'); } catch (e) { /* 保持空 */ }
    upPack.run(id, u.id, g.title, g.author, g.blurb || g.about || '', g.cat || 'story', tags,
      'public', '', g.poster || '', '', g.src || '', 'listed', '', now - (i + 1) * 86400000);
    setGame.run('listed', u.id, id);
    n += 1;
  });
  return n;
}

function bootstrapDemo(db) {
  if (db.prepare('SELECT v FROM meta WHERE k = ?').get('bootstrapped')) return 0;
  const now = Date.now();
  db.prepare(`INSERT OR IGNORE INTO packs (id, ownerId, title, author, blurb, cat, tags, vis, file, cover, coverData, playUrl, status, reason, at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('pack-seed-tide', 'heyu', '潮汐回廊', '何予', '港口调度的续作草稿。灯塔按潮位开关。',
      'story', '工坊、叙事', 'public', 'tide-corridor.zip', '', '', '', 'pending', '', now - 86400000);
  db.prepare('INSERT OR IGNORE INTO comments (id,postId,userId,name,text,time,at) VALUES (?,?,?,?,?,?,?)')
    .run('c-seed-1', '5', 'heyu', '何予', '一盏一盏关，这个节奏对。', '昨天', now - 86400000);
  db.prepare('INSERT OR IGNORE INTO comments (id,postId,userId,name,text,time,at) VALUES (?,?,?,?,?,?,?)')
    .run('c-seed-2', '6', 'lincheng', '林澄', '贴上来之前先看体型。', '2 小时前', now - 7200000);
  const follow = db.prepare('INSERT OR IGNORE INTO follows (userId, targetId, at) VALUES (?,?,?)');
  follow.run('lincheng', 'heyu', now); follow.run('heyu', 'lincheng', now);
  const fav = db.prepare('INSERT OR IGNORE INTO favs (userId, gameId, at) VALUES (?,?,?)');
  ['night-port', 'cookie-clicker'].forEach(id => fav.run('lincheng', id, now));
  ['harbor', 'last-light'].forEach(id => fav.run('heyu', id, now));
  const hist = db.prepare('INSERT OR IGNORE INTO history (userId, gameId, at) VALUES (?,?,?)');
  [
    ['lincheng', 'night-port', now - 172800000],
    ['lincheng', 'cookie-clicker', now - 86400000],
    ['lincheng', 'a-dark-room', now - 28800000],
    ['heyu', 'harbor', now - 259200000],
    ['heyu', 'last-light', now - 18000000],
    ['heyu', 'saltline', now - 3600000]
  ].forEach(r => hist.run(r[0], r[1], r[2]));
  db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').run('bootstrapped', new Date(now).toISOString());
  return 1;
}

function runImport(db, J) {
  ensureColumns(db);
  const r = {
    games: importGames(db, J),
    topics: importTopics(db, J),
    users: importUsers(db, J),
    posts: importPosts(db, J),
    reviews: importSeedReviews(db, J),
    assigned: assignWorkshop(db),
    demo: bootstrapDemo(db)
  };
  db.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run('seeded', new Date().toISOString());
  return r;
}

module.exports = { runImport, resolveCredit, PLACEHOLDER_AUTHOR, assignWorkshop, WORKSHOP_ASSIGNED };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error([
      '用法：node server/migrate.js <历史目录文件>',
      '',
      '数据已经全部在 SQLite 里了（games/topics/users/posts/reviews），运行时不再读静态目录。',
      '这个脚本只在需要从旧的 assets/jiwan-catalog.js 一次性导入（或重建库）时使用：',
      '  node server/migrate.js ./legacy-catalog.js',
      '空库启动时 server/index.js 会直接报错提醒。'
    ].join('\n'));
    process.exit(1);
  }
  const fs = require('node:fs');
  if (!fs.existsSync(file)) {
    console.error('找不到目录文件：' + file);
    process.exit(1);
  }
  const { loadCatalog } = require('./catalog');
  const db = openDb();
  const J = loadCatalog(file);
  const r = runImport(db, J);
  const counts = {};
  ['games', 'topics', 'users', 'posts', 'reviews', 'packs'].forEach(t => {
    counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  });
  console.log('导入完成:', r, '\n库内行数:', counts);
}
