import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { linkCounts } from "../src/db.js";
import { importSeedText } from "../src/links/import.js";
import { openSqlite } from "../src/store-sqlite.js";
import {
  SITE,
  GAME,
  bootCsrf,
  cookieHeader,
  cookieValue,
  createTestShelf,
  formHeaders,
  type App,
} from "../src/test-app.js";

const repo = path.resolve(import.meta.dirname, "..");

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "webgame-"));
}

async function register(app: App, handle: string): Promise<{ cookie: string; csrf: string }> {
  const boot = await bootCsrf(app);
  const response = await app.handle(new Request(`${SITE}/en/register`, {
    method: "POST",
    headers: formHeaders(boot.csrf, boot.cookie, "application/x-www-form-urlencoded"),
    body: new URLSearchParams({ handle, password: "long-password", next: "/en/", csrf: boot.csrf }).toString(),
  }));
  assert.equal(response.status, 303);
  const sid = cookieValue(response, "sid");
  assert.ok(sid);
  return { cookie: `sid=${sid}; csrf=${boot.csrf}`, csrf: boot.csrf };
}

function multipart(fields: Record<string, string>, file: { name: string; filename: string; data: Uint8Array }) {
  const boundary = "----webgame";
  const chunks: Uint8Array[] = [];
  const push = (value: string | Uint8Array) => {
    chunks.push(typeof value === "string" ? new TextEncoder().encode(value) : value);
  };
  for (const [key, value] of Object.entries(fields)) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
  }
  push(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  push(file.data);
  push(`\r\n--${boundary}--\r\n`);
  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    body.set(part, offset);
    offset += part.length;
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}
function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function traversalZip(): Uint8Array {
  const name = strToU8("../x");
  const data = strToU8("nope");
  const indexName = strToU8("index.html");
  const index = strToU8("<html></html>");
  const local = (filename: Uint8Array, bytes: Uint8Array) => concat(
    u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
    u32(bytes.length), u32(bytes.length), u16(filename.length), u16(0), filename, bytes,
  );
  const first = local(name, data);
  const second = local(indexName, index);
  const cd = (filename: Uint8Array, bytes: Uint8Array, offset: number) => concat(
    u32(0x02014b50), u16(0x0314), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
    u32(bytes.length), u32(bytes.length), u16(filename.length), u16(0), u16(0), u16(0), u16(0),
    u32(0), u32(offset), filename,
  );
  const central = concat(cd(name, data, 0), cd(indexName, index, first.length));
  const locals = concat(first, second);
  const end = concat(
    u32(0x06054b50), u16(0), u16(0), u16(2), u16(2), u32(central.length), u32(locals.length), u16(0),
  );
  return concat(locals, central, end);
}

test("seed import is idempotent and lists bad rows", async () => {
  const dir = tempDir();
  const db = openSqlite(path.join(dir, "hub.sqlite"));
  const seed = readFileSync(path.join(repo, "data/seed/seed-games.json"), "utf8");
  const first = await importSeedText(db, seed);
  const second = await importSeedText(db, seed);
  assert.equal(first.documentError, null);
  assert.equal(first.rejected.length, 0);
  assert.equal(first.homepage, 16);
  assert.equal(first.hidden, 6);
  assert.equal(second.imported, 22);
  const counts = await linkCounts(db);
  assert.equal(counts.homepage, 16);
  assert.equal(counts.hidden, 6);

  const mixed = await importSeedText(db, JSON.stringify([
    {
      title: "Ok card",
      author_handle: "example_author",
      post_url: "https://example.com/post",
      play_url: "https://example.com/play",
      summary: "Placeholder only.",
      model: "Other",
      license_status: "unknown",
      engagement: "example",
    },
    {
      title: "Plain http",
      author_handle: "example_author",
      post_url: "http://example.com/post",
      play_url: "https://example.com/play",
      summary: "no",
      model: "Other",
      license_status: "unknown",
      engagement: "example",
    },
  ]));
  assert.equal(mixed.imported, 1);
  assert.equal(mixed.rejected.length, 1);
  assert.match(mixed.rejected[0]?.reason ?? "", /not https/);
  assert.equal((await linkCounts(db)).homepage, 17);
  db.close();
});

