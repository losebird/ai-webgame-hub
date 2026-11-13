import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { compareSecrets } from "../src/crypto-util.js";
import { GAME, SITE, bootCsrf, cookieValue, createTestShelf, formHeaders, type App } from "../src/test-app.js";

const repo = path.resolve(import.meta.dirname, "..");

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "webgame-sec-"));
}

async function register(app: App, handle: string) {
  const boot = await bootCsrf(app);
  const response = await app.handle(new Request(`${SITE}/en/register`, {
    method: "POST",
    headers: formHeaders(boot.csrf, boot.cookie, "application/x-www-form-urlencoded"),
    body: new URLSearchParams({ handle, password: "long-password", next: "/en/", csrf: boot.csrf }).toString(),
  }));
  const sid = cookieValue(response, "sid");
  assert.ok(sid);
  return { cookie: `sid=${sid}; csrf=${boot.csrf}`, csrf: boot.csrf };
}

function multipart(fields: Record<string, string>, file: { filename: string; data: Uint8Array }) {
  const boundary = "----sec";
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const push = (value: string | Uint8Array) => parts.push(typeof value === "string" ? enc.encode(value) : value);
  for (const [key, value] of Object.entries(fields)) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
  }
  push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  push(file.data);
  push(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function upload(hub: App, session: { cookie: string; csrf: string }, fields: Record<string, string>, file: { filename: string; data: Uint8Array }) {
  const packed = multipart({ ...fields, csrf: session.csrf }, file);
  const response = await hub.handle(new Request(`${SITE}/en/upload`, {
    method: "POST",
    headers: formHeaders(session.csrf, session.cookie, packed.contentType),
    body: packed.body,
  }));
  return response;
}

test("D1 hub /run is 404 and game origin has sandbox CSP without cookies or api", async () => {
  const { hub, game } = createTestShelf({ dir: tempDir(), repoRoot: repo });
  try {
    const home = await (await hub.handle(new Request(`${SITE}/en/`))).text();
    const id = [...home.matchAll(/href="\/en\/g\/([^"]+)"/g)].at(-1)?.[1];
    assert.ok(id);
    assert.equal((await hub.handle(new Request(`${SITE}/run/${id}/`))).status, 404);
    const run = await game.handle(new Request(`${GAME}/run/${id}/`));
    const csp = run.headers.get("content-security-policy") ?? "";
    assert.match(csp, /sandbox allow-scripts allow-pointer-lock/);
    assert.equal(csp.includes("allow-same-origin"), false);
    assert.equal(csp.includes("allow-top-navigation"), false);
    assert.equal(csp.includes("allow-popups"), false);
    assert.equal(csp.includes("allow-forms"), false);
    assert.equal(run.headers.get("set-cookie"), null);
    assert.equal((await game.handle(new Request(`${GAME}/api/games/${id}/play`, { method: "POST" }))).status, 404);
    assert.equal((await game.handle(new Request(`${GAME}/en/`))).status, 404);
  } finally {
    hub.close();
  }
});

test("D2 forged IP headers cannot inflate plays and authors do not count", async () => {
  const { hub } = createTestShelf({ dir: tempDir(), repoRoot: repo });
  try {
    const home = await (await hub.handle(new Request(`${SITE}/en/`))).text();
    const dodgeId = [...home.matchAll(/href="\/en\/g\/([^"]+)"/g)].find(() => home.includes("Lantern Dodge"))
      ? [...home.slice(0, home.indexOf("<h3>Lantern Dodge</h3>") + 1).matchAll(/href="\/en\/g\/([^"]+)"/g)].at(-1)?.[1]
      : undefined;
    const at = home.indexOf("<h3>Lantern Dodge</h3>");
    const id = [...home.slice(Math.max(0, at - 500), at).matchAll(/href="\/en\/g\/([^"]+)"/g)].at(-1)?.[1];
    assert.ok(id);
    void dodgeId;
    const boot = await bootCsrf(hub);
    const first = await (await hub.handle(new Request(`${SITE}/api/games/${id}/play`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "text/plain"),
    }))).json() as { counted: boolean; plays: number };
    assert.equal(first.counted, true);
    const spoof = await (await hub.handle(new Request(`${SITE}/api/games/${id}/play`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "text/plain", { "x-ace-ip": "8.8.8.8", "x-forwarded-for": "1.2.3.4" }),
    }))).json() as { counted: boolean; plays: number };
    assert.equal(spoof.counted, false);
    assert.equal(spoof.plays, 1);
    const other = await (await hub.handle(new Request(`${SITE}/api/games/${id}/play`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "text/plain", { "cf-connecting-ip": "8.8.8.8" }),
    }))).json() as { counted: boolean; plays: number };
    assert.equal(other.counted, true);
    assert.equal(other.plays, 2);

    const author = await register(hub, "owner1");
    const published = await upload(hub, author, {
      title: "Owner Game",
      summary: "mine",
      model: "Other",
      prompt_body: "x",
      prompt_public: "on",
    }, { filename: "mine.html", data: strToU8("<!doctype html><title>Owner Game</title>") });
    const ownId = (published.headers.get("location") ?? "").split("/").pop();
    const selfPlay = await (await hub.handle(new Request(`${SITE}/api/games/${ownId}/play`, {
      method: "POST",
      headers: formHeaders(author.csrf, author.cookie, "text/plain", { "cf-connecting-ip": "9.9.9.9" }),
    }))).json() as { counted: boolean; plays: number };
    assert.equal(selfPlay.counted, false);
    assert.equal(selfPlay.plays, 0);
  } finally {
    hub.close();
  }
});

