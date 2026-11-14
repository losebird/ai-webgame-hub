/* 即玩 Worker：同一 origin 提供静态页与 API，数据在 D1。 */
import { createApi, HttpError } from "../src/api.js";
import { createD1, isApiPath, hasFileExtension } from "../src/d1.js";
import { randomToken, timingSafeEqual } from "../src/util.js";

const COOKIE_SID = "jiwan_sid";
const COOKIE_CSRF = "jiwan_csrf";
const MAX_BODY = 8 * 1024 * 1024;
const SID_MAX_AGE = 30 * 24 * 3600;

function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((pair) => {
    const i = pair.indexOf("=");
    if (i < 0) return;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; }
  });
  return out;
}

function cookieFlags(url, { httpOnly }) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const http = httpOnly ? "; HttpOnly" : "";
  return `Path=/; SameSite=Lax${http}${secure}`;
}

function siteOrigin(request) {
  return new URL(request.url).origin;
}

function originMatches(request) {
  const origin = request.headers.get("Origin");
  return !!origin && origin === siteOrigin(request);
}

function isSafeMethod(method) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function corsHeaders(request) {
  if (!originMatches(request)) return {};
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin"),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  };
}

function jsonResponse(status, data, extra) {
  const body = JSON.stringify(data == null ? {} : data);
  const headers = extra instanceof Headers ? new Headers(extra) : new Headers(extra || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(body, { status, headers });
}

function withTiming(res, started) {
  const ms = Math.max(0, Date.now() - started);
  const headers = new Headers(res.headers);
  headers.set("Server-Timing", "app;dur=" + ms);
  headers.set("X-Jiwan-Elapsed-Ms", String(ms));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function appendCookie(headers, name, value, attrs) {
  headers.append("Set-Cookie", `${name}=${value}; ${attrs}`);
}

function ensureCsrf(cookies, url, headers) {
  let token = cookies[COOKIE_CSRF] || "";
  if (!token) {
    token = randomToken(32);
    appendCookie(headers, COOKIE_CSRF, token, cookieFlags(url, { httpOnly: false }) + `; Max-Age=${SID_MAX_AGE}`);
  }
  return token;
}

async function readBody(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) {
    const err = new Error("too_large");
    err.code = "too_large";
    throw err;
  }
  const text = await request.text();
  if (text.length > MAX_BODY) {
    const err = new Error("too_large");
    err.code = "too_large";
    throw err;
  }
  if (!text) return {};
  try { return JSON.parse(text); }
  catch (e) {
    const err = new Error("bad_json");
    err.code = "bad_json";
    throw err;
  }
}

function injectHtml(html) {
  const inject = "<script>window.JIWAN_API_BASE=window.JIWAN_API_BASE||'';</script>";
  return html.includes("</head>") ? html.replace("</head>", inject + "</head>") : inject + html;
}

async function serveAsset(request, env, url, cookies) {
  if (!env.ASSETS) {
    return new Response("assets binding missing", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  let assetReq = request;
  if (url.pathname === "/" || url.pathname.endsWith("/")) {
    const idx = new URL(request.url);
    if (url.pathname === "/") idx.pathname = "/index.html";
    else idx.pathname = url.pathname + "index.html";
    assetReq = new Request(idx.toString(), request);
  }
  const res = await env.ASSETS.fetch(assetReq);
  const headers = new Headers(res.headers);
  ensureCsrf(cookies, url, headers);
  const type = res.headers.get("Content-Type") || "";
  if (res.ok && type.includes("text/html")) {
    const html = injectHtml(await res.text());
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Length", String(new TextEncoder().encode(html).length));
    return new Response(html, { status: res.status, headers });
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function setSessionCookie(headers, url, sid) {
  if (sid) {
    appendCookie(headers, COOKIE_SID, sid, cookieFlags(url, { httpOnly: true }) + `; Max-Age=${SID_MAX_AGE}`);
  } else {
    appendCookie(headers, COOKIE_SID, "", cookieFlags(url, { httpOnly: true }) + "; Max-Age=0");
  }
}

async function handleApi(request, env, url, cookies) {
  const headersBase = { ...corsHeaders(request) };
  const outHeaders = new Headers(headersBase);
  ensureCsrf(cookies, url, outHeaders);

  if (!env.DB) {
    return jsonResponse(500, { code: "server", message: "missing_d1" }, outHeaders);
  }

  const db = createD1(env.DB);

  if (url.pathname === "/health" && request.method === "GET") {
    return jsonResponse(200, { ok: true, at: Date.now() }, outHeaders);
  }

  const empty = await db.get("SELECT COUNT(*) AS n FROM games");
  if (!empty || !Number(empty.n)) {
    return jsonResponse(500, {
      code: "EMPTY_DB",
      message: "games 表为空：先执行 npm run import:local 导入数据"
    }, outHeaders);
  }

  if (!isSafeMethod(request.method)) {
    if (!originMatches(request)) {
      return jsonResponse(403, { code: "forbidden", message: "origin" }, outHeaders);
    }
    const sent = request.headers.get("X-CSRF-Token") || "";
    if (!cookies[COOKIE_CSRF] || !timingSafeEqual(cookies[COOKIE_CSRF], sent)) {
      return jsonResponse(403, { code: "forbidden", message: "csrf" }, outHeaders);
    }
  }

  let body = {};
  if (request.method !== "GET" && request.method !== "HEAD") {
    try { body = await readBody(request); }
    catch (err) {
      if (err && err.code === "too_large") return jsonResponse(413, { code: "invalid", message: "too_large" }, outHeaders);
      return jsonResponse(400, { code: "invalid", message: "bad_json" }, outHeaders);
    }
  }

  const parts = url.pathname.split("/").filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  });
  const query = Object.fromEntries(url.searchParams.entries());
  const sid = cookies[COOKIE_SID] || "";

  const sessions = {
    async create(userId) {
      const id = crypto.randomUUID();
      await db.run("INSERT INTO sessions (sid, userId, at) VALUES (?,?,?)", id, userId, Date.now());
      return id;
    },
    async user(id) {
      if (!id) return null;
      const row = await db.get("SELECT s.userId AS userId FROM sessions s WHERE s.sid = ?", id);
      if (!row) return null;
      const u = await db.get("SELECT * FROM users WHERE id = ?", row.userId);
      if (u && u.disabled) return null;
      return u || null;
    },
    async remove(id) {
      if (id) await db.run("DELETE FROM sessions WHERE sid = ?", id);
    }
  };

  const ctx = {
    method: request.method,
    parts,
    query,
    body,
    sid,
    user: await sessions.user(sid),
    request,
    setSid: null
  };

  const api = createApi({
    db,
    async onLogin(c, userId) {
      c.sid = await sessions.create(userId);
      c.setSid = c.sid;
    },
    async onLogout(c) {
      await sessions.remove(c.sid);
      c.sid = "";
      c.setSid = "";
    }
  });

  try {
    const data = await api.handle(ctx);
    if (ctx.setSid !== null) setSessionCookie(outHeaders, url, ctx.setSid);
    const res = jsonResponse(200, data, outHeaders);
    return res;
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.status, { code: err.code, message: err.message }, outHeaders);
    }
    console.error("[api]", err && err.stack ? err.stack : err);
    return jsonResponse(500, { code: "server", message: "internal" }, outHeaders);
  }
}

export default {
  async fetch(request, env) {
    const started = Date.now();
    const url = new URL(request.url);
    const cookies = parseCookies(request.headers.get("Cookie"));

    if (request.method === "OPTIONS") {
      if (!originMatches(request)) {
        return withTiming(new Response(null, { status: 403 }), started);
      }
      return withTiming(new Response(null, { status: 204, headers: corsHeaders(request) }), started);
    }

    if (isApiPath(url.pathname)) {
      return withTiming(await handleApi(request, env, url, cookies), started);
    }

    const asset = await serveAsset(request, env, url, cookies);
    if (asset.status !== 404 || hasFileExtension(url.pathname) || url.pathname === "/" || url.pathname.endsWith("/")) {
      return withTiming(asset, started);
    }
    return withTiming(await handleApi(request, env, url, cookies), started);
  }
};