test("import command prints rejections and exits non-zero", () => {
  const dir = tempDir();
  const file = path.join(dir, "bad.json");
  writeFileSync(file, JSON.stringify([
    {
      title: "Bad",
      author_handle: "example_author",
      post_url: "http://example.com/nope",
      play_url: "https://example.com/play",
      summary: "no",
      model: "Other",
      license_status: "unknown",
      engagement: "example",
    },
  ]));
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/import-external-links.ts", file], {
    cwd: repo,
    env: { ...process.env, DATA_DIR: dir },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /rejected/);
  assert.match(`${result.stdout}\n${result.stderr}`, /not https/);
});

test("visitor can play, publish, like, and remix", async () => {
  const dir = tempDir();
  const { hub, game, blobs } = createTestShelf({ dir, repoRoot: repo });
  try {
    const homeResponse = await hub.handle(new Request(`${SITE}/en/`));
    const home = await homeResponse.text();
    assert.match(home, /Lantern Dodge/);
    assert.match(home, /Paper Bird/);
    assert.match(home, /Saltline/);
    assert.equal(home.includes("Turbo Tails"), false);
    assert.equal(home.includes("example_author"), false);
    assert.equal(home.includes("4272701"), false);
    assert.equal(home.includes("<iframe"), false);
    assert.match(home, /not a play count on this site/);
    assert.match(home, /href="https:\/\/x\.com\/felixrieseberg\/status\/2119925633564463609"/);
    assert.match(home, /target="_blank"/);
    assert.match(home, /rel="noopener noreferrer"/);
    assert.match(home, /WebGame/);
    assert.equal(home.includes("Ace Shelf"), false);

    const idFor = (title: string) => {
      const at = home.indexOf(`<h3>${title}</h3>`);
      assert.ok(at > 0, title);
      const slice = home.slice(Math.max(0, at - 500), at);
      const found = [...slice.matchAll(/href="\/en\/g\/([^"]+)"/g)];
      return found.at(-1)?.[1];
    };
    const dodgeId = idFor("Lantern Dodge");
    const birdId = idFor("Paper Bird");
    assert.ok(dodgeId && birdId);
    assert.notEqual(dodgeId, birdId);

    const dodgePage = await (await hub.handle(new Request(`${SITE}/en/g/${dodgeId}`))).text();
    assert.match(dodgePage, /sandbox="allow-scripts allow-pointer-lock"/);
    assert.equal(dodgePage.includes("allow-same-origin"), false);
    assert.equal(dodgePage.includes("allow-popups"), false);
    assert.equal(dodgePage.includes("allow-top-navigation"), false);
    assert.match(dodgePage, /Embers fall/);
    assert.match(dodgePage, new RegExp(`${GAME}/run/${dodgeId}/`));

    const hubRun = await hub.handle(new Request(`${SITE}/run/${birdId}/`));
    assert.equal(hubRun.status, 404);

    const run = await game.handle(new Request(`${GAME}/run/${birdId}/`));
    const csp = run.headers.get("content-security-policy") ?? "";
    assert.match(csp, /connect-src 'none'/);
    assert.match(csp, /sandbox allow-scripts allow-pointer-lock/);
    assert.equal(csp.includes("allow-same-origin"), false);
    assert.match(csp, new RegExp(`frame-ancestors ${SITE}`));
    assert.equal(csp.includes("https:"), false);
    assert.equal(run.headers.get("set-cookie"), null);
    const birdHtml = await run.text();
    assert.match(birdHtml, /Paper Bird/);
    assert.match(birdHtml, /placePipe/);
    assert.equal(birdHtml.includes('src="js/game.js"'), false);
    assert.equal(birdHtml.includes('href="css/game.css"'), false);

    const before = [...blobs.map.keys()].sort();
    const author = await register(hub, "ada");
    const hostile = multipart(
      { title: "Hostile", summary: "no", model: "Other", tags: "", prompt_body: "no", prompt_public: "on", csrf: author.csrf },
      { name: "file", filename: "bad.zip", data: traversalZip() },
    );
    const rejected = await hub.handle(new Request(`${SITE}/en/upload`, {
      method: "POST",
      headers: formHeaders(author.csrf, author.cookie, hostile.contentType),
      body: hostile.body,
    }));
    assert.equal(rejected.status, 303);
    assert.match(rejected.headers.get("location") ?? "", /error=path_traversal/);
    const errorPage = await (await hub.handle(new Request(`${SITE}${rejected.headers.get("location")}`, {
      headers: { cookie: author.cookie },
    }))).text();
    assert.match(errorPage, /escapes its folder/);
    assert.deepEqual([...blobs.map.keys()].sort(), before);

    const boot = await bootCsrf(hub);
    const played = await hub.handle(new Request(`${SITE}/api/games/${dodgeId}/play`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "text/plain"),
    }));
    const firstPlay = await played.json() as { plays: number; counted: boolean };
    assert.equal(firstPlay.counted, true);
    assert.equal(firstPlay.plays, 1);
    const second = await (await hub.handle(new Request(`${SITE}/api/games/${dodgeId}/play`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "text/plain"),
    }))).json() as { plays: number; counted: boolean };
    assert.equal(second.counted, false);
    assert.equal(second.plays, 1);
    const refreshed = await (await hub.handle(new Request(`${SITE}/en/g/${dodgeId}`))).text();
    assert.match(refreshed, /data-plays>1</);

    const anonLike = await hub.handle(new Request(`${SITE}/api/games/${dodgeId}/like`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "text/plain"),
    }));
    assert.equal(anonLike.status, 401);
    const liked = await (await hub.handle(new Request(`${SITE}/api/games/${dodgeId}/like`, {
      method: "POST",
      headers: formHeaders(author.csrf, author.cookie, "text/plain"),
    }))).json() as { likes: number; liked: boolean };
    assert.equal(liked.liked, true);
    assert.equal(liked.likes, 1);
    const likedPage = await (await hub.handle(new Request(`${SITE}/en/g/${dodgeId}`, {
      headers: { cookie: author.cookie },
    }))).text();
    assert.match(likedPage, /data-likes>1</);

    const htmlUpload = multipart({
      title: "Html Game",
      summary: "A single file.",
      model: "Fable 5.2",
      tags: "puzzle",
      prompt_body: "Draw one square.",
      prompt_public: "on",
      csrf: author.csrf,
    }, {
      name: "file",
      filename: "square.html",
      data: strToU8("<!doctype html><title>Html Game</title><p>square</p>"),
    });
    const htmlRes = await hub.handle(new Request(`${SITE}/en/upload`, {
      method: "POST",
      headers: formHeaders(author.csrf, author.cookie, htmlUpload.contentType),
      body: htmlUpload.body,
    }));
    assert.equal(htmlRes.status, 303);
    const htmlId = (htmlRes.headers.get("location") ?? "").split("/").pop();
    const htmlPage = await (await hub.handle(new Request(`${SITE}/en/g/${htmlId}`))).text();
    assert.match(htmlPage, /Fable 5\.2/);
    assert.match(htmlPage, /Draw one square/);
    const latest = await (await hub.handle(new Request(`${SITE}/en/`))).text();
    assert.match(latest, /Html Game/);

    const zipUpload = multipart({
      title: "Zip Game",
      summary: "Two files.",
      model: "Fable 5.2",
      tags: "puzzle",
      prompt_body: "Two files.",
      prompt_public: "on",
      csrf: author.csrf,
    }, {
      name: "file",
      filename: "bundle.zip",
      data: zipSync({
        "index.html": strToU8("<!doctype html><title>Zip Game</title><script src=\"js/app.js\"></script>"),
        "js/app.js": strToU8("var zipMarker = 'zip-ready';"),
      }),
    });
    const zipRes = await hub.handle(new Request(`${SITE}/en/upload`, {
      method: "POST",
      headers: formHeaders(author.csrf, author.cookie, zipUpload.contentType),
      body: zipUpload.body,
    }));
    const zipId = (zipRes.headers.get("location") ?? "").split("/").pop();
    const zipRun = await (await game.handle(new Request(`${GAME}/run/${zipId}/`))).text();
    assert.match(zipRun, /zip-ready/);
    assert.equal(zipRun.includes('src="js/app.js"'), false);

    const remixForm = await (await hub.handle(new Request(`${SITE}/en/upload?parent=${dodgeId}`, {
      headers: { cookie: author.cookie },
    }))).text();
    assert.match(remixForm, /name="parent_id"/);
    assert.match(remixForm, new RegExp(`value="${dodgeId}"`));
    assert.match(remixForm, /Embers fall/);

    const remix = multipart({
      title: "Lantern Remix",
      summary: "A child game.",
      model: "Fable 5.2",
      tags: "dodge",
      prompt_body: "Embers fall, but slower.",
      prompt_public: "on",
      parent_id: dodgeId!,
      csrf: author.csrf,
    }, {
      name: "file",
      filename: "remix.html",
      data: strToU8("<!doctype html><title>Lantern Remix</title>"),
    });
    const remixRes = await hub.handle(new Request(`${SITE}/en/upload`, {
      method: "POST",
      headers: formHeaders(author.csrf, author.cookie, remix.contentType),
      body: remix.body,
    }));
    const remixId = (remixRes.headers.get("location") ?? "").split("/").pop();
    const parentPage = await (await hub.handle(new Request(`${SITE}/en/g/${dodgeId}`))).text();
    assert.match(parentPage, /Lantern Remix/);
    const childPage = await (await hub.handle(new Request(`${SITE}/en/g/${remixId}`))).text();
    assert.match(childPage, /Remix of/);
    assert.match(childPage, new RegExp(`/en/g/${dodgeId}`));

    const report = await hub.handle(new Request(`${SITE}/api/games/${htmlId}/report`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "application/x-www-form-urlencoded"),
      body: new URLSearchParams({ reason: "copyright", detail: "test report", csrf: boot.csrf, next: `/en/g/${htmlId}` }).toString(),
    }));
    assert.equal(report.status, 303);
    const gate = await hub.handle(new Request(`${SITE}/admin`));
    const gateHtml = await gate.text();
    assert.equal(gateHtml.includes("test-admin"), false);
    const gateCsrf = cookieValue(gate, "csrf")!;
    const login = await hub.handle(new Request(`${SITE}/admin`, {
      method: "POST",
      headers: formHeaders(gateCsrf, cookieHeader(gate), "application/x-www-form-urlencoded"),
      body: new URLSearchParams({ token: "test-admin", csrf: gateCsrf }).toString(),
    }));
    assert.equal(login.status, 303);
    const aid = cookieValue(login, "aid");
    assert.ok(aid);
    const queue = await hub.handle(new Request(`${SITE}/admin`, {
      headers: { cookie: `aid=${aid}; csrf=${gateCsrf}` },
    }));
    const queueHtml = await queue.text();
    assert.match(queueHtml, /Html Game/);
    assert.match(queueHtml, /test report/);
    assert.equal(queueHtml.includes("test-admin"), false);
    const queueCsrf = cookieValue(queue, "csrf") ?? gateCsrf;
    await hub.handle(new Request(`${SITE}/admin/takedown`, {
      method: "POST",
      headers: formHeaders(queueCsrf, `aid=${aid}; csrf=${queueCsrf}`, "application/x-www-form-urlencoded"),
      body: new URLSearchParams({ csrf: queueCsrf, game_id: htmlId! }).toString(),
    }));
    const gone = await hub.handle(new Request(`${SITE}/en/g/${htmlId}`));
    assert.equal(gone.status, 404);
    const after = await (await hub.handle(new Request(`${SITE}/en/`))).text();
    assert.equal(after.includes("Html Game"), false);
    const goneRun = await game.handle(new Request(`${GAME}/run/${htmlId}/`));
    assert.equal(goneRun.status, 404);

    const metricsResponse = await hub.handle(new Request(`${SITE}/admin/metrics`, {
      headers: { authorization: "Bearer test-admin" },
    }));
    const stats = await metricsResponse.json() as {
      playable_games: number;
      homepage_links: number;
      hidden_links: number;
      non_author_plays: number;
      remixes: number;
      public_prompts: number;
      external_engagement_counted_in_plays: boolean;
    };
    assert.equal(stats.homepage_links, 16);
    assert.equal(stats.hidden_links, 6);
    assert.equal(stats.external_engagement_counted_in_plays, false);
    assert.ok(stats.non_author_plays >= 1);
    assert.ok(stats.remixes >= 1);
    assert.ok(stats.public_prompts >= 2);
    assert.ok(stats.playable_games >= 4);
    assert.equal(JSON.stringify(stats).includes("14437"), false);
  } finally {
    hub.close();
  }
});
