import { createGame } from "../http/game.js";
import { runtimeConfig } from "../config.js";
import { wrapD1, wrapR2 } from "../store.js";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  SITE_ORIGIN?: string;
  GAME_ORIGIN?: string;
  SITE_NAME?: string;
}

let game: ReturnType<typeof createGame> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!game) {
      const cfg = runtimeConfig(env as unknown as Record<string, string | undefined>);
      game = createGame({
        db: wrapD1(env.DB),
        blobs: wrapR2(env.R2),
        siteOrigin: cfg.siteOrigin,
      });
    }
    return game.handle(request);
  },
};
