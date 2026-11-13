import { compareSecrets, hashPassword, newId, sha256Hex, validHandle, validPassword, verifyPassword } from "../crypto-util.js";
import { coverSvg } from "../cover.js";
import {
  addReport,
  addShot,
  adminSessionValid,
  createUser,
  endAdminSession,
  endSession,
  getGame,
  getHomepageLink,
  getShot,
  listChildren,
  listFeatured,
  listGames,
  listHomepageLinks,
  listReports,
  listShots,
  listTags,
  metrics,
  recordPlay,
  shotCount,
  startAdminSession,
  startSession,
  takedown,
  toggleLike,
  userByHandle,
  userFromSession,
  userLiked,
  type User,
} from "../db.js";
import { inspectImage } from "../publish/image.js";
import { readShot, removeBundle, writeShot } from "../play/files.js";
import { publishUpload } from "../publish/save.js";
import { DEFAULT_LIMITS, type QuarantineLimits } from "../publish/gate.js";
import { seedIfEmpty, type SeedAssets } from "../seed.js";
import { ingestText, safeNext } from "../text.js";
import { parseMultipart, parseUrlEncoded } from "./form.js";
import { adminGate, adminPage, authPage, gamePage, homePage, policyPage, uploadPage, type PageContext } from "./pages.js";
import {
  isLocale,
  pickLocale,
  splitLocalePath,
  swapLocalePath,
  t,
  withLocale,
  type Locale,
} from "../i18n/index.js";
import { applySchema, type BlobStore, type Database } from "../store.js";

const MAX_BODY = 34 * 1024 * 1024;
const PLAY_WINDOW_MS = 30 * 60 * 1000;
const REPORT_REASONS = new Set(["malware", "copyright", "sexual", "violence", "other"]);
const MAX_SHOTS = 8;

export type HubOptions = {
  db: Database;
  blobs: BlobStore;
  adminToken: string;
  siteName: string;
  siteOrigin: string;
  gameOrigin: string;
  ipSalt: string;
  css: string;
  js: string;
  seedAssets?: SeedAssets;
  seed?: boolean;
  playWindowMs?: number;
  limits?: QuarantineLimits;
  now?: () => number;
};

export type App = {
  handle(request: Request): Promise<Response>;
  close(): void;
};

type Fields = { fields: Record<string, string>; files: Record<string, { filename: string; data: Uint8Array }> };

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cookieFlags(siteOrigin: string, extra: string): string {
  const secure = siteOrigin.startsWith("https:") ? "; Secure" : "";
  return `${extra}${secure}`;
}

function sessionCookie(id: string, siteOrigin: string): string {
  return `sid=${encodeURIComponent(id)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}${cookieFlags(siteOrigin, "")}`;
}

function adminCookie(id: string, siteOrigin: string): string {
  return `aid=${encodeURIComponent(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${12 * 60 * 60}${cookieFlags(siteOrigin, "")}`;
}

function csrfCookie(token: string, siteOrigin: string): string {
  return `csrf=${encodeURIComponent(token)}; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}${cookieFlags(siteOrigin, "")}`;
}

function langCookie(locale: Locale, siteOrigin: string): string {
  return `lang=${locale}; SameSite=Lax; Path=/; Max-Age=${365 * 24 * 60 * 60}${cookieFlags(siteOrigin, "")}`;
}

function clearCookie(name: string, siteOrigin: string, extra: string): string {
  return `${name}=; ${extra}; Path=/; Max-Age=0${cookieFlags(siteOrigin, "")}`;
}

