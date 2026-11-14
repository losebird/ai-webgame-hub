'use strict';
/* 即玩空间后端入口：HTTP + CORS(带 credentials) + Cookie 会话。
   默认监听 127.0.0.1:8787；前端用 server/static.js 在 :5500 起静态站。 */
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { openDb } = require('./db');
const { createApi, HttpError } = require('./api');

const PORT = Number(process.env.JIWAN_PORT || 8787);
const HOST = process.env.JIWAN_HOST || '127.0.0.1';
const ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const COOKIE = 'jiwan_sid';
const MAX_BODY = 8 * 1024 * 1024;

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(pair => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

function json(res, status, data, extraHeaders) {
  const body = JSON.stringify(data == null ? {} : data);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  }, extraHeaders || {}));
  res.end(body);
}

function createApp(options) {
  const opts = options || {};
  const db = opts.db || openDb();
  /* 数据全在库里的 games 表；空库说明还没跑过 server/migrate.js */
  const hasGames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='games'").get();
  if (!hasGames || !db.prepare('SELECT COUNT(*) AS n FROM games').get().n) {
    const e = new Error('games 表为空：先执行 `node server/migrate.js` 导入数据');
    e.code = 'EMPTY_DB';
    throw e;
  }

  const sessions = {
    create(userId) {
      const sid = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (sid, userId, at) VALUES (?,?,?)').run(sid, userId, Date.now());
      return sid;
    },
    user(sid) {
      if (!sid) return null;
      const row = db.prepare('SELECT s.userId AS userId FROM sessions s WHERE s.sid = ?').get(sid);
      if (!row) return null;
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(row.userId) || null;
      /* 被禁用的账号立即失效：会话还在，但不再算登录 */
      if (u && u.disabled) return null;
      return u;
    },
    remove(sid) {
      if (sid) db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    }
  };

  const api = createApi({
    db,
    onLogin(ctx, userId) {
      ctx.sid = sessions.create(userId);
      ctx.res.setHeader('Set-Cookie', `${COOKIE}=${ctx.sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
    },
    onLogout(ctx) {
      sessions.remove(ctx.sid);
      ctx.res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    }
  });

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin || '';
    const cors = ORIGIN_RE.test(origin) ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin'
    } : {};

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/health') {
      json(res, 200, { ok: true, at: Date.now() }, cors);
      return;
    }

    const sid = parseCookies(req.headers.cookie)[COOKIE] || '';
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      let body = {};
      if (chunks.length) {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { body = raw ? JSON.parse(raw) : {}; }
        catch (e) { json(res, 400, { code: 'invalid', message: 'bad_json' }, cors); return; }
      }
      const parts = url.pathname.split('/').filter(Boolean).map(s => {
        try { return decodeURIComponent(s); } catch (e) { return s; }
      });
      const query = Object.fromEntries(url.searchParams.entries());
      const ctx = {
        method: req.method,
        parts, query, body,
        sid,
        user: sessions.user(sid),
        res
      };
      try {
        const data = api.handle(ctx);
        json(res, 200, data, cors);
      } catch (err) {
        if (err instanceof HttpError) {
          json(res, err.status, { code: err.code, message: err.message }, cors);
          return;
        }
        console.error('[api]', err && err.stack ? err.stack : err);
        json(res, 500, { code: 'server', message: 'internal' }, cors);
      }
    });
  });

  return { server, db, api, sessions };
}

if (require.main === module) {
  const { server } = createApp();
  server.listen(PORT, HOST, () => {
    console.log(`[jiwan] api http://${HOST}:${PORT}`);
  });
}

module.exports = { createApp, PORT, HOST };
