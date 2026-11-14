'use strict';
/*
 * 游戏数据访问层：唯一来源是 SQLite 的 games / topics 表。
 * 这里重写了原来 assets/jiwan-catalog.js 里的筛选、排序、榜单权重、搜索匹配，
 * 保证同一份语义，但不再有任何静态数据。
 */

function rowToGame(r) {
  const arr = v => {
    if (Array.isArray(v)) return v;
    try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; }
  };
  return {
    id: r.id,
    title: r.title,
    title_en: r.title_en || '',
    pinyin: r.pinyin || '',
    author: r.author || '',
    maker: r.maker || '',
    source: r.source || '',
    score: r.score == null ? null : Number(r.score),
    players: r.players || '',
    plays: Number(r.plays) || 0,
    year: r.year == null ? null : Number(r.year),
    cat: r.cat || 'story',
    tags: arr(r.tags),
    hue: Number(r.hue) || 70,
    chroma: r.chroma == null ? 0.1 : Number(r.chroma),
    play: r.play || 'story',
    src: r.src || '',
    embed: r.embed == null ? true : !!Number(r.embed),
    demo: !!r.demo,
    fable: !!r.fable,
    hot: !!r.hot,
    neu: !!r.neu,
    featured: !!r.featured,
    pick: !!r.pick,
    wide: !!r.wide,
    duration: r.duration || 'mid',
    origin: r.origin || '',
    banner: r.banner || '',
    banner_en: r.banner_en || '',
    blurb: r.blurb || '',
    blurb_en: r.blurb_en || '',
    about: r.about || '',
    about_en: r.about_en || '',
    poster: r.poster || '',
    pw: Number(r.pw) || 960,
    ph: Number(r.ph) || 540,
    pos: r.pos || 'center',
    shots: arr(r.shots),
    shotSize: arr(r.shotSize),
    dist: arr(r.dist).length ? arr(r.dist) : [0, 0, 0, 0, 0],
    packStatus: r.packStatus || '',
    ownerId: r.ownerId || '',
    reviews: [],
    takedown: false
  };
}

function loadGames(db) {
  return db.prepare('SELECT * FROM games ORDER BY ord ASC, id ASC').all().map(rowToGame);
}

function loadTopics(db) {
  return db.prepare('SELECT * FROM topics ORDER BY ord ASC, id ASC')
    .all()
    .map(t => ({ id: t.id, name: t.name || t.id, hint: t.hint || '', count: Number(t.count) || 0 }));
}

const collator = { zh: new Intl.Collator('zh'), en: new Intl.Collator('en') };
function titleOf(g, lang) { return (lang === 'en' && g.title_en) ? g.title_en : g.title || ''; }
function byTitle(lang) {
  const c = collator[lang === 'en' ? 'en' : 'zh'];
  return (a, b) => c.compare(titleOf(a, lang), titleOf(b, lang));
}

function parsePlayers(g) {
  const extra = Number(g && g.plays) || 0;
  const s = String((g && g.players) || '');
  if (/上架/.test(s) || /listed/i.test(s)) return extra;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return extra;
  if (/万/.test(s)) return n * 10000 + extra;
  if (/千/.test(s)) return n * 1000 + extra;
  if (/k\b/i.test(s)) return n * 1000 + extra;
  return n + extra;
}

function livePlayers(g) {
  const base = parsePlayers(g);
  const slot = Math.floor(Date.now() / 7000);
  const key = String((g && g.id) || '') + ':' + slot;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) | 0;
  const amp = base >= 10000
    ? Math.max(1200, Math.round(base * 0.0035))
    : Math.max(2, Math.round(Math.max(base, 8) * 0.08));
  const tick = (Math.abs(h) % (amp * 2 + 1)) - amp;
  return Math.max(0, base + tick);
}

function formatPlayers(n) {
  if (!n) return '本周上架';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万在玩';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '千在玩';
  return String(Math.round(n)) + '在玩';
}
function playerLine(g) { return formatPlayers(livePlayers(g)); }