test("D3 private prompt parent returns bad_parent", async () => {
  const { hub } = createTestShelf({ dir: tempDir(), repoRoot: repo });
  try {
    const author = await register(hub, "privy");
    const parentRes = await upload(hub, author, {
      title: "Secret Parent",
      summary: "hidden prompt",
      model: "Other",
      prompt_body: "do not remix",
    }, { filename: "secret.html", data: strToU8("<!doctype html><title>Secret Parent</title>") });
    const parentId = (parentRes.headers.get("location") ?? "").split("/").pop()!;
    const remix = await upload(hub, author, {
      title: "Child",
      summary: "no",
      model: "Other",
      prompt_body: "x",
      prompt_public: "on",
      parent_id: parentId,
    }, { filename: "child.html", data: strToU8("<!doctype html><title>Child</title>") });
    assert.match(remix.headers.get("location") ?? "", /bad_parent/);
  } finally {
    hub.close();
  }
});

test("D4 takedown deletes R2 objects", async () => {
  const { hub, game, blobs } = createTestShelf({ dir: tempDir(), repoRoot: repo });
  try {
    const author = await register(hub, "deleter");
    const published = await upload(hub, author, {
      title: "Doomed",
      summary: "gone",
      model: "Other",
      prompt_body: "x",
      prompt_public: "on",
    }, { filename: "doomed.html", data: strToU8("<!doctype html><title>Doomed</title>") });
    const id = (published.headers.get("location") ?? "").split("/").pop()!;
    assert.ok((await blobs.list(`games/${id}/`)).length > 0);
    const gate = await hub.handle(new Request(`${SITE}/admin`));
    const csrf = cookieValue(gate, "csrf")!;
    const login = await hub.handle(new Request(`${SITE}/admin`, {
      method: "POST",
      headers: formHeaders(csrf, `csrf=${csrf}`, "application/x-www-form-urlencoded"),
      body: new URLSearchParams({ token: "test-admin", csrf }).toString(),
    }));
    const aid = cookieValue(login, "aid")!;
    await hub.handle(new Request(`${SITE}/admin/takedown`, {
      method: "POST",
      headers: formHeaders(csrf, `aid=${aid}; csrf=${csrf}`, "application/x-www-form-urlencoded"),
      body: new URLSearchParams({ csrf, game_id: id }).toString(),
    }));
    assert.deepEqual(await blobs.list(`games/${id}/`), []);
    assert.equal((await game.handle(new Request(`${GAME}/run/${id}/`))).status, 404);
  } finally {
    hub.close();
  }
});

