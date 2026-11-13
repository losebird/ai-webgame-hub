import { readFileSync } from "node:fs";
import path from "node:path";
import { createHub, type App } from "./http/hub.js";
import { createGame } from "./http/game.js";
import { openSqlite } from "./store-sqlite.js";
import { MemoryBlobs } from "./store.js";

export const SITE = "http://127.0.0.1:8787";
export const GAME = "http://127.0.0.1:8788";

export function loadSeedAssets(repoRoot: string) {
  const file = (rel: string) => new Uint8Array(readFileSync(path.join(repoRoot, rel)));
  return {
    seedJson: readFileSync(path.join(repoRoot, "data/seed/seed-games.json"), "utf8"),
    dodgeHtml: file("sample-games/dodge/index.html"),
    birdFiles: [
      { path: "index.html", bytes: file("sample-games/zip-bird/index.html") },
      { path: "css/game.css", bytes: file("sample-games/zip-bird/css/game.css") },
      { path: "js/game.js", bytes: file("sample-games/zip-bird/js/game.js") },
    ],
  };
}

export function createTestShelf(opts: {
  dir: string;
  repoRoot: string;
  adminToken?: string;
  siteName?: string;
}) {
  const db = openSqlite(path.join(opts.dir, "hub.sqlite"));
  const blobs = new MemoryBlobs();
  const hub = createHub({
    db,
    blobs,
    adminToken: opts.adminToken ?? "test-admin",
    siteName: opts.siteName ?? "WebGame",
    siteOrigin: SITE,
    gameOrigin: GAME,
    ipSalt: "test-salt",
    css: readFileSync(path.join(opts.repoRoot, "public/site.css"), "utf8"),
    js: readFileSync(path.join(opts.repoRoot, "public/site.js"), "utf8"),
    seedAssets: loadSeedAssets(opts.repoRoot),
  });
  const game = createGame({ db, blobs, siteOrigin: SITE });
  return { hub, game, blobs, db };
}

export function cookieValue(response: Response, name: string): string | null {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair!.indexOf("=");
    if (eq < 0) continue;
    if (pair!.slice(0, eq) === name) return decodeURIComponent(pair!.slice(eq + 1));
  }
  return null;
}

export function cookieHeader(response: Response): string {
  return response.headers.getSetCookie().map((raw) => raw.split(";")[0]!).join("; ");
}

export async function bootCsrf(app: App): Promise<{ cookie: string; csrf: string }> {
  const response = await app.handle(new Request(`${SITE}/en/login`));
  const csrf = cookieValue(response, "csrf");
  if (!csrf) throw new Error("missing csrf cookie");
  return { cookie: cookieHeader(response), csrf };
}

export function formHeaders(csrf: string, cookie: string, contentType: string, extra: Record<string, string> = {}) {
  return {
    origin: SITE,
    cookie: cookie.includes("csrf=") ? cookie : `${cookie}; csrf=${csrf}`,
    "content-type": contentType,
    "x-csrf-token": csrf,
    ...extra,
  };
}

export { type App };