function editDist(a, b) {
  a = String(a || '').toLowerCase();
  b = String(b || '').toLowerCase();
  if (!a || !b) return 99;
  if (Math.abs(a.length - b.length) > 4) return 99;
  const m = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array(b.length + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

function matchesQuery(g, q, lang) {
  if (!q) return true;
  const s = String(q).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return true;
  const blob = [
    g.title, g.title_en, g.author, g.maker, g.source,
    (g.tags || []).join(' '), g.blurb, g.blurb_en, g.pinyin, g.src
  ].join(' ').toLowerCase();
  if (blob.includes(String(q).trim().toLowerCase())) return true;
  return blob.replace(/\s+/g, '').includes(s);
}

function suggestQuery(list, q) {
  const s = String(q || '').trim();
  if (s.length < 2) return '';
  let best = '', score = 99;
  (list || []).forEach(g => {
    [g.title, g.title_en, g.author, g.maker].forEach(label => {
      const t0 = String(label || '');
      if (!t0) return;
      const d = editDist(s, t0);
      if (d < score && d > 0 && d <= 3) { score = d; best = t0; }
    });
  });
  return best;
}

function filterGames(list, { genre = 'all', duration = 'all', fable = 'all', q = '', tag = '', source = '' } = {}) {
  return (list || []).filter(g => {
    if (g.takedown) return false;
    if (source === 'workshop' && g.packStatus !== 'listed') return false;
    if (genre === 'io') { if (!(g.tags || []).includes('IO')) return false; }
    else if (genre !== 'all' && g.cat !== genre) return false;
    if (duration !== 'all' && g.duration !== duration) return false;
    if (fable === 'workshop' && !g.fable) return false;
    if (fable === 'curated' && g.fable) return false;
    if (tag && !(g.tags || []).includes(tag)) return false;
    if (!matchesQuery(g, q)) return false;
    return true;
  });
}

function sortGames(list, sort = 'hot', lang = 'zh') {
  const arr = (list || []).slice();
  const by = byTitle(lang);
  if (sort === 'new') return arr.sort((a, b) => ((b.year || 0) - (a.year || 0)) || ((b.neu ? 1 : 0) - (a.neu ? 1 : 0)) || by(a, b));
  if (sort === 'score') return arr.sort((a, b) => ((b.score || 0) - (a.score || 0)) || by(a, b));
  return arr.sort((a, b) => {
    const ha = (a.hot ? 1 : 0) - (b.hot ? 1 : 0);
    if (ha) return -ha;
    return parsePlayers(b) - parsePlayers(a);
  });
}

function rankWeight(g, tab, period) {
  const plays = parsePlayers(g);
  const score = g.score || 0;
  const fresh = !!g.neu || (g.year || 0) >= 2026;
  const hot = !!g.hot;
  const y2026 = (g.year || 0) >= 2026 ? 1 : 0;
  if (tab === 'hot') {
    if (period === 'day') return (hot ? 800 : 0) + (fresh ? 400 : 0) + y2026 * 300 + plays * 0.25;
    if (period === 'week') return (hot ? 400 : 0) + (fresh ? 500 : 0) + y2026 * 150 + plays * 0.55;
    return plays;
  }
  if (tab === 'new') {
    const recency = (g.year || 0) + (g.neu ? 0.5 : 0) + (g.featured ? 0.2 : 0);
    if (period === 'day') return recency * 20 + (hot ? 4 : 0) + (g.featured ? 6 : 0);
    if (period === 'week') return recency * 20 + (g.neu ? 8 : 0);
    return recency * 20 + score;
  }
  if (period === 'day') return score * 20 + (hot ? 6 : 0) + (fresh ? 3 : 0);
  if (period === 'week') return score * 20 + (fresh ? 4 : 0) + (g.reviews ? g.reviews.length : 0);
  return score * 20;
}

function rankFull(list, tab, period, lang = 'zh') {
  let pool = (list || []).filter(g => !g.takedown);
  if (tab === 'new') pool = pool.filter(g => g.neu || (g.year || 0) >= 2023);
  const by = byTitle(lang);
  return pool.sort((a, b) => {
    const d = rankWeight(b, tab, period) - rankWeight(a, tab, period);
    return d !== 0 ? d : by(a, b);
  });
}

function rankList(list, tab, period, n = 10, lang = 'zh') {
  return rankFull(list, tab, period, lang).slice(0, n);
}

function rankIndexMap(list, tab, period, lang = 'zh') {
  const map = Object.create(null);
  rankFull(list, tab, period, lang).forEach((g, i) => { map[g.id] = i + 1; });
  return map;
}

module.exports = {
  rowToGame, loadGames, loadTopics,
  filterGames, sortGames, rankFull, rankList, rankIndexMap,
  matchesQuery, suggestQuery, parsePlayers, livePlayers, playerLine, formatPlayers,
  titleOf, byTitle
};