test("D5 renamed zip uploaded as html is rejected", async () => {
  const { hub } = createTestShelf({ dir: tempDir(), repoRoot: repo });
  try {
    const author = await register(hub, "sniff");
    const zip = zipSync({ "index.html": strToU8("<html></html>") });
    const response = await upload(hub, author, {
      title: "Fake Html",
      summary: "no",
      model: "Other",
      prompt_body: "x",
      prompt_public: "on",
    }, { filename: "game.html", data: zip });
    assert.match(response.headers.get("location") ?? "", /not_html/);
  } finally {
    hub.close();
  }
});

test("D6 admin token is not in HTML, origin and csrf are required, compare is constant-time", async () => {
  const { hub } = createTestShelf({ dir: tempDir(), repoRoot: repo });
  try {
    const page = await (await hub.handle(new Request(`${SITE}/admin`))).text();
    assert.equal(page.includes("test-admin"), false);
    assert.equal(page.includes('name="token" type="hidden"'), false);
    const boot = await bootCsrf(hub);
    const noOrigin = await hub.handle(new Request(`${SITE}/api/games/x/play`, {
      method: "POST",
      headers: { cookie: boot.cookie, "x-csrf-token": boot.csrf },
    }));
    assert.equal(noOrigin.status, 403);
    const badOrigin = await hub.handle(new Request(`${SITE}/api/games/x/play`, {
      method: "POST",
      headers: formHeaders(boot.csrf, boot.cookie, "text/plain", { origin: "https://evil.example" }),
    }));
    assert.equal(badOrigin.status, 403);
    const noCsrf = await hub.handle(new Request(`${SITE}/api/games/x/play`, {
      method: "POST",
      headers: { origin: SITE, cookie: boot.cookie },
    }));
    assert.equal(noCsrf.status, 403);
    assert.equal(compareSecrets("test-admin", "test-admin"), true);
    assert.equal(compareSecrets("test-admin", "test-admi!"), false);
    const src = readFileSync(path.join(repo, "src/crypto-util.ts"), "utf8");
    assert.match(src, /function compareSecrets/);
    assert.match(src, /diff \|=/);
  } finally {
    hub.close();
  }
});

test("i18n urls, remembered language, and site name config", async () => {
  const { hub } = createTestShelf({ dir: tempDir(), repoRoot: repo, siteName: "Arcade Bay" });
  try {
    const root = await hub.handle(new Request(SITE + "/", { headers: { "accept-language": "zh-CN,zh;q=0.9" } }));
    assert.equal(root.status, 303);
    assert.equal(root.headers.get("location"), "/zh/");
    const zh = await (await hub.handle(new Request(`${SITE}/zh/`))).text();
    assert.match(zh, /Arcade Bay/);
    assert.match(zh, /浏览器游戏/);
    const en = await (await hub.handle(new Request(`${SITE}/en/`))).text();
    assert.match(en, /Browser games/);
    const switched = await hub.handle(new Request(`${SITE}/lang?set=en&next=/zh/`));
    assert.equal(switched.headers.get("location"), "/en/");
    assert.match(cookieValue(switched, "lang") ?? "", /en/);
  } finally {
    hub.close();
  }
});

test("external cards stay cards and next=//evil is recovered", async () => {
  const { hub } = createTestShelf({ dir: tempDir(), repoRoot: repo });
  try {
    const home = await (await hub.handle(new Request(`${SITE}/en/`))).text();
    assert.equal(home.includes("<iframe"), false);
    assert.match(home, /rel="noopener noreferrer"/);
    const login = await (await hub.handle(new Request(`${SITE}/en/login?next=${encodeURIComponent("//evil.example")}`))).text();
    assert.match(login, /name="next" value="\/en\/"/);
    assert.equal(/name="next" value="[^"]*evil/.test(login), false);
  } finally {
    hub.close();
  }
});
