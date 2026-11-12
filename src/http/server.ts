import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashPassword, validHandle, validPassword, verifyPassword } from "../auth.js";
import { coverSvg } from "../cover.js";
import {
  addReport,
  createUser,
  endSession,
  getGame,
  getHomepageLink,
  listChildren,
  listFeatured,
  listGames,
  listHomepageLinks,
  listReports,
  listTags,
  metrics,
  openDb,
  recordPlay,
  startSession,
  takedown,
  toggleLike,
  userByHandle,
  userFromSession,
  userLiked,
  type User,
} from "../db.js";
import { inlineBundle } from "../play/inline.js";
import { readBundle } from "../play/files.js";
import { publishUpload } from "../publish/save.js";
import { DEFAULT_LIMITS, type QuarantineLimits } from "../publish/gate.js";
import { seedIfEmpty } from "../seed.js";
import { ingestText, safeNext } from "../text.js";
import { parseMultipart, parseUrlEncoded } from "./form.js";
import { adminGate, adminPage, authPage, gamePage, homePage, policyPage, uploadPage } from "./pages.js";

const MAX_BODY = 34 * 1024 * 1024;
const PLAY_WINDOW_MS = 30 * 60 * 1000;
const REPORT_REASONS = new Set(["malware", "copyright", "sexual", "violence", "other"]);

const GALLERY_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "frame-src 'self'",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const GAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "worker-src blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export type AppOptions = {
  dataDir: string;
  adminToken: string;
  repoRoot: string;
  seed?: boolean;
  playWindowMs?: number;
  limits?: QuarantineLimits;
  now?: () => number;
};

export type App = {
  handle(request: Request): Promise<Response>;
  close(): void;
};

type Fields = { fields: Record<string, string>; files: Record<string, { filename: string; data: Buffer }> };