function galleryCsp(gameOrigin: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    `frame-src ${gameOrigin}`,
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function originOk(request: Request, siteOrigin: string): boolean {
  const expected = siteOrigin.replace(/\/$/, "");
  const origin = (request.headers.get("origin") ?? "").replace(/\/$/, "");
  if (origin && origin !== "null") return origin === expected;
  const sec = request.headers.get("sec-fetch-site");
  if (sec === "same-origin") {
    const host = request.headers.get("host");
    try {
      return host === new URL(expected).host;
    } catch {
      return false;
    }
  }
  return false;
}

function csrfOk(request: Request, fields: Record<string, string> | null): boolean {
  const cookie = readCookie(request.headers.get("cookie"), "csrf");
  const submitted = request.headers.get("x-csrf-token") ?? fields?.csrf ?? "";
  if (!cookie || !submitted) return false;
  return compareSecrets(cookie, submitted);
}

function mutating(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function clientIp(request: Request): string {
  // Cloudflare injects CF-Connecting-IP at the edge. wrangler dev --local
  // does not, so fall back to a fixed stand-in. Client-supplied headers such
  // as X-Ace-IP or X-Forwarded-For are ignored.
  return request.headers.get("cf-connecting-ip") ?? "127.0.0.1";
}

export function createHub(opts: HubOptions): App {
  const db = opts.db;
  const blobs = opts.blobs;
  const now = opts.now ?? (() => Date.now());
  const windowMs = opts.playWindowMs ?? PLAY_WINDOW_MS;
  const limits = opts.limits ?? DEFAULT_LIMITS;
  const seeded = { done: false };

  const ensureSeed = async () => {
    if (seeded.done) return;
    await applySchema(db);
    if (opts.seed !== false && opts.seedAssets) {
      await seedIfEmpty(db, blobs, opts.seedAssets, now());
    }
    seeded.done = true;
  };

  const html = (body: string, status = 200, cookies: string[] = []): Response => {
    const headers = new Headers({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": galleryCsp(opts.gameOrigin),
    });
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    return new Response(body, { status, headers });
  };

  const redirect = (location: string, cookies: string[] = []): Response => {
    const headers = new Headers({ location, "cache-control": "no-store" });
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    return new Response(null, { status: 303, headers });
  };

  const json = (body: unknown, status = 200): Response => {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  };

  const text = (body: string, status: number, locale?: Locale): Response => {
    return new Response(body, {
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        ...(locale ? { "content-language": locale === "zh" ? "zh-CN" : "en" } : {}),
      },
    });
  };

  const currentUser = async (request: Request): Promise<User | null> => {
    const sid = readCookie(request.headers.get("cookie"), "sid");
    if (!sid) return null;
    return userFromSession(db, sid, now());
  };

  const isAdmin = async (request: Request): Promise<boolean> => {
    const aid = readCookie(request.headers.get("cookie"), "aid");
    if (aid && await adminSessionValid(db, aid, now())) return true;
    const auth = request.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ") && opts.adminToken) {
      return compareSecrets(auth.slice(7), opts.adminToken);
    }
    return false;
  };

  const readFields = async (request: Request): Promise<Fields | null> => {
    const buf = new Uint8Array(await request.arrayBuffer());
    if (buf.length > MAX_BODY) return null;
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      return parseMultipart(buf, type) ?? { fields: {}, files: {} };
    }
    return { fields: parseUrlEncoded(buf), files: {} };
  };

  const guardMutation = (request: Request, fields: Record<string, string> | null): Response | null => {
    if (!mutating(request.method)) return null;
    if (!originOk(request, opts.siteOrigin)) return text("Forbidden origin.", 403);
    if (!csrfOk(request, fields)) return text("Forbidden csrf.", 403);
    return null;
  };

  const handle = async (request: Request): Promise<Response> => {
    await ensureSeed();
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const cookiesOut: string[] = [];
    let csrf = readCookie(request.headers.get("cookie"), "csrf");
    if (!csrf) {
      csrf = newId(18);
      cookiesOut.push(csrfCookie(csrf, opts.siteOrigin));
    }
    const user = await currentUser(request);
    const cookieLang = readCookie(request.headers.get("cookie"), "lang");
    const preferred = pickLocale(request.headers.get("accept-language"), cookieLang);

    if (method === "GET" && url.pathname === "/static/site.css") {
      return new Response(opts.css, { headers: { "content-type": "text/css; charset=utf-8" } });
    }
    if (method === "GET" && url.pathname === "/static/site.js") {
      return new Response(opts.js, { headers: { "content-type": "text/javascript; charset=utf-8" } });
    }
    if (method === "GET" && url.pathname === "/robots.txt") {
      return text("User-agent: *\nAllow: /\n", 200);
    }
    if (method === "GET" && url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/run" || url.pathname.startsWith("/run/")) {
      return text("Not found.", 404);
    }

    if (method === "GET" && url.pathname === "/lang") {
      const nextLocale = url.searchParams.get("set");
      const destRaw = safeNext(url.searchParams.get("next"));
      const locale = isLocale(nextLocale) ? nextLocale : preferred;
      const dest = destRaw === "/" ? withLocale(locale, "/") : swapLocalePath(destRaw, "", locale);
      return redirect(dest.startsWith("/") ? dest : withLocale(locale, "/"), [langCookie(locale, opts.siteOrigin), ...cookiesOut]);
    }

    if (method === "GET" && (url.pathname === "/" || url.pathname === "/g" || url.pathname.startsWith("/g/") || url.pathname === "/upload" || url.pathname === "/login" || url.pathname === "/register" || url.pathname === "/policy" || url.pathname === "/logout")) {
      const dest = withLocale(preferred, url.pathname === "/" ? "/" : url.pathname) + url.search;
      return redirect(dest, [langCookie(preferred, opts.siteOrigin), ...cookiesOut]);
    }

    const split = splitLocalePath(url.pathname);
    const locale: Locale = split.locale ?? preferred;
    const rest = split.locale ? split.rest : url.pathname;
    const ctx = (): PageContext => ({
      locale,
      siteName: opts.siteName,
      siteOrigin: opts.siteOrigin,
      gameOrigin: opts.gameOrigin,
      csrf: csrf!,
      user,
      currentPath: url.pathname + url.search,
    });

    const authError = (code: string | null): string | undefined => {
      if (code === "credentials") return t(locale, "errCredentials");
      if (code === "handle") return t(locale, "errHandle");
      if (code === "password") return t(locale, "errPassword");
      if (code === "taken") return t(locale, "errTaken");
      return undefined;
    };

    if (split.locale && method === "GET" && rest === "/") {
      const tag = url.searchParams.get("tag");
      const active = tag && /^[a-z0-9-]{1,24}$/.test(tag) ? tag : null;
      return html(homePage(ctx(), {
        featured: await listFeatured(db),
        games: await listGames(db, active ?? undefined),
        links: await listHomepageLinks(db),
        tags: await listTags(db),
        activeTag: active,
      }), 200, cookiesOut);
    }

    if (split.locale && rest === "/policy" && method === "GET") {
      return html(policyPage(ctx()), 200, cookiesOut);
    }

    const gamePath = /^\/g\/([A-Za-z0-9_-]+)$/.exec(rest);
    if (split.locale && method === "GET" && gamePath) {
      const game = await getGame(db, gamePath[1] ?? "");
      if (!game) return text(t(locale, "missing"), 404, locale);
      const parent = game.parentId ? await getGame(db, game.parentId) : null;
      const notice = url.searchParams.get("reported") ? t(locale, "reportReceived") : undefined;
      return html(gamePage(ctx(), {
        game,
        parent: parent ? { id: parent.id, title: parent.title, titleEn: parent.titleEn, titleZh: parent.titleZh } : null,
        children: await listChildren(db, game.id),
        shots: await listShots(db, game.id),
        showPrompt: game.promptPublic || user?.id === game.authorId,
        liked: user ? await userLiked(db, game.id, user.id) : false,
        notice,
      }), 200, cookiesOut);
    }

    const shotPost = /^\/g\/([A-Za-z0-9_-]+)\/shots$/.exec(rest);
    if (split.locale && method === "POST" && shotPost) {
      const form = await readFields(request);
      const blocked = guardMutation(request, form?.fields ?? null);
      if (blocked) return blocked;
      if (!user) return redirect(`${withLocale(locale, "/login")}?next=${encodeURIComponent(url.pathname)}`);
      const game = await getGame(db, shotPost[1] ?? "");
      if (!game || game.authorId !== user.id) return text(t(locale, "missing"), 404, locale);
      if (!form) return text(t(locale, "tooLarge"), 413, locale);
      if (await shotCount(db, game.id) >= MAX_SHOTS) {
        return redirect(`${withLocale(locale, `/g/${game.id}`)}?error=too_many_shots`);
      }
      const file = form.files.shot;
      if (!file) return redirect(`${withLocale(locale, `/g/${game.id}`)}?error=bad_shot`);
      const info = inspectImage(file.data);
      if (!info) return redirect(`${withLocale(locale, `/g/${game.id}`)}?error=bad_shot`);
      const id = newId();
      await writeShot(blobs, game.id, id, file.data, info.contentType);
      await addShot(db, { id, gameId: game.id, contentType: info.contentType, width: info.width, height: info.height, now: now() });
      return redirect(withLocale(locale, `/g/${game.id}`));
    }

    const coverGame = /^\/cover\/game\/([A-Za-z0-9_-]+)\.svg$/.exec(url.pathname);
    if (method === "GET" && coverGame) {
      const game = await getGame(db, coverGame[1] ?? "");
      if (!game) return text(t(locale, "notFound"), 404, locale);
      return new Response(coverSvg(game.title, "game", t(locale, "coverOnSite"), t(locale, "coverOffSite")), {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }
    const coverLink = /^\/cover\/link\/([A-Za-z0-9_-]+)\.svg$/.exec(url.pathname);
    if (method === "GET" && coverLink) {
      const link = await getHomepageLink(db, coverLink[1] ?? "");
      if (!link) return text(t(locale, "notFound"), 404, locale);
      return new Response(coverSvg(link.title, "link", t(locale, "coverOnSite"), t(locale, "coverOffSite")), {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }
    const shotGet = /^\/shot\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (method === "GET" && shotGet) {
      const game = await getGame(db, shotGet[1] ?? "");
      const meta = game ? await getShot(db, game.id, shotGet[2] ?? "") : null;
      const bytes = meta ? await readShot(blobs, game!.id, meta.id) : null;
      if (!game || !meta || !bytes) return text(t(locale, "notFound"), 404, locale);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Response(copy, {
        headers: { "content-type": meta.contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }

    if (split.locale && (rest === "/login" || rest === "/register")) {
      const next = safeNext(url.searchParams.get("next"));
      const destDefault = next === "/" ? withLocale(locale, "/") : next;
      const mode = rest === "/login" ? "login" : "register";
      if (method === "GET") {
        return html(authPage(ctx(), { mode, next: destDefault, error: authError(url.searchParams.get("error")) }), 200, cookiesOut);
      }
      if (method === "POST") {
        const form = await readFields(request);
        const blocked = guardMutation(request, form?.fields ?? null);
        if (blocked) return blocked;
        if (!form) return text(t(locale, "tooLarge"), 413, locale);
        const handleName = form.fields.handle ?? "";
        const password = form.fields.password ?? "";
        const dest = safeNext(form.fields.next ?? null);
        const destOk = dest === "/" ? withLocale(locale, "/") : dest;
        if (!validHandle(handleName)) return redirect(`${withLocale(locale, rest)}?error=handle&next=${encodeURIComponent(destOk)}`);
        if (!validPassword(password)) return redirect(`${withLocale(locale, rest)}?error=password&next=${encodeURIComponent(destOk)}`);
        if (mode === "register") {
          const id = await createUser(db, handleName, await hashPassword(password), now());
          if (!id) return redirect(`${withLocale(locale, "/register")}?error=taken&next=${encodeURIComponent(destOk)}`);
          return redirect(destOk, [sessionCookie(await startSession(db, id, now()), opts.siteOrigin), ...cookiesOut]);
        }
        const existing = await userByHandle(db, handleName);
        if (!existing || !(await verifyPassword(password, existing.passwordHash))) {
          return redirect(`${withLocale(locale, "/login")}?error=credentials&next=${encodeURIComponent(destOk)}`);
        }
        return redirect(destOk, [sessionCookie(await startSession(db, existing.id, now()), opts.siteOrigin), ...cookiesOut]);
      }
    }

    if (split.locale && method === "POST" && rest === "/logout") {
      const form = await readFields(request);
      const blocked = guardMutation(request, form?.fields ?? null);
      if (blocked) return blocked;
      const sid = readCookie(request.headers.get("cookie"), "sid");
      if (sid) await endSession(db, sid);
      return redirect(withLocale(locale, "/"), [clearCookie("sid", opts.siteOrigin, "HttpOnly; SameSite=Lax"), ...cookiesOut]);
    }

    if (split.locale && rest === "/upload") {
      const parentId = url.searchParams.get("parent");
      const parentGame = parentId ? await getGame(db, parentId) : null;
      const parent = parentGame && parentGame.promptPublic
        ? { id: parentGame.id, title: parentGame.title, titleEn: parentGame.titleEn, titleZh: parentGame.titleZh, prompt: parentGame.promptBody }
        : null;
      if (method === "GET") {
        if (!user) return redirect(`${withLocale(locale, "/login")}?next=${encodeURIComponent(url.pathname + url.search)}`);
        const errorCode = url.searchParams.get("error");
        return html(uploadPage(ctx(), { parent, error: errorCode ? ingestText(locale, errorCode) : undefined }), 200, cookiesOut);
      }
      if (method === "POST") {
        const form = await readFields(request);
        const blocked = guardMutation(request, form?.fields ?? null);
        if (blocked) return blocked;
        if (!user) return redirect(`${withLocale(locale, "/login")}?next=${encodeURIComponent(withLocale(locale, "/upload"))}`);
        if (!form) return text(t(locale, "tooLarge"), 413, locale);
        const file = form.files.file;
        const postedParent = form.fields.parent_id ?? "";
        const fail = (code: string) => redirect(`${withLocale(locale, "/upload")}?error=${encodeURIComponent(code)}${postedParent ? `&parent=${encodeURIComponent(postedParent)}` : ""}`);
        if (!file || file.data.length === 0) return fail("no_file");
        const saved = await publishUpload(db, blobs, {
          authorId: user.id,
          title: form.fields.title ?? "",
          summary: form.fields.summary ?? "",
          titleEn: form.fields.title_en ?? "",
          titleZh: form.fields.title_zh ?? "",
          summaryEn: form.fields.summary_en ?? "",
          summaryZh: form.fields.summary_zh ?? "",
          model: form.fields.model ?? "",
          tags: form.fields.tags ?? "",
          promptBody: form.fields.prompt_body ?? "",
          promptPublic: form.fields.prompt_public === "on" || form.fields.prompt_public === "true",
          parentId: postedParent || null,
          filename: file.filename,
          bytes: file.data,
          now: now(),
        }, limits);
        if (!saved.ok) return fail(saved.code);
        return redirect(withLocale(locale, `/g/${saved.id}`));
      }
    }

    const api = /^\/api\/games\/([A-Za-z0-9_-]+)\/(play|like|report)$/.exec(url.pathname);
    if (api && method === "POST") {
      const id = api[1] ?? "";
      const action = api[2];
      const form = action === "report" ? await readFields(request) : { fields: {} as Record<string, string>, files: {} };
      if (action === "report" && !form) return text(t(locale, "tooLarge"), 413, locale);
      const blocked = guardMutation(request, form?.fields ?? {});
      if (blocked) return blocked;
      const ip = clientIp(request);
      const ipHash = await sha256Hex(`${opts.ipSalt}|${ip}`);
      if (action === "play") {
        const result = await recordPlay(db, { gameId: id, userId: user?.id ?? null, ipHash, now: now(), windowMs });
        if (!result) return json({ error: "missing" }, 404);
        return json(result);
      }
      if (action === "like") {
        if (!user) return json({ error: "login" }, 401);
        const result = await toggleLike(db, id, user.id, now());
        if (!result) return json({ error: "missing" }, 404);
        return json(result);
      }
      const reason = form?.fields.reason ?? "";
      if (!REPORT_REASONS.has(reason)) return text(t(locale, "unknownReason"), 400, locale);
      const detail = (form?.fields.detail ?? "").slice(0, 2000);
      const reportId = await addReport(db, id, reason, detail, now());
      if (!reportId) return text(t(locale, "missing"), 404, locale);
      const next = safeNext(form?.fields.next ?? null);
      const dest = next === "/" ? withLocale(locale, `/g/${id}`) : next;
      return redirect(`${dest}${dest.includes("?") ? "&" : "?"}reported=1`.replace("?&", "?"));
    }

    if (url.pathname === "/admin/metrics" && method === "GET") {
      if (!opts.adminToken) return text(t(locale, "adminUnset"), 503, locale);
      if (!(await isAdmin(request))) return text(t(locale, "unauthorized"), 401, locale);
      return json(await metrics(db));
    }
    if (url.pathname === "/admin" && method === "GET") {
      if (!opts.adminToken) return text(t(locale, "adminUnset"), 503, locale);
      if (await isAdmin(request)) {
        return html(adminPage(ctx(), await listReports(db)), 200, cookiesOut);
      }
      return html(adminGate(ctx()), 200, cookiesOut);
    }
    if (url.pathname === "/admin" && method === "POST") {
      if (!opts.adminToken) return text(t(locale, "adminUnset"), 503, locale);
      const form = await readFields(request);
      const blocked = guardMutation(request, form?.fields ?? null);
      if (blocked) return blocked;
      if (!form || !compareSecrets(form.fields.token ?? "", opts.adminToken)) return text(t(locale, "unauthorized"), 401, locale);
      const aid = await startAdminSession(db, now());
      return redirect("/admin", [adminCookie(aid, opts.siteOrigin), ...cookiesOut]);
    }
    if (url.pathname === "/admin/takedown" && method === "POST") {
      if (!opts.adminToken) return text(t(locale, "adminUnset"), 503, locale);
      const form = await readFields(request);
      const blocked = guardMutation(request, form?.fields ?? null);
      if (blocked) return blocked;
      if (!(await isAdmin(request))) return text(t(locale, "unauthorized"), 401, locale);
      const gameId = form?.fields.game_id ?? "";
      if (gameId) {
        await takedown(db, gameId);
        await removeBundle(blobs, gameId);
      }
      return redirect("/admin");
    }
    if (url.pathname === "/admin/logout" && method === "POST") {
      const form = await readFields(request);
      const blocked = guardMutation(request, form?.fields ?? null);
      if (blocked) return blocked;
      const aid = readCookie(request.headers.get("cookie"), "aid");
      if (aid) await endAdminSession(db, aid);
      return redirect("/admin", [clearCookie("aid", opts.siteOrigin, "HttpOnly; SameSite=Strict"), ...cookiesOut]);
    }

    return text(t(locale, "notFound"), 404, locale);
  };

  return {
    handle,
    close() {
      db.close();
    },
  };
}
