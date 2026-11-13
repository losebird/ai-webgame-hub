# WebGame

WebGame is a free browser-game shelf. Authors upload a self-contained HTML file or a zip with `index.html`, plus the model name and prompt. Visitors play in a sandbox without logging in. Likes and uploads need an account. The site does not generate games, show ads, or take payments.

The runtime is two local Cloudflare Workers: a hub origin and a game origin. Metadata lives in D1. Game files live in R2. `wrangler dev` uses miniflare. You do not need a Cloudflare account to run this on a Mac.

UI languages are English (`/en/…`) and Chinese (`/zh/…`). The first visit follows `Accept-Language`. A language cookie remembers the choice on the hub origin.

## Local run (no Cloudflare login)

Need Node.js 22 or newer. This checkout was checked with Node 26.7.

```bash
npm install
npm test
```

Start both origins. They must share `--persist-to` so D1 and R2 are the same local store. Use different inspector ports:

```bash
npm run dev:hub
```

In a second terminal:

```bash
npm run dev:game
```

That is:

```bash
npx wrangler dev -c wrangler.hub.toml --port 8787 --inspector-port 9230 --persist-to .wrangler/state
npx wrangler dev -c wrangler.game.toml --port 8788 --inspector-port 9231 --persist-to .wrangler/state
```

Do not run `wrangler login` or `wrangler deploy`.

Open `http://127.0.0.1:8787`. It redirects to `/zh/` or `/en/`. The empty local D1 seeds two sample games (Lantern Dodge, Paper Bird) and 16 homepage outbound cards. The sample author is `shelf` with a random password; register your own account to upload or like.

`ADMIN_TOKEN` defaults to `dev-admin` in the wrangler templates. Change it before anyone else can hit your machine. Open `/admin`, type the token; the page never embeds the token. Metrics: `Authorization: Bearer <token>` on `/admin/metrics`.

Site name is `SITE_NAME` (default `WebGame`). Origins are `SITE_ORIGIN` and `GAME_ORIGIN`.

## Upload

Upload a `.html` / `.htm` file or a `.zip`. A zip needs `index.html` at the root or inside a single top folder. Caps: 32 MB compressed, 64 MB uncompressed, 200 files. Path traversal, absolute paths, symlinks, zip bombs, too many files, and a zip renamed to `.html` are rejected. A failed upload leaves nothing in D1 or R2.

The hub never serves `/run`. Games are at `GAME_ORIGIN/run/<id>/` inside an iframe with `sandbox="allow-scripts allow-pointer-lock"` and a CSP `sandbox` directive. The game origin sets no cookies and has no `/api`.

## External cards

`data/seed/seed-games.json` is imported on first empty D1. `homepage` (16) shows on the home page. `alternates` (6) stay off the home page. Cards link out with `target="_blank" rel="noopener noreferrer"`. This site does not copy code, embed unauthorized games, or fetch author covers.

## Tests and evidence

```bash
npm test
npx tsx scripts/evidence-r2.ts
```

Evidence writes `evidence-r2/`. Each record file has a `.sha` of that file.

## Future deploy (not done here)

You will need a Cloudflare account, two hostnames (hub + games), a D1 database, and an R2 bucket. Put real ids into `wrangler.hub.toml` and `wrangler.game.toml` (placeholders today), set `SITE_ORIGIN` / `GAME_ORIGIN` to https URLs, set a strong `ADMIN_TOKEN` and `IP_SALT`, then `wrangler d1 migrations apply` and `wrangler deploy` for each worker. Do not do that from this branch unless you decide to.
