import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { chromium, type Page } from "playwright";

const root = process.cwd();
const evidence = path.join(root, "evidence-r2");
mkdirSync(evidence, { recursive: true });

const hubBase = process.env.EV_HUB ?? "http://127.0.0.1:8787";
const gameBase = process.env.EV_GAME ?? "http://127.0.0.1:8788";
const persist = path.join(root, ".wrangler", "state-evidence");

const notes: string[] = [];
const consoleLines: string[] = [];
const children: ChildProcess[] = [];

function shaFile(file: string) {
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  writeFileSync(`${file}.sha`, `${digest}\n`);
  return digest;
}

function writeRecord(name: string, body: string) {
  const file = path.join(evidence, name);
  writeFileSync(file, body);
  const digest = shaFile(file);
  notes.push(`${name} sha256=${digest}`);
  return file;
}

async function waitHttp(url: string, ok: (status: number) => boolean = (status) => status === 200, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (ok(res.status)) return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`timeout waiting for ${url}`);
}

function startWorker(config: string, port: number, inspectorPort: number) {
  const wranglerBin = path.join(root, "node_modules", ".bin", "wrangler");
  const logFile = path.join(evidence, `wrangler-${port}.log`);
  const child = spawn(
    wranglerBin,
    ["dev", "-c", config, "--port", String(port), "--inspector-port", String(inspectorPort), "--persist-to", persist, "--ip", "127.0.0.1"],
    { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(child);
  const append = (buf: Buffer) => {
    const text = buf.toString();
    writeFileSync(logFile, text, { flag: "a" });
    if (text.includes("Ready on") || /error/i.test(text)) notes.push(`[wrangler ${port}] ${text.trim().slice(0, 240)}`);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.on("exit", (code) => notes.push(`[wrangler ${port}] exit ${code}`));
  return child;
}

async function shot(page: Page, name: string) {
  const file = path.join(evidence, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function stopAll() {
  for (const child of children) {
    child.kill("SIGTERM");
  }
}

const probeHtml = readFileSync(path.join(root, "fixtures/evil-direct.html"), "utf8");

const skipStart = process.env.EV_SKIP_START === "1";
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
if (!skipStart) {
  startWorker("wrangler.hub.toml", 8787, 9230);
  await waitHttp(`${hubBase}/en/`);
  startWorker("wrangler.game.toml", 8788, 9231);
  await waitHttp(`${gameBase}/run/missing/`, (status) => status === 404);
} else {
  await waitHttp(`${hubBase}/en/`);
}

browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
  const page = await desktop.newPage();
  page.on("console", (msg) => consoleLines.push(`[desktop ${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`[desktop pageerror] ${err.message}`));

  await page.goto(`${hubBase}/zh/`, { waitUntil: "networkidle" });
  await shot(page, "01-home-zh-1440.png");
  notes.push(`home zh 1440 title=${await page.title()} url=${page.url()}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${hubBase}/zh/`, { waitUntil: "networkidle" });
  await shot(page, "02-home-zh-390.png");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${hubBase}/zh/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "灯笼躲闪" }).first().click();
  await page.waitForSelector("iframe");
  await page.waitForTimeout(800);
  await shot(page, "03-game-zh-1440.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "04-game-zh-390.png");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${hubBase}/zh/`);
  await shot(page, "16-lang-before-zh.png");
  await page.locator("a.lang").click();
  await page.waitForURL(/\/en\//);
  await shot(page, "17-lang-after-en.png");
  notes.push(`after lang switch url=${page.url()} title=${await page.title()}`);

  await page.goto(`${hubBase}/en/`, { waitUntil: "networkidle" });
  await shot(page, "18-home-en-1440.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${hubBase}/en/`, { waitUntil: "networkidle" });
  await shot(page, "19-home-en-390.png");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${hubBase}/en/`);
  await page.getByRole("link", { name: "Lantern Dodge" }).first().click();
  await page.waitForSelector("iframe");
  await page.waitForFunction(() => document.querySelector("[data-plays]")?.textContent === "1" || document.querySelector("[data-plays]")?.textContent === "0" || true);
  await shot(page, "20-game-en-1440.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "21-game-en-390.png");
  await page.setViewportSize({ width: 1440, height: 900 });

  const frame = page.frameLocator("iframe");
  await frame.locator("canvas").click({ timeout: 5000 }).catch((err: Error) => notes.push(`canvas click=${err.message}`));
  await shot(page, "05-playing-1440.png");

  await page.goto(`${hubBase}/en/register`);
  await page.fill("input[name=handle]", "ada");
  await page.fill("input[name=password]", "long-password");
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForTimeout(800);
  notes.push(`register after click url=${page.url()} body=${((await page.textContent("body")) ?? "").slice(0, 180)}`);
  await page.waitForURL(/\/en\/?$/, { timeout: 15000 });
  await shot(page, "06-registered.png");
  notes.push(`registered url=${page.url()}`);

  await page.evaluate(() => { document.cookie = "gallery=visible"; });

  await page.goto(`${hubBase}/en/upload`);
  await page.fill("input[name=title]", "Html Game");
  await page.fill("textarea[name=summary]", "A single file.");
  await page.fill("input[name=model]", "Fable 5.2");
  await page.fill("textarea[name=prompt_body]", "Draw one square the player can move.");
  await page.setInputFiles("input[name=file]", {
    name: "square.html",
    mimeType: "text/html",
    buffer: Buffer.from("<!doctype html><title>Html Game</title><canvas id=c width=200 height=120></canvas><script>var c=document.getElementById('c');var x=c.getContext('2d');x.fillStyle='#243056';x.fillRect(20,20,80,60);</script>"),
  });
  await page.locator("form[action='/en/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  await shot(page, "07-uploaded-html.png");
  notes.push(`uploaded html url=${page.url()}`);

  const zip = zipSync({
    "index.html": strToU8("<!doctype html><title>Zip Game</title><p id=mark>zip-ready</p><script src=\"js/app.js\"></script>"),
    "js/app.js": strToU8("document.getElementById('mark').textContent='zip-ran';"),
  });
  await page.goto(`${hubBase}/en/upload`);
  await page.fill("input[name=title]", "Zip Game");
  await page.fill("textarea[name=summary]", "Two files.");
  await page.fill("input[name=model]", "Fable 5.2");
  await page.fill("textarea[name=prompt_body]", "Show zip-ran after the script loads.");
  await page.setInputFiles("input[name=file]", {
    name: "bundle.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zip),
  });
  await page.locator("form[action='/en/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  await page.frameLocator("iframe").locator("#mark").waitFor();
  notes.push(`zip marker=${await page.frameLocator("iframe").locator("#mark").innerText()}`);
  await shot(page, "08-uploaded-zip.png");

  await page.goto(`${hubBase}/en/`);
  await page.getByRole("link", { name: "Lantern Dodge" }).first().click();
  await page.waitForSelector("[data-like]");
  await page.locator("[data-like]").click();
  await page.waitForTimeout(500);
  await shot(page, "09-liked.png");
  notes.push(`likes=${await page.locator("[data-likes]").innerText()}`);

  const parentUrl = page.url();
  await page.getByRole("link", { name: "Remix" }).click();
  await page.waitForSelector("textarea[name=prompt_body]");
  notes.push(`remix prefilled starts=${JSON.stringify((await page.locator("textarea[name=prompt_body]").inputValue()).slice(0, 48))}`);
  await shot(page, "10-remix-form.png");
  await page.fill("input[name=title]", "Lantern Remix");
  await page.fill("textarea[name=summary]", "A child game.");
  await page.fill("input[name=model]", "Fable 5.2");
  await page.setInputFiles("input[name=file]", {
    name: "remix.html",
    mimeType: "text/html",
    buffer: Buffer.from("<!doctype html><title>Lantern Remix</title><p>child</p>"),
  });
  await page.locator("form[action='/en/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  await shot(page, "11-child.png");
  await page.goto(parentUrl);
  await page.waitForSelector("text=Lantern Remix");
  await shot(page, "12-parent-remixes.png");

  const htmlId = new URL(page.url()).pathname.split("/").pop() ?? "";
  void htmlId;
  await page.goto(`${hubBase}/en/upload`);
  await page.fill("input[name=title]", "Probe");
  await page.fill("textarea[name=summary]", "Security probe.");
  await page.fill("input[name=model]", "Other");
  await page.fill("textarea[name=prompt_body]", "Probe only.");
  await page.setInputFiles("input[name=file]", {
    name: "probe.html",
    mimeType: "text/html",
    buffer: Buffer.from(`<!doctype html><meta charset="utf-8"><title>probe</title>
<a id="leave" href="https://example.com/hijack" target="_top">leave</a>
<script>
window.__probe = { cookie: "", parentRead: "", parentWrite: "" };
try { window.__probe.cookie = document.cookie; } catch (err) { window.__probe.cookie = "throw:" + (err && err.name); }
try { window.__probe.parentRead = String(parent.location.href); } catch (err) { window.__probe.parentRead = "throw:" + (err && err.name); }
try { parent.location.href = "https://example.com/hijack"; window.__probe.parentWrite = "assigned"; }
catch (err) { window.__probe.parentWrite = "throw:" + (err && err.name); }
</script>`),
  });
  await page.locator("form[action='/en/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  const beforeClick = page.url();
  const probe = await page.frameLocator("iframe").locator("body").evaluate(() => {
    const value = (window as unknown as { __probe?: Record<string, string> }).__probe;
    return value ?? null;
  });
  await page.frameLocator("iframe").locator("#leave").click({ timeout: 3000 }).catch((err: Error) => notes.push(`leave click error=${err.message}`));
  await page.waitForTimeout(400);
  const afterClick = page.url();
  const sandbox = await page.locator("iframe").getAttribute("sandbox");
  const src = await page.locator("iframe").getAttribute("src");
  const gameResponse = await page.request.get(src ?? `${gameBase}/`);
  notes.push(`sandbox=${sandbox}`);
  notes.push(`iframe probe=${JSON.stringify(probe)}`);
  notes.push(`parent before=${beforeClick}`);
  notes.push(`parent after=${afterClick}`);
  notes.push(`game status=${gameResponse.status()} set-cookie=${gameResponse.headers()["set-cookie"] ?? "absent"}`);
  notes.push(`game csp=${gameResponse.headers()["content-security-policy"]}`);
  await shot(page, "13-security.png");

  const probeId = src?.split("/run/")[1]?.replace(/\/$/, "") ?? "";
  const top = await desktop.newPage();
  await top.goto(`${gameBase}/run/${probeId}/?hub=${encodeURIComponent(hubBase)}&game=${probeId}`);
  const topOrigin = await top.evaluate(() => location.origin);
  const topCookie = await top.evaluate(() => document.cookie);
  notes.push(`direct top origin=${topOrigin} cookie=${JSON.stringify(topCookie)}`);
  const evil = probeHtml.replace("running", "ready");
  await page.goto(`${hubBase}/en/upload`);
  await page.fill("input[name=title]", "Evil Direct");
  await page.fill("textarea[name=summary]", "D1 fixture.");
  await page.fill("input[name=model]", "Other");
  await page.fill("textarea[name=prompt_body]", "probe");
  await page.setInputFiles("input[name=file]", {
    name: "evil-direct.html",
    mimeType: "text/html",
    buffer: Buffer.from(evil),
  });
  await page.locator("form[action='/en/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  const evilSrc = await page.locator("iframe").getAttribute("src");
  const evilPage = await desktop.newPage();
  await evilPage.goto(`${evilSrc}?hub=${encodeURIComponent(hubBase)}&game=x`);
  await evilPage.waitForTimeout(900);
  const evilOut = await evilPage.locator("#out").innerText().catch(() => "missing");
  notes.push(`evil-direct top output=${evilOut.replaceAll("\n", " | ")}`);
  notes.push(`evil-direct set-cookie=${(await evilPage.request.get(evilSrc ?? gameBase)).headers()["set-cookie"] ?? "absent"}`);

  const blocked = await fetch(`${hubBase}/api/games/x/play`, {
    method: "POST",
    headers: { origin: gameBase, "x-csrf-token": "nope" },
  });
  notes.push(`game-origin fetch hub api status=${blocked.status}`);

  const bad = zipSync({ "secret.txt": strToU8("nope") });
  await page.goto(`${hubBase}/en/upload`);
  await page.fill("input[name=title]", "No Index");
  await page.fill("textarea[name=summary]", "Should fail.");
  await page.fill("input[name=model]", "Other");
  await page.fill("textarea[name=prompt_body]", "no");
  await page.setInputFiles("input[name=file]", { name: "bad.zip", mimeType: "application/zip", buffer: Buffer.from(bad) });
  await page.locator("form[action='/en/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector(".notice");
  notes.push(`bad zip notice=${await page.locator(".notice").innerText()}`);
  await shot(page, "14-bad-zip.png");

  await page.goto(`${hubBase}/en/upload`);
  await page.fill("input[name=title]", "Traversal");
  await page.fill("textarea[name=summary]", "Should fail.");
  await page.fill("input[name=model]", "Other");
  await page.fill("textarea[name=prompt_body]", "no");
  await page.setInputFiles("input[name=file]", {
    name: "traversal.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zipSync({ "../secret.txt": strToU8("nope"), "index.html": strToU8("<!doctype html><title>no</title>") })),
  });
  await page.locator("form[action='/en/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector(".notice");
  notes.push(`traversal notice=${await page.locator(".notice").innerText()}`);
  await shot(page, "15-traversal.png");

  await desktop.close();
} catch (err) {
  notes.push(`evidence error=${err instanceof Error ? err.stack ?? err.message : String(err)}`);
} finally {
  if (browser) await browser.close();
  if (!skipStart) stopAll();
}

const envLines = [
  `node ${process.version}`,
  `platform ${process.platform} ${process.arch}`,
];

const security = [
  "# Security record (r2)",
  "",
  "Browser: Playwright Chromium. Servers: wrangler dev --local, two origins, no Cloudflare account.",
  "",
  "## Environment",
  ...envLines.map((line) => `- ${line}`),
  "",
  "## Steps",
  ...notes.map((line) => `- ${line}`),
  "",
  "## Console",
  ...consoleLines.map((line) => `- ${line}`),
  "",
].join("\n");

writeRecord("security-record.md", security);
writeRecord("evidence-log.md", notes.map((line) => `- ${line}`).join("\n") + "\n");
console.log(security);
if (notes.some((line) => line.startsWith("evidence error="))) process.exit(1);
