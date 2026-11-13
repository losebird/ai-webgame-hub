import dodgeHtml from "../../sample-games/dodge/index.html";
import birdHtml from "../../sample-games/zip-bird/index.html";
import birdCss from "../../sample-games/zip-bird/css/game.css";
import birdJs from "../../sample-games/zip-bird/js/game.js";
import seedJson from "../../data/seed/seed-games.json" with { type: "json" };
import siteCss from "../../public/site.css";
import siteJs from "../../public/site.js";
import { createHub } from "../http/hub.js";
import { runtimeConfig } from "../config.js";
import { wrapD1, wrapR2 } from "../store.js";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  SITE_NAME?: string;
  SITE_ORIGIN?: string;
  GAME_ORIGIN?: string;
  ADMIN_TOKEN?: string;
  IP_SALT?: string;
}

const encoder = new TextEncoder();

function assets() {
  return {
    seedJson: JSON.stringify(seedJson),
    dodgeHtml: encoder.encode(dodgeHtml),
    birdFiles: [
      { path: "index.html", bytes: encoder.encode(birdHtml) },
      { path: "css/game.css", bytes: encoder.encode(birdCss) },
      { path: "js/game.js", bytes: encoder.encode(birdJs) },
    ],
  };
}

let hub: ReturnType<typeof createHub> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!hub) {
      const cfg = runtimeConfig(env as unknown as Record<string, string | undefined>);
      hub = createHub({
        db: wrapD1(env.DB),
        blobs: wrapR2(env.R2),
        adminToken: cfg.adminToken,
        siteName: cfg.siteName,
        siteOrigin: cfg.siteOrigin,
        gameOrigin: cfg.gameOrigin,
        ipSalt: cfg.ipSalt,
        css: siteCss,
        js: siteJs,
        seedAssets: assets(),
      });
    }
    return hub.handle(request);
  },
};
