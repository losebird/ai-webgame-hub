import type { GameRow, LinkRow, ReportRow, User } from "../db.js";
import { offsiteLabel, esc } from "../text.js";

type Shell = {
  title: string;
  user: User | null;
  body: string;
  notice?: string;
};

export function layout(input: Shell): string {
  const account = input.user
    ? `<span class="who">${esc(input.user.handle)}</span>
       <form method="post" action="/logout"><button class="text" type="submit">Log out</button></form>`
    : `<a href="/login">Log in</a><a class="button" href="/register">Register</a>`;
  const notice = input.notice ? `<p class="notice">${esc(input.notice)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.title)} · Ace Shelf</title>
<link rel="stylesheet" href="/static/site.css">
</head>
<body>
<header class="top">
  <a class="brand" href="/">Ace Shelf <span>艾斯架</span></a>
  <nav>
    <a href="/">Games</a>
    <a href="/upload">Upload</a>
    <a href="/policy">Rules</a>
    ${account}
  </nav>
</header>
<main>
  ${notice}
  ${input.body}
</main>
<footer>
  <p>Ace Shelf hosts browser games for free. No ads. No payments. Games run in a sandbox.</p>
</footer>
<script src="/static/site.js"></script>
</body>
</html>`;
}

function gameCard(game: GameRow): string {
  const tags = game.tags.map((tag) => `<span>${esc(tag)}</span>`).join("");
  return `<a class="card" href="/g/${esc(game.id)}">
    <img src="/cover/game/${esc(game.id)}.svg" alt="">
    <div>
      <h3>${esc(game.title)}</h3>
      <p class="by">@${esc(game.authorHandle)}</p>
      <p class="tags">${tags}</p>
      <p class="heat"><span>${game.plays} plays</span><span>${game.likes} likes</span></p>
    </div>
  </a>`;
}

function linkCard(link: LinkRow): string {
  return `<article class="card link-card">
    <a href="${esc(link.postUrl)}" target="_blank" rel="noopener noreferrer">
      <img src="/cover/link/${esc(link.id)}.svg" alt="">
    </a>
    <div>
      <h3><a href="${esc(link.postUrl)}" target="_blank" rel="noopener noreferrer">${esc(link.title)}</a></h3>
      <p class="by">${esc(link.authorHandle)}</p>
      <p>${esc(link.summary)}</p>
      <p class="tags"><span>${esc(link.model)}</span></p>
      <p class="license">${esc(link.licenseStatus)}</p>
      <p class="offsite">${esc(offsiteLabel(link.engagementJson))}</p>
      <p><a href="${esc(link.playUrl)}" target="_blank" rel="noopener noreferrer">Play on the author's site</a></p>
    </div>
  </article>`;
}

export function homePage(input: {
  user: User | null;
  featured: GameRow[];
  games: GameRow[];
  links: LinkRow[];
  tags: string[];
  activeTag: string | null;
}): string {
  const banner = input.featured.map(gameCard).join("");
  const tabs = [`<a class="${input.activeTag ? "" : "on"}" href="/">All</a>`]
    .concat(input.tags.map((tag) => `<a class="${input.activeTag === tag ? "on" : ""}" href="/?tag=${esc(tag)}">${esc(tag)}</a>`))
    .join("");
  const grid = input.games.length
    ? input.games.map(gameCard).join("")
    : `<p class="empty">No games with that tag.</p>`;
  const links = input.links.map(linkCard).join("");
  return layout({
    title: "Games",
    user: input.user,
    body: `
      <section class="intro">
        <h1>Browser games, with the prompt still attached.</h1>
        <p>Upload a self-contained HTML file or a zip. Visitors play in a sandbox. A remix keeps the parent and the public prompt.</p>
      </section>
      <section>
        <div class="row-head"><h2>Featured</h2><div><button type="button" data-banner-prev>Prev</button><button type="button" data-banner-next>Next</button></div></div>
        <div class="banner" data-banner>${banner}</div>
      </section>
      <section>
        <h2>Latest</h2>
        <div class="tabs">${tabs}</div>
        <div class="grid">${grid}</div>
      </section>
      <section>
        <h2>On other sites</h2>
        <p class="lede">These cards only link out. Ace Shelf does not host, copy, or embed those games.</p>
        <div class="grid">${links}</div>
      </section>`,
  });
}

