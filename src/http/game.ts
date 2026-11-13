import { getGame } from "../db.js";
import { inlineBundle } from "../play/inline.js";
import { readBundle } from "../play/files.js";
import { applySchema, type BlobStore, type Database } from "../store.js";

export type GameOptions = {
  db: Database;
  blobs: BlobStore;
  siteOrigin: string;
  now?: () => number;
};

export function gameCsp(siteOrigin: string): string {
  return [
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
    `frame-ancestors ${siteOrigin}`,
    "sandbox allow-scripts allow-pointer-lock",
  ].join("; ");
}

export function createGame(opts: GameOptions): { handle(request: Request): Promise<Response> } {
  const csp = gameCsp(opts.siteOrigin);
  let ready = false;

  const respond = (body: BodyInit | null, status: number, contentType: string): Response => {
    return new Response(body, {
      status,
      headers: {
        "content-type": contentType,
        "content-security-policy": csp,
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "cache-control": "no-store",
      },
    });
  };

  return {
    async handle(request: Request): Promise<Response> {
      if (!ready) {
        await applySchema(opts.db);
        ready = true;
      }
      const url = new URL(request.url);
      if (request.method.toUpperCase() !== "GET" && request.method.toUpperCase() !== "HEAD") {
        return respond("Not found.", 404, "text/plain; charset=utf-8");
      }
      const match = /^\/run\/([A-Za-z0-9_-]+)\/(?:index\.html)?$/.exec(url.pathname);
      if (!match) {
        return respond("Not found.", 404, "text/plain; charset=utf-8");
      }
      const game = await getGame(opts.db, match[1] ?? "");
      const bundle = game ? await readBundle(opts.blobs, game.id) : null;
      if (!game || !bundle) {
        return respond("This game is not available.", 404, "text/plain; charset=utf-8");
      }
      return respond(inlineBundle(bundle), 200, "text/html; charset=utf-8");
    },
  };
}
