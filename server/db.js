'use strict';
/* SQLite 存储层：只负责建表与连接。数据由 server/migrate.js 一次性导入，运行时一律读库。 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_DB = path.join(__dirname, 'data', 'jiwan.db');
/* 干净的演示基线（迁移产物）。测试从它取快照，这样 dev.db 被手动试玩改脏也不影响验收。 */
const SEED_DB = path.join(__dirname, 'data', 'seed.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  pinyin TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  maker TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  score REAL,
  players TEXT NOT NULL DEFAULT '',
  plays INTEGER NOT NULL DEFAULT 0,
  year INTEGER,
  cat TEXT NOT NULL DEFAULT 'story',
  tags TEXT NOT NULL DEFAULT '[]',
  hue INTEGER NOT NULL DEFAULT 70,
  chroma REAL NOT NULL DEFAULT 0.1,
  play TEXT NOT NULL DEFAULT 'story',
  src TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0,
  fable INTEGER NOT NULL DEFAULT 0,
  hot INTEGER NOT NULL DEFAULT 0,
  neu INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  pick INTEGER NOT NULL DEFAULT 0,
  wide INTEGER NOT NULL DEFAULT 0,
  duration TEXT NOT NULL DEFAULT 'mid',
  origin TEXT NOT NULL DEFAULT '',
  banner TEXT NOT NULL DEFAULT '',
  banner_en TEXT NOT NULL DEFAULT '',
  blurb TEXT NOT NULL DEFAULT '',
  blurb_en TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  about_en TEXT NOT NULL DEFAULT '',
  poster TEXT NOT NULL DEFAULT '',
  pw INTEGER NOT NULL DEFAULT 960,
  ph INTEGER NOT NULL DEFAULT 540,
  pos TEXT NOT NULL DEFAULT 'center',
  shots TEXT NOT NULL DEFAULT '[]',
  shotSize TEXT NOT NULL DEFAULT '[]',
  dist TEXT NOT NULL DEFAULT '[0,0,0,0,0]',
  packStatus TEXT NOT NULL DEFAULT '',
  ownerId TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS games_ord ON games(ord);
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', hint TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  game TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS users_name ON users(name);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY, userId TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, user TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  likes INTEGER NOT NULL DEFAULT 0, time TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS posts_at ON posts(at DESC);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, postId TEXT NOT NULL, userId TEXT NOT NULL, name TEXT NOT NULL,
  text TEXT NOT NULL, time TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS likes (
  userId TEXT NOT NULL, postId TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (userId, postId)
);
CREATE TABLE IF NOT EXISTS favs (
  userId TEXT NOT NULL, gameId TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (userId, gameId)
);
CREATE TABLE IF NOT EXISTS follows (
  userId TEXT NOT NULL, targetId TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (userId, targetId)
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, gameId TEXT NOT NULL, userId TEXT NOT NULL, name TEXT NOT NULL,
  s TEXT NOT NULL DEFAULT '好评', score INTEGER, t TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0,
  seed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '',
  blurb TEXT NOT NULL DEFAULT '', cat TEXT NOT NULL DEFAULT 'story', tags TEXT NOT NULL DEFAULT '',
  vis TEXT NOT NULL DEFAULT 'public', file TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '',
  coverData TEXT NOT NULL DEFAULT '', playUrl TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
  reason TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS plays (gameId TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS history (
  userId TEXT NOT NULL, gameId TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (userId, gameId)
);
CREATE TABLE IF NOT EXISTS notifs (
  id TEXT PRIMARY KEY, toId TEXT NOT NULL, type TEXT NOT NULL,
  fromName TEXT NOT NULL DEFAULT '', fromId TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS notifs_to ON notifs(toId, at DESC);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL,
  userId TEXT NOT NULL, at INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS hidden (kind TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (kind, id));
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`;

/* 与 src/util.js 保持同一格式与迭代次数：pbkdf2$sha256$<iters>$<salt_hex>$<dk_hex> */
const MIN_PASS_LENGTH = 10;
const PASS_ITERS = 10000;
const PASS_MAX_ITERS = 20000;
const PASS_SALT_BYTES = 16;
const PASS_DK_BYTES = 32;

function toHex(buf) {
  return Buffer.from(buf).toString('hex');
}

function parsePassHash(stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 5) return null;
  if (parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return null;
  const iters = Number(parts[2]);
  if (!Number.isInteger(iters) || iters < 1 || iters > PASS_MAX_ITERS) return null;
  if (!/^[0-9a-fA-F]+$/.test(parts[3]) || !/^[0-9a-fA-F]+$/.test(parts[4])) return null;
  const salt = Buffer.from(parts[3], 'hex');
  const dk = Buffer.from(parts[4], 'hex');
  if (salt.length !== PASS_SALT_BYTES || dk.length !== PASS_DK_BYTES) return null;
  return { iters, salt, dk };
}

function formatPassHash(iters, salt, dk) {
  return 'pbkdf2$sha256$' + iters + '$' + toHex(salt) + '$' + toHex(dk);
}

function hashPass(pass, opts) {
  const iters = opts && opts.iters != null ? opts.iters : PASS_ITERS;
  const salt = opts && opts.salt ? Buffer.from(opts.salt) : crypto.randomBytes(PASS_SALT_BYTES);
  const dk = crypto.pbkdf2Sync(String(pass || ''), salt, iters, PASS_DK_BYTES, 'sha256');
  return formatPassHash(iters, salt, dk);
}

const DUMMY_SALT = Buffer.alloc(PASS_SALT_BYTES);
const DUMMY_PASS_HASH = formatPassHash(PASS_ITERS, DUMMY_SALT, Buffer.alloc(PASS_DK_BYTES));

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  const len = Math.max(ba.length, bb.length, 1);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  ba.copy(pa);
  bb.copy(pb);
  let diff = ba.length ^ bb.length;
  if (crypto.timingSafeEqual(pa, pb)) {
    /* 内容相等，仍要把长度差算进去 */
  } else {
    diff |= 1;
  }
  return diff === 0;
}

function verifyPass(pass, stored) {
  const parsed = parsePassHash(stored);
  const iters = parsed ? parsed.iters : PASS_ITERS;
  const salt = parsed ? parsed.salt : DUMMY_SALT;
  const fresh = hashPass(pass, { iters, salt });
  const target = parsed ? formatPassHash(parsed.iters, parsed.salt, parsed.dk) : DUMMY_PASS_HASH;
  const ok = timingSafeEqualStr(fresh, target);
  return !!(parsed && ok);
}

function unusablePassHash() {
  return hashPass(crypto.randomBytes(32).toString('hex'));
}

function applyTestPasswords(db, pass) {
  const rows = db.prepare('SELECT id FROM users').all();
  const up = db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    for (const r of rows) up.run(hashPass(pass), r.id);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) {}
    throw err;
  }
}

function slug(s) {
  return String(s || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .slice(0, 24) || 'u';
}

/* 旧库补列：只处理「新增字段」这类无害变更，幂等 */
function ensureColumns(db) {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(r => r.name);
  if (!cols.includes('disabled')) db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
  /* 工坊指派：目录游戏可直接升级为「用户上架」的工坊作品（与 packs 同 id），games 侧记录状态与归属 */
  const gcols = db.prepare('PRAGMA table_info(games)').all().map(r => r.name);
  if (!gcols.includes('packStatus')) db.exec("ALTER TABLE games ADD COLUMN packStatus TEXT NOT NULL DEFAULT ''");
  if (!gcols.includes('ownerId')) db.exec("ALTER TABLE games ADD COLUMN ownerId TEXT NOT NULL DEFAULT ''");
  /* src 能否嵌进 iframe：1 站内打开，0 只给「去原页玩」（与 migrations/0002 一致） */
  if (!gcols.includes('embed')) db.exec('ALTER TABLE games ADD COLUMN embed INTEGER NOT NULL DEFAULT 1');
}

/* 管理员账号：空库、老库、测试快照都要有。已存在则不动（不覆盖改过的密码）。
   新建时写入不可用随机哈希，不放入已知明文口令。 */
const ADMIN = { id: 'admin', name: '站务', handle: 'admin' };
function ensureAdmin(db) {
  const has = db.prepare('SELECT id FROM users WHERE id = ? OR name = ?').get(ADMIN.id, ADMIN.name);
  if (has) return has.id;
  db.prepare('INSERT INTO users (id, name, handle, pass_hash, bio, game, avatar, role, disabled, at) VALUES (?,?,?,?,?,?,?,?,0,?)')
    .run(ADMIN.id, ADMIN.name, ADMIN.handle, unusablePassHash(), '站内运营', '', '', 'admin', Date.now());
  return ADMIN.id;
}

function openDb(file) {
  const target = file || process.env.JIWAN_DB || DEFAULT_DB;
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  const db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  ensureColumns(db);
  ensureAdmin(db);
  return db;
}

module.exports = { openDb, hashPass, verifyPass, unusablePassHash, applyTestPasswords, slug, ensureAdmin, ADMIN, DEFAULT_DB, SEED_DB, MIN_PASS_LENGTH, PASS_ITERS, DUMMY_PASS_HASH };