export function gamePage(input: {
  user: User | null;
  game: GameRow;
  parent: { id: string; title: string } | null;
  children: { id: string; title: string }[];
  showPrompt: boolean;
  liked: boolean;
  notice?: string;
}): string {
  const tags = input.game.tags.map((tag) => `<a href="/?tag=${esc(tag)}">${esc(tag)}</a>`).join(" ");
  const prompt = input.showPrompt
    ? `<section><h2>Prompt</h2><pre>${esc(input.game.promptBody)}</pre></section>`
    : "";
  const remix = input.game.promptPublic
    ? `<p><a class="button" href="/upload?parent=${esc(input.game.id)}">Remix</a></p>`
    : "";
  const parent = input.parent
    ? `<p>Remix of <a href="/g/${esc(input.parent.id)}">${esc(input.parent.title)}</a></p>`
    : "";
  const children = input.children.length
    ? `<section><h2>Remixes</h2><ul>${input.children.map((child) => `<li><a href="/g/${esc(child.id)}">${esc(child.title)}</a></li>`).join("")}</ul></section>`
    : `<section><h2>Remixes</h2><p class="empty">No remixes yet.</p></section>`;
  return layout({
    title: input.game.title,
    user: input.user,
    notice: input.notice,
    body: `
      <article class="detail">
        <img class="hero" src="/cover/game/${esc(input.game.id)}.svg" alt="">
        <div>
          <h1>${esc(input.game.title)}</h1>
          <p class="by">@${esc(input.game.authorHandle)} · ${esc(input.game.model)}</p>
          <p class="tags">${tags}</p>
          <p class="heat"><span data-plays>${input.game.plays}</span> plays · <span data-likes>${input.game.likes}</span> likes</p>
          <p><button type="button" data-like="${esc(input.game.id)}">${input.liked ? "Liked" : "Like"}</button></p>
          ${parent}
          ${remix}
          <p>${esc(input.game.summary)}</p>
        </div>
      </article>
      <section class="stage-wrap">
        <iframe data-play-frame data-game="${esc(input.game.id)}" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" src="/run/${esc(input.game.id)}/" title="${esc(input.game.title)}"></iframe>
      </section>
      <section>
        <h2>Screenshots</h2>
        <p class="empty">No screenshots uploaded. The cover is a generated placeholder.</p>
      </section>
      ${prompt}
      ${children}
      <section>
        <h2>Report</h2>
        <form method="post" action="/api/games/${esc(input.game.id)}/report">
          <label>Reason
            <select name="reason">
              <option value="malware">Malware</option>
              <option value="copyright">Copyright</option>
              <option value="sexual">Sexual content</option>
              <option value="violence">Violence</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Detail <textarea name="detail" maxlength="2000"></textarea></label>
          <button type="submit">Send report</button>
        </form>
      </section>`,
  });
}

export function uploadPage(input: {
  user: User | null;
  error?: string;
  parent: { id: string; title: string; prompt: string } | null;
}): string {
  const parentFields = input.parent
    ? `<p>Remix of <a href="/g/${esc(input.parent.id)}">${esc(input.parent.title)}</a></p>
       <input type="hidden" name="parent_id" value="${esc(input.parent.id)}">`
    : "";
  return layout({
    title: "Upload",
    user: input.user,
    notice: input.error,
    body: `
      <h1>Upload a game</h1>
      <form method="post" action="/upload" enctype="multipart/form-data">
        ${parentFields}
        <label>Title <input name="title" required maxlength="120"></label>
        <label>Summary <textarea name="summary" required maxlength="2000"></textarea></label>
        <label>Model <input name="model" required maxlength="80" list="models" value="Fable 5.2"></label>
        <datalist id="models">
          <option value="Fable 5.2"></option>
          <option value="Claude Fable 5.2"></option>
          <option value="Other"></option>
        </datalist>
        <label>Tags <input name="tags" placeholder="arcade, sample"></label>
        <label>Prompt <textarea name="prompt_body" maxlength="20000">${input.parent ? esc(input.parent.prompt) : ""}</textarea></label>
        <label class="check"><input type="checkbox" name="prompt_public" checked> Public prompt</label>
        <label>HTML or zip <input type="file" name="file" required accept=".html,.htm,.zip"></label>
        <button type="submit">Publish</button>
      </form>`,
  });
}

export function authPage(input: { mode: "login" | "register"; user: User | null; next: string; error?: string }): string {
  const action = input.mode === "login" ? "/login" : "/register";
  const title = input.mode === "login" ? "Log in" : "Register";
  return layout({
    title,
    user: input.user,
    notice: input.error,
    body: `
      <h1>${title}</h1>
      <form method="post" action="${action}">
        <input type="hidden" name="next" value="${esc(input.next)}">
        <label>Handle <input name="handle" required minlength="3" maxlength="32" autocomplete="username"></label>
        <label>Password <input name="password" type="password" required minlength="8" maxlength="200" autocomplete="${input.mode === "login" ? "current-password" : "new-password"}"></label>
        <button type="submit">${title}</button>
      </form>
      <p>${input.mode === "login" ? '<a href="/register">Need an account?</a>' : '<a href="/login">Already registered?</a>'}</p>`,
  });
}

export function policyPage(user: User | null): string {
  return layout({
    title: "Rules",
    user,
    body: `
      <h1>Content rules</h1>
      <ul>
        <li>Do not upload malware, exploit pages, or anything that attacks people outside the game sandbox.</li>
        <li>Do not upload sexual content involving minors.</li>
        <li>Do not upload games or assets you do not have the rights to host.</li>
        <li>Violence, sexual content, and copyright complaints can be reported on the game page. A person reviews the queue and can take a game down.</li>
      </ul>
      <p>This trial is free. It does not sell anything, show ads, or take payments.</p>`,
  });
}

export function adminPage(input: { reports: ReportRow[]; token: string }): string {
  const rows = input.reports.length
    ? input.reports.map((report) => `<li>
        <strong>${esc(report.title || report.gameId)}</strong>
        · ${esc(report.reason)} · ${esc(report.status)}
        <p>${esc(report.detail)}</p>
        <form method="post" action="/admin/takedown">
          <input type="hidden" name="token" value="${esc(input.token)}">
          <input type="hidden" name="game_id" value="${esc(report.gameId)}">
          <button type="submit">Take down</button>
        </form>
      </li>`).join("")
    : `<p class="empty">No reports.</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review queue · Ace Shelf</title>
<link rel="stylesheet" href="/static/site.css">
</head>
<body>
<main>
  <h1>Review queue</h1>
  <ul class="queue">${rows}</ul>
  <p><a href="/">Back</a></p>
</main>
</body>
</html>`;
}

export function adminGate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review queue · Ace Shelf</title>
<link rel="stylesheet" href="/static/site.css">
</head>
<body>
<main>
  <h1>Review queue</h1>
  <form method="post" action="/admin">
    <label>Admin token <input type="password" name="token" required></label>
    <button type="submit">Open</button>
  </form>
</main>
</body>
</html>`;
}