function loadSalt(dataDir: string): string {
  const file = path.join(dataDir, "ip.salt");
  try {
    return readFileSync(file, "utf8");
  } catch {
    const salt = randomBytes(16).toString("hex");
    writeFileSync(file, salt);
    return salt;
  }
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionCookie(id: string): string {
  return `sid=${encodeURIComponent(id)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;
}

function clearCookie(): string {
  return "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function html(body: string, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": GALLERY_CSP,
  });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(body, { status, headers });
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readFields(request: Request): Promise<Fields | null> {
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length > MAX_BODY) return null;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    return parseMultipart(buf, type) ?? { fields: {}, files: {} };
  }
  return { fields: parseUrlEncoded(buf), files: {} };
}

function authError(code: string | null): string | undefined {
  if (code === "credentials") return "Handle or password does not match.";
  if (code === "handle") return "Use 3 to 32 letters, numbers, underscores, or hyphens.";
  if (code === "password") return "Use a password of at least 8 characters.";
  if (code === "taken") return "That handle is taken.";
  return undefined;
}

export function createApp(opts: AppOptions): App {
  mkdirSync(opts.dataDir, { recursive: true });
  const blobs = path.join(opts.dataDir, "blobs");
  mkdirSync(blobs, { recursive: true });
  const db = openDb(path.join(opts.dataDir, "hub.sqlite"));
  const now = opts.now ?? (() => Date.now());
  const windowMs = opts.playWindowMs ?? PLAY_WINDOW_MS;
  const limits = opts.limits ?? DEFAULT_LIMITS;
  const salt = loadSalt(opts.dataDir);
  const css = readFileSync(path.join(opts.repoRoot, "public/site.css"));
  const siteJs = readFileSync(path.join(opts.repoRoot, "public/site.js"));
  if (opts.seed !== false) seedIfEmpty(db, { repoRoot: opts.repoRoot, blobs, now: now() });

  const currentUser = (request: Request): User | null => {
    const sid = readCookie(request.headers.get("cookie"), "sid");
    if (!sid) return null;
    return userFromSession(db, sid, now());
  };

  const handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();
    const user = currentUser(request);

    if (method === "GET" && pathname === "/static/site.css") {
      return new Response(css, { headers: { "content-type": "text/css; charset=utf-8" } });
    }
    if (method === "GET" && pathname === "/static/site.js") {
      return new Response(siteJs, { headers: { "content-type": "text/javascript; charset=utf-8" } });
    }
    if (method === "GET" && pathname === "/robots.txt") {
      return text("User-agent: *\nAllow: /\n", 200);
    }
    if (method === "GET" && pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname === "/") {
      const tag = url.searchParams.get("tag");
      const active = tag && /^[a-z0-9-]{1,24}$/.test(tag) ? tag : null;
      return html(homePage({
        user,
        featured: listFeatured(db),
        games: listGames(db, active ?? undefined),
        links: listHomepageLinks(db),
        tags: listTags(db),
        activeTag: active,
      }));
    }
    if (method === "GET" && pathname === "/policy") return html(policyPage(user));

    const gamePath = /^\/g\/([A-Za-z0-9_-]+)$/.exec(pathname);
    if (method === "GET" && gamePath) {
      const game = getGame(db, gamePath[1] ?? "");
      if (!game) return text("This game is not available.", 404);
      const parent = game.parentId ? getGame(db, game.parentId) : null;
      const notice = url.searchParams.get("reported") ? "Report received. A person will review it." : undefined;
      return html(gamePage({
        user,
        game,
        parent: parent ? { id: parent.id, title: parent.title } : null,
        children: listChildren(db, game.id),
        showPrompt: game.promptPublic || user?.id === game.authorId,
        liked: user ? userLiked(db, game.id, user.id) : false,
        notice,
      }));
    }

    const coverGame = /^\/cover\/game\/([A-Za-z0-9_-]+)\.svg$/.exec(pathname);
    if (method === "GET" && coverGame) {
      const game = getGame(db, coverGame[1] ?? "");
      if (!game) return text("Not found.", 404);
      return new Response(coverSvg(game.title, "game"), {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }
    const coverLink = /^\/cover\/link\/([A-Za-z0-9_-]+)\.svg$/.exec(pathname);
    if (method === "GET" && coverLink) {
      const link = getHomepageLink(db, coverLink[1] ?? "");
      if (!link) return text("Not found.", 404);
      return new Response(coverSvg(link.title, "link"), {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }

    const run = /^\/run\/([A-Za-z0-9_-]+)\/(?:index\.html)?$/.exec(pathname);
    if (method === "GET" && run) {
      const game = getGame(db, run[1] ?? "");
      const bundle = game ? readBundle(blobs, game.id) : null;
      if (!game || !bundle) return text("This game is not available.", 404);
      return new Response(inlineBundle(bundle), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy": GAME_CSP,
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
          "cache-control": "no-store",
        },
      });
    }

    if (pathname === "/login" || pathname === "/register") {
      const next = safeNext(url.searchParams.get("next"));
      const mode = pathname === "/login" ? "login" : "register";
      if (method === "GET") {
        return html(authPage({ mode, user, next, error: authError(url.searchParams.get("error")) }));
      }
      if (method === "POST") {
        const form = await readFields(request);
        if (!form) return text("Upload is too large.", 413);
        const handle = form.fields.handle ?? "";
        const password = form.fields.password ?? "";
        const dest = safeNext(form.fields.next ?? null);
        if (!validHandle(handle)) return redirect(`${pathname}?error=handle&next=${encodeURIComponent(dest)}`);
        if (!validPassword(password)) return redirect(`${pathname}?error=password&next=${encodeURIComponent(dest)}`);
        if (mode === "register") {
          const id = createUser(db, handle, hashPassword(password), now());
          if (!id) return redirect(`/register?error=taken&next=${encodeURIComponent(dest)}`);
          return redirect(dest, sessionCookie(startSession(db, id, now())));
        }
        const existing = userByHandle(db, handle);
        if (!existing || !verifyPassword(password, existing.passwordHash)) {
          return redirect(`/login?error=credentials&next=${encodeURIComponent(dest)}`);
        }
        return redirect(dest, sessionCookie(startSession(db, existing.id, now())));
      }
    }

    if (method === "POST" && pathname === "/logout") {
      const sid = readCookie(request.headers.get("cookie"), "sid");
      if (sid) endSession(db, sid);
      return redirect("/", clearCookie());
    }

    if (pathname === "/upload") {
      const parentId = url.searchParams.get("parent");
      const parentGame = parentId ? getGame(db, parentId) : null;
      const parent = parentGame && parentGame.promptPublic
        ? { id: parentGame.id, title: parentGame.title, prompt: parentGame.promptBody }
        : null;
      if (method === "GET") {
        if (!user) return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
        const errorCode = url.searchParams.get("error");
        return html(uploadPage({ user, parent, error: errorCode ? ingestText(errorCode) : undefined }));
      }
      if (method === "POST") {
        if (!user) return redirect("/login?next=/upload");
        const form = await readFields(request);
        if (!form) return text("Upload is too large.", 413);
        const file = form.files.file;
        const postedParent = form.fields.parent_id ?? "";
        const fail = (code: string) => redirect(`/upload?error=${encodeURIComponent(code)}${postedParent ? `&parent=${encodeURIComponent(postedParent)}` : ""}`);
        if (!file || file.data.length === 0) return fail("no_file");
        const saved = publishUpload(db, blobs, {
          authorId: user.id,
          title: form.fields.title ?? "",
          summary: form.fields.summary ?? "",
          model: form.fields.model ?? "",
          tags: form.fields.tags ?? "",
          promptBody: form.fields.prompt_body ?? "",
          promptPublic: form.fields.prompt_public === "on" || form.fields.prompt_public === "true",
          parentId: postedParent || null,
          filename: file.filename,
          bytes: new Uint8Array(file.data),
          now: now(),
        }, limits);
        if (!saved.ok) return fail(saved.code);
        return redirect(`/g/${saved.id}`);
      }
    }

    const api = /^\/api\/games\/([A-Za-z0-9_-]+)\/(play|like|report)$/.exec(pathname);
    if (api && method === "POST") {
      const id = api[1] ?? "";
      const action = api[2];
      const ip = request.headers.get("x-ace-ip") ?? "local";
      const ipHash = createHash("sha256").update(salt).update("|").update(ip).digest("hex");
      if (action === "play") {
        const result = recordPlay(db, { gameId: id, userId: user?.id ?? null, ipHash, now: now(), windowMs });
        if (!result) return json({ error: "missing" }, 404);
        return json(result);
      }
      if (action === "like") {
        if (!user) return json({ error: "login" }, 401);
        const result = toggleLike(db, id, user.id, now());
        if (!result) return json({ error: "missing" }, 404);
        return json(result);
      }
      const form = await readFields(request);
      if (!form) return text("Upload is too large.", 413);
      const reason = form.fields.reason ?? "";
      if (!REPORT_REASONS.has(reason)) return text("Unknown report reason.", 400);
      const detail = (form.fields.detail ?? "").slice(0, 2000);
      const reportId = addReport(db, id, reason, detail, now());
      if (!reportId) return text("This game is not available.", 404);
      return redirect(`/g/${id}?reported=1`);
    }

    if (pathname === "/admin/metrics" && method === "GET") {
      if (!opts.adminToken) return text("Set ADMIN_TOKEN before opening metrics.", 503);
      if (request.headers.get("x-admin-token") !== opts.adminToken) return text("Unauthorized.", 401);
      return json(metrics(db));
    }
    if (pathname === "/admin" && method === "GET") {
      if (!opts.adminToken) return text("Set ADMIN_TOKEN before opening the queue.", 503);
      return html(adminGate());
    }
    if (pathname === "/admin" && method === "POST") {
      if (!opts.adminToken) return text("Set ADMIN_TOKEN before opening the queue.", 503);
      const form = await readFields(request);
      if (!form || form.fields.token !== opts.adminToken) return text("Unauthorized.", 401);
      return html(adminPage({ reports: listReports(db), token: opts.adminToken }));
    }
    if (pathname === "/admin/takedown" && method === "POST") {
      if (!opts.adminToken) return text("Set ADMIN_TOKEN before opening the queue.", 503);
      const form = await readFields(request);
      if (!form || form.fields.token !== opts.adminToken) return text("Unauthorized.", 401);
      if (form.fields.game_id) takedown(db, form.fields.game_id);
      return html(adminPage({ reports: listReports(db), token: opts.adminToken }));
    }

    return text("Not found.", 404);
  };

  return {
    handle,
    close() {
      db.close();
    },
  };
}

export function listen(app: App, port: number, host = "127.0.0.1"): Promise<Server> {
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? `127.0.0.1:${port}`;
      const url = new URL(req.url ?? "/", `http://${host}`);
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buf.length;
        if (size > MAX_BODY) {
          res.writeHead(413, { "content-type": "text/plain; charset=utf-8" });
          res.end("Upload is too large.");
          return;
        }
        chunks.push(buf);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) for (const item of value) headers.append(key, item);
        else headers.set(key, value);
      }
      if (!headers.has("x-ace-ip")) headers.set("x-ace-ip", req.socket.remoteAddress ?? "local");
      const body = Buffer.concat(chunks);
      const request = new Request(url, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      const response = await app.handle(request);
      const out: Record<string, string | string[]> = {};
      response.headers.forEach((value, key) => {
        if (key === "set-cookie") return;
        out[key] = value;
      });
      const cookies = response.headers.getSetCookie?.() ?? [];
      if (cookies.length) out["set-cookie"] = cookies.length === 1 ? cookies[0]! : cookies;
      res.writeHead(response.status, out);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Server error.");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}
