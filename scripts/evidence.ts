import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { chromium, type Page } from "playwright";
import { createApp, listen } from "../src/http/server.ts";

const root = process.cwd();
const evidence = path.join(root, "evidence");
mkdirSync(evidence, { recursive: true });

const probeHtml = `<!doctype html>
<meta charset="utf-8">
<title>probe</title>
<a id="leave" href="https://example.com/hijack" target="_top">leave</a>
<script>
window.__probe = { cookie: "", parentRead: "", parentWrite: "" };
try { window.__probe.cookie = document.cookie; }
catch (err) { window.__probe.cookie = "throw:" + (err && err.name); }
try { window.__probe.parentRead = String(parent.location.href); }
catch (err) { window.__probe.parentRead = "throw:" + (err && err.name); }
try {
  parent.location.href = "https://example.com/hijack";
  window.__probe.parentWrite = "assigned";
} catch (err) {
  window.__probe.parentWrite = "throw:" + (err && err.name);
}
</script>`;

async function shot(page: Page, name: string) {
  const file = path.join(evidence, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

const dataDir = mkdtempSync(path.join(tmpdir(), "shelf-evidence-"));
const app = createApp({
  dataDir,
  adminToken: "evidence-admin",
  repoRoot: root,
});
const server = await listen(app, 0);
const address = server.address();
if (!address || typeof address === "string") throw new Error("no port");
const base = `http://127.0.0.1:${address.port}`;

const notes: string[] = [];
const consoleLines: string[] = [];

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  page.on("console", (msg) => consoleLines.push(`[desktop ${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`[desktop pageerror] ${err.message}`));

  await page.goto(base, { waitUntil: "networkidle" });
  await shot(page, "01-home-1440.png");
  notes.push(`home 1440 title=${await page.title()} url=${page.url()}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  await shot(page, "02-home-390.png");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Lantern Dodge" }).first().click();
  await page.waitForSelector("iframe");
  await page.waitForFunction(() => document.querySelector("[data-plays]")?.textContent === "1");
  await shot(page, "03-game-1440.png");
  notes.push(`play count after iframe load=${await page.locator("[data-plays]").innerText()}`);

  const frame = page.frameLocator("iframe");
  await frame.locator("canvas").click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowUp");
  await shot(page, "05-playing-1440.png");
  notes.push(`after arrow keys url=${page.url()}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "04-game-390.png");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${base}/register`);
  await page.fill("input[name=handle]", "ada");
  await page.fill("input[name=password]", "long-password");
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForURL(base + "/");
  await shot(page, "06-registered.png");
  notes.push(`registered url=${page.url()}`);

  await page.evaluate(() => { document.cookie = "gallery=visible"; });

  await page.goto(`${base}/upload`);
  await page.fill("input[name=title]", "Html Game");
  await page.fill("textarea[name=summary]", "A single file.");
  await page.fill("input[name=model]", "Fable 5.2");
  await page.fill("textarea[name=prompt_body]", "Draw one square the player can move.");
  await page.setInputFiles("input[name=file]", {
    name: "square.html",
    mimeType: "text/html",
    buffer: Buffer.from("<!doctype html><title>Html Game</title><canvas id=c width=200 height=120></canvas><script>var c=document.getElementById('c');var x=c.getContext('2d');x.fillStyle='#243056';x.fillRect(20,20,80,60);addEventListener('keydown',function(e){if(e.code==='ArrowRight'){x.fillRect(40,20,80,60);}});</script>"),
  });
  await page.locator("form[action='/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  await shot(page, "07-uploaded-html.png");
  notes.push(`uploaded html url=${page.url()}`);

  const zip = zipSync({
    "index.html": strToU8("<!doctype html><title>Zip Game</title><p id=mark>zip-ready</p><script src=\"js/app.js\"></script>"),
    "js/app.js": strToU8("document.getElementById('mark').textContent='zip-ran';"),
  });
  await page.goto(`${base}/upload`);
  await page.fill("input[name=title]", "Zip Game");
  await page.fill("textarea[name=summary]", "Two files.");
  await page.fill("input[name=model]", "Fable 5.2");
  await page.fill("textarea[name=prompt_body]", "Show zip-ran after the script loads.");
  await page.setInputFiles("input[name=file]", {
    name: "bundle.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zip),
  });
  await page.locator("form[action='/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  await page.frameLocator("iframe").locator("#mark").waitFor();
  const zipText = await page.frameLocator("iframe").locator("#mark").innerText();
  notes.push(`zip marker=${zipText}`);
  await shot(page, "08-uploaded-zip.png");

  await page.goto(base);
  await page.getByRole("link", { name: "Lantern Dodge" }).first().click();
  await page.waitForSelector("[data-like]");
  await page.locator("[data-like]").click();
  await page.waitForFunction(() => document.querySelector("[data-likes]")?.textContent === "1");
  await shot(page, "09-liked.png");
  notes.push(`likes=${await page.locator("[data-likes]").innerText()}`);
  await page.reload();
  await page.waitForSelector("[data-likes]");
  notes.push(`likes after reload=${await page.locator("[data-likes]").innerText()}`);

  const parentUrl = page.url();
  await page.getByRole("link", { name: "Remix" }).click();
  await page.waitForSelector("textarea[name=prompt_body]");
  const prefilled = await page.locator("textarea[name=prompt_body]").inputValue();
  const parentField = await page.locator("input[name=parent_id]").inputValue();
  notes.push(`remix prefilled starts=${JSON.stringify(prefilled.slice(0, 48))} parent=${parentField}`);
  await shot(page, "10-remix-form.png");
  await page.fill("input[name=title]", "Lantern Remix");
  await page.fill("textarea[name=summary]", "A child game.");
  await page.fill("input[name=model]", "Fable 5.2");
  await page.setInputFiles("input[name=file]", {
    name: "remix.html",
    mimeType: "text/html",
    buffer: Buffer.from("<!doctype html><title>Lantern Remix</title><p>child</p>"),
  });
  await page.locator("form[action='/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  const childUrl = page.url();
  await shot(page, "11-child.png");
  await page.goto(parentUrl);
  await page.waitForSelector("text=Lantern Remix");
  await shot(page, "12-parent-remixes.png");
  notes.push(`child=${childUrl} parent still lists remix`);

  await page.goto(`${base}/upload`);
  await page.fill("input[name=title]", "Probe");
  await page.fill("textarea[name=summary]", "Security probe.");
  await page.fill("input[name=model]", "Other");
  await page.fill("textarea[name=prompt_body]", "Probe only.");
  await page.setInputFiles("input[name=file]", {
    name: "probe.html",
    mimeType: "text/html",
    buffer: Buffer.from(probeHtml),
  });
  await page.locator("form[action='/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector("iframe");
  const beforeClick = page.url();
  const probe = await page.frameLocator("iframe").locator("body").evaluate(() => {
    const value = (window as unknown as { __probe?: Record<string, string> }).__probe;
    return value ?? null;
  });
  await page.frameLocator("iframe").locator("#leave").click({ timeout: 3000 }).catch((err: Error) => {
    notes.push(`leave click error=${err.message}`);
  });
  await page.waitForTimeout(400);
  const afterClick = page.url();
  const sandbox = await page.locator("iframe").getAttribute("sandbox");
  const src = await page.locator("iframe").getAttribute("src");
  const gameResponse = await page.request.get(new URL(src ?? "/", page.url()).toString());
  notes.push(`sandbox=${sandbox}`);
  notes.push(`probe=${JSON.stringify(probe)}`);
  notes.push(`parent before=${beforeClick}`);
  notes.push(`parent after=${afterClick}`);
  notes.push(`game status=${gameResponse.status()} set-cookie=${gameResponse.headers()["set-cookie"] ?? "absent"}`);
  notes.push(`game csp=${gameResponse.headers()["content-security-policy"]}`);
  await shot(page, "13-security.png");

  const bad = zipSync({ "secret.txt": strToU8("nope") });
  await page.goto(`${base}/upload`);
  await page.fill("input[name=title]", "No Index");
  await page.fill("textarea[name=summary]", "Should fail.");
  await page.fill("input[name=model]", "Other");
  await page.fill("textarea[name=prompt_body]", "no");
  await page.setInputFiles("input[name=file]", {
    name: "bad.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(bad),
  });
  await page.locator("form[action='/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector(".notice");
  const notice = await page.locator(".notice").innerText();
  notes.push(`bad zip notice=${notice}`);
  await shot(page, "14-bad-zip.png");

  const traversal = zipSync({
    "../secret.txt": strToU8("nope"),
    "index.html": strToU8("<!doctype html><title>no</title>"),
  });
  await page.goto(`${base}/upload`);
  await page.fill("input[name=title]", "Traversal");
  await page.fill("textarea[name=summary]", "Should fail.");
  await page.fill("input[name=model]", "Other");
  await page.fill("textarea[name=prompt_body]", "no");
  await page.setInputFiles("input[name=file]", {
    name: "traversal.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(traversal),
  });
  await page.locator("form[action='/upload']").getByRole("button", { name: "Publish" }).click();
  await page.waitForSelector(".notice");
  notes.push(`traversal notice=${await page.locator(".notice").innerText()}`);
  await shot(page, "15-traversal.png");

  await desktop.close();
} finally {
  await browser.close();
  server.close();
  app.close();
}

const security = [
  "# Security record",
  "",
  "Browser: system Google Chrome via Playwright. Server: local Node process, not a public URL.",
  "",
  "## Steps",
  ...notes.map((line) => `- ${line}`),
  "",
  "## Console",
  ...consoleLines.map((line) => `- ${line}`),
  "",
].join("\n");

const securityPath = path.join(evidence, "security-record.md");
writeFileSync(securityPath, security);
const digest = createHash("sha256").update(readFileSync(securityPath)).digest("hex");
writeFileSync(`${securityPath}.sha`, `${digest}\n`);
console.log(security);
console.log(`sha256 ${digest}`);
