import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { linkCounts, openDb } from "../src/db.js";
import { createApp, type App } from "../src/http/server.js";
import { importSeedFile, importSeedText } from "../src/links/import.js";

const repo = path.resolve(import.meta.dirname, "..");

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "shelf-"));
}

function walk(dir: string, acc: string[] = []): string[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, acc);
    else acc.push(path.relative(dir, abs));
  }
  return acc;
}

function cookieOf(response: Response): string {
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.length > 0, "expected a session cookie");
  return cookies[0]!.split(";")[0]!;
}

async function register(app: App, handle: string): Promise<string> {
  const response = await app.handle(new Request("http://127.0.0.1/register", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ handle, password: "long-password", next: "/" }).toString(),
  }));
  assert.equal(response.status, 303);
  return cookieOf(response);
}

function multipart(fields: Record<string, string>, file: { filename: string; data: Uint8Array }) {
  const boundary = "----aceshelf";
  const chunks: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
    ));
  }
  chunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  ));
  chunks.push(Buffer.from(file.data));
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
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

test("seed import is idempotent and lists bad rows", () => {
  const dir = tempDir();
  const db = openDb(path.join(dir, "hub.sqlite"));
  const seed = path.join(repo, "data/seed/seed-games.json");
  const first = importSeedFile(db, seed);
  const second = importSeedFile(db, seed);
  assert.equal(first.documentError, null);
  assert.equal(first.rejected.length, 0);
  assert.equal(first.homepage, 16);
  assert.equal(first.hidden, 6);
  assert.equal(second.imported, 22);
  const counts = linkCounts(db);
  assert.equal(counts.homepage, 16);
  assert.equal(counts.hidden, 6);

  const mixed = importSeedText(db, JSON.stringify([
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
  assert.equal(linkCounts(db).homepage, 17);
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
  const app = createApp({ dataDir: dir, adminToken: "test-admin", repoRoot: repo });
  try {
    const homeResponse = await app.handle(new Request("http://127.0.0.1/"));
    const home = await homeResponse.text();
    assert.match(home, /Lantern Dodge/);
    assert.match(home, /Paper Bird/);
    assert.match(home, /Saltline/);
    assert.equal(home.includes("Turbo Tails"), false);
    assert.equal(home.includes("example_author"), false);
    assert.equal(home.includes("4272701"), false);
    assert.equal(home.includes("<iframe"), false);
    assert.match(home, /不是本站游玩数/);
    assert.match(home, /href="https:\/\/x\.com\/felixrieseberg\/status\/2119925633564463609"/);
    assert.match(home, /target="_blank"/);
    assert.match(home, /rel="noopener noreferrer"/);
    assert.match(home, /Ace Shelf/);

    const idFor = (title: string) => {
      const at = home.indexOf(`<h3>${title}</h3>`);
      assert.ok(at > 0, title);
      const slice = home.slice(Math.max(0, at - 500), at);
      const found = [...slice.matchAll(/href="\/g\/([^"]+)"/g)];
      return found.at(-1)?.[1];
    };
    const dodgeId = idFor("Lantern Dodge");
    const birdId = idFor("Paper Bird");
    assert.ok(dodgeId && birdId);
    assert.notEqual(dodgeId, birdId);

    const dodgePage = await (await app.handle(new Request(`http://127.0.0.1/g/${dodgeId}`))).text();
    assert.match(dodgePage, /sandbox="allow-scripts allow-pointer-lock"/);
    assert.equal(dodgePage.includes("allow-same-origin"), false);
    assert.equal(dodgePage.includes("allow-popups"), false);
    assert.equal(dodgePage.includes("allow-top-navigation"), false);
    assert.match(dodgePage, /Embers fall/);

    const run = await app.handle(new Request(`http://127.0.0.1/run/${birdId}/`));
    const csp = run.headers.get("content-security-policy") ?? "";
    assert.match(csp, /connect-src 'none'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.equal(csp.includes("https:"), false);
    assert.equal(run.headers.get("set-cookie"), null);
    const birdHtml = await run.text();
    assert.match(birdHtml, /Paper Bird/);
    assert.match(birdHtml, /placePipe/);
    assert.equal(birdHtml.includes('src="js/game.js"'), false);
    assert.equal(birdHtml.includes('href="css/game.css"'), false);

    const blobs = path.join(dir, "blobs");
    const before = walk(blobs).sort();
    const hostile = multipart(
      { title: "Hostile", summary: "no", model: "Other", tags: "", prompt_body: "no", prompt_public: "on" },
      { filename: "bad.zip", data: traversalZip() },
    );
    const author = await register(app, "ada");
    const rejected = await app.handle(new Request("http://127.0.0.1/upload", {
      method: "POST",
      headers: { "content-type": hostile.contentType, cookie: author },
      body: hostile.body,
    }));
    assert.equal(rejected.status, 303);
    assert.match(rejected.headers.get("location") ?? "", /error=path_traversal/);
    const errorPage = await (await app.handle(new Request(`http://127.0.0.1${rejected.headers.get("location")}`, {
      headers: { cookie: author },
    }))).text();
    assert.match(errorPage, /escapes its folder/);
    assert.deepEqual(walk(blobs).sort(), before);

    const played = await app.handle(new Request(`http://127.0.0.1/api/games/${dodgeId}/play`, { method: "POST" }));
    const firstPlay = await played.json() as { plays: number; counted: boolean };
    assert.equal(firstPlay.counted, true);
    assert.equal(firstPlay.plays, 1);
    const second = await (await app.handle(new Request(`http://127.0.0.1/api/games/${dodgeId}/play`, { method: "POST" }))).json() as { plays: number; counted: boolean };
    assert.equal(second.counted, false);
    assert.equal(second.plays, 1);
    const refreshed = await (await app.handle(new Request(`http://127.0.0.1/g/${dodgeId}`))).text();
    assert.match(refreshed, /data-plays>1</);

    const anonLike = await app.handle(new Request(`http://127.0.0.1/api/games/${dodgeId}/like`, { method: "POST" }));
    assert.equal(anonLike.status, 401);
    const liked = await (await app.handle(new Request(`http://127.0.0.1/api/games/${dodgeId}/like`, {
      method: "POST",
      headers: { cookie: author },
    }))).json() as { likes: number; liked: boolean };
    assert.equal(liked.liked, true);
    assert.equal(liked.likes, 1);
    const likedPage = await (await app.handle(new Request(`http://127.0.0.1/g/${dodgeId}`, {
      headers: { cookie: author },
    }))).text();
    assert.match(likedPage, /data-likes>1</);

    const htmlUpload = multipart({
      title: "Html Game",
      summary: "A single file.",
      model: "Fable 5.2",
      tags: "puzzle",
      prompt_body: "Draw one square.",
      prompt_public: "on",
    }, {
      filename: "square.html",
      data: strToU8("<!doctype html><title>Html Game</title><p>square</p>"),
    });
    const htmlRes = await app.handle(new Request("http://127.0.0.1/upload", {
      method: "POST",
      headers: { cookie: author, "content-type": htmlUpload.contentType },
      body: htmlUpload.body,
    }));
    assert.equal(htmlRes.status, 303);
    const htmlId = (htmlRes.headers.get("location") ?? "").replace("/g/", "");
    const htmlPage = await (await app.handle(new Request(`http://127.0.0.1/g/${htmlId}`))).text();
    assert.match(htmlPage, /Fable 5\.2/);
    assert.match(htmlPage, /Draw one square/);
    const latest = await (await app.handle(new Request("http://127.0.0.1/"))).text();
    assert.match(latest, /Html Game/);

    const zipUpload = multipart({
      title: "Zip Game",
      summary: "Two files.",
      model: "Fable 5.2",
      tags: "puzzle",
      prompt_body: "Two files.",
      prompt_public: "on",
    }, {
      filename: "bundle.zip",
      data: zipSync({
        "index.html": strToU8("<!doctype html><title>Zip Game</title><script src=\"js/app.js\"></script>"),
        "js/app.js": strToU8("var zipMarker = 'zip-ready';"),
      }),
    });
    const zipRes = await app.handle(new Request("http://127.0.0.1/upload", {
      method: "POST",
      headers: { cookie: author, "content-type": zipUpload.contentType },
      body: zipUpload.body,
    }));
    const zipId = (zipRes.headers.get("location") ?? "").replace("/g/", "");
    const zipRun = await (await app.handle(new Request(`http://127.0.0.1/run/${zipId}/`))).text();
    assert.match(zipRun, /zip-ready/);
    assert.equal(zipRun.includes('src="js/app.js"'), false);

    const remixForm = await (await app.handle(new Request(`http://127.0.0.1/upload?parent=${dodgeId}`, {
      headers: { cookie: author },
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
      parent_id: dodgeId,
    }, {
      filename: "remix.html",
      data: strToU8("<!doctype html><title>Lantern Remix</title>"),
    });
    const remixRes = await app.handle(new Request("http://127.0.0.1/upload", {
      method: "POST",
      headers: { cookie: author, "content-type": remix.contentType },
      body: remix.body,
    }));
    const remixId = (remixRes.headers.get("location") ?? "").replace("/g/", "");
    const parentPage = await (await app.handle(new Request(`http://127.0.0.1/g/${dodgeId}`))).text();
    assert.match(parentPage, /Lantern Remix/);
    const childPage = await (await app.handle(new Request(`http://127.0.0.1/g/${remixId}`))).text();
    assert.match(childPage, /Remix of/);
    assert.match(childPage, new RegExp(`/g/${dodgeId}`));

    const report = await app.handle(new Request(`http://127.0.0.1/api/games/${htmlId}/report`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ reason: "copyright", detail: "test report" }).toString(),
    }));
    assert.equal(report.status, 303);
    const queue = await app.handle(new Request("http://127.0.0.1/admin", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: "test-admin" }).toString(),
    }));
    const queueHtml = await queue.text();
    assert.match(queueHtml, /Html Game/);
    assert.match(queueHtml, /test report/);
    await app.handle(new Request("http://127.0.0.1/admin/takedown", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: "test-admin", game_id: htmlId }).toString(),
    }));
    const gone = await app.handle(new Request(`http://127.0.0.1/g/${htmlId}`));
    assert.equal(gone.status, 404);
    const after = await (await app.handle(new Request("http://127.0.0.1/"))).text();
    assert.equal(after.includes("Html Game"), false);

    const metricsResponse = await app.handle(new Request("http://127.0.0.1/admin/metrics", {
      headers: { "x-admin-token": "test-admin" },
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
    app.close();
  }
});
