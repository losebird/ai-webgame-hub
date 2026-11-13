import type { GameRow, LinkRow, ReportRow, ShotRow, User } from "../db.js";
import { localizedText } from "../db.js";
import { formatNumber, t, withLocale, type Locale } from "../i18n/index.js";
import { offsiteLabel, esc } from "../text.js";

export type PageContext = {
  locale: Locale;
  siteName: string;
  siteOrigin: string;
  gameOrigin: string;
  csrf: string;
  user: User | null;
  currentPath: string;
};

function loc(ctx: PageContext, path: string): string {
  return withLocale(ctx.locale, path);
}

function layout(ctx: PageContext, input: { title: string; body: string; notice?: string }): string {
  const account = ctx.user
    ? `<span class="who">${esc(ctx.user.handle)}</span>
       <form method="post" action="${esc(loc(ctx, "/logout"))}">
         <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
         <button class="text" type="submit">${esc(t(ctx.locale, "navLogout"))}</button>
       </form>`
    : `<a href="${esc(loc(ctx, "/login"))}">${esc(t(ctx.locale, "navLogin"))}</a>
       <a class="button" href="${esc(loc(ctx, "/register"))}">${esc(t(ctx.locale, "navRegister"))}</a>`;
  const notice = input.notice ? `<p class="notice">${esc(input.notice)}</p>` : "";
  const other = ctx.locale === "en" ? "zh" : "en";
  return `<!DOCTYPE html>
<html lang="${esc(t(ctx.locale, "htmlLang"))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.title)} · ${esc(ctx.siteName)}</title>
<meta property="og:site_name" content="${esc(ctx.siteName)}">
<meta property="og:title" content="${esc(input.title)} · ${esc(ctx.siteName)}">
<meta name="csrf-token" content="${esc(ctx.csrf)}">
<link rel="stylesheet" href="/static/site.css">
</head>
<body>
<header class="top">
  <a class="brand" href="${esc(loc(ctx, "/"))}">${esc(ctx.siteName)}</a>
  <nav>
    <a href="${esc(loc(ctx, "/"))}">${esc(t(ctx.locale, "navGames"))}</a>
    <a href="${esc(loc(ctx, "/upload"))}">${esc(t(ctx.locale, "navUpload"))}</a>
    <a href="${esc(loc(ctx, "/policy"))}">${esc(t(ctx.locale, "navRules"))}</a>
    <a class="lang" href="/lang?set=${other}&next=${encodeURIComponent(ctx.currentPath)}">${ctx.locale === "en" ? t(ctx.locale, "langZh") : t(ctx.locale, "langEn")}</a>
    ${account}
  </nav>
</header>
<main>
  ${notice}
  ${input.body}
</main>
<footer>
  <p>${esc(t(ctx.locale, "footer", { site: ctx.siteName }))}</p>
</footer>
<script src="/static/site.js"></script>
</body>
</html>`;
}

function gameTitle(ctx: PageContext, game: Pick<GameRow, "title" | "titleEn" | "titleZh">): string {
  return localizedText(ctx.locale, game.title, game.titleEn, game.titleZh);
}

function gameSummary(ctx: PageContext, game: GameRow): string {
  return localizedText(ctx.locale, game.summary, game.summaryEn, game.summaryZh);
}

function gameCard(ctx: PageContext, game: GameRow): string {
  const title = gameTitle(ctx, game);
  const tags = game.tags.map((tag) => `<span>${esc(tag)}</span>`).join("");
  return `<a class="card" href="${esc(loc(ctx, `/g/${game.id}`))}">
    <div class="cover"><img src="/cover/game/${esc(game.id)}.svg" alt=""></div>
    <div class="meta">
      <h3>${esc(title)}</h3>
      <p class="by">@${esc(game.authorHandle)}</p>
      <p class="tags">${tags}</p>
      <p class="heat"><span>${esc(formatNumber(ctx.locale, game.plays))} ${esc(t(ctx.locale, "plays"))}</span><span>${esc(formatNumber(ctx.locale, game.likes))} ${esc(t(ctx.locale, "likes"))}</span></p>
    </div>
  </a>`;
}

function linkCard(ctx: PageContext, link: LinkRow): string {
  return `<article class="card link-card">
    <a href="${esc(link.postUrl)}" target="_blank" rel="noopener noreferrer">
      <div class="cover"><img src="/cover/link/${esc(link.id)}.svg" alt=""></div>
    </a>
    <div class="meta">
      <h3><a href="${esc(link.postUrl)}" target="_blank" rel="noopener noreferrer">${esc(link.title)}</a></h3>
      <p class="by">${esc(link.authorHandle)}</p>
      <p>${esc(link.summary)}</p>
      <p class="tags"><span>${esc(link.model)}</span></p>
      <p class="license">${esc(link.licenseStatus)}</p>
      <p class="offsite">${esc(offsiteLabel(ctx.locale, link.engagementJson))}</p>
      <p><a href="${esc(link.playUrl)}" target="_blank" rel="noopener noreferrer">${esc(t(ctx.locale, "playOnAuthor"))}</a></p>
    </div>
  </article>`;
}

export function homePage(ctx: PageContext, input: {
  featured: GameRow[];
  games: GameRow[];
  links: LinkRow[];
  tags: string[];
  activeTag: string | null;
}): string {
  const banner = input.featured.map((game) => gameCard(ctx, game)).join("");
  const tabs = [`<a class="${input.activeTag ? "" : "on"}" href="${esc(loc(ctx, "/"))}">${esc(t(ctx.locale, "all"))}</a>`]
    .concat(input.tags.map((tag) => `<a class="${input.activeTag === tag ? "on" : ""}" href="${esc(loc(ctx, "/"))}?tag=${esc(tag)}">${esc(tag)}</a>`))
    .join("");
  const grid = input.games.length
    ? input.games.map((game) => gameCard(ctx, game)).join("")
    : `<p class="empty">${esc(t(ctx.locale, "emptyTag"))}</p>`;
  const links = input.links.map((link) => linkCard(ctx, link)).join("");
  return layout(ctx, {
    title: t(ctx.locale, "pageHome"),
    body: `
      <section class="hero-copy">
        <h1>${esc(t(ctx.locale, "homeHeadline"))}</h1>
        <p>${esc(t(ctx.locale, "homeLede"))}</p>
      </section>
      <section class="featured">
        <div class="row-head"><h2>${esc(t(ctx.locale, "featured"))}</h2><div><button type="button" data-banner-prev>${esc(t(ctx.locale, "prev"))}</button><button type="button" data-banner-next>${esc(t(ctx.locale, "next"))}</button></div></div>
        <div class="banner" data-banner>${banner}</div>
      </section>
      <section>
        <h2>${esc(t(ctx.locale, "latest"))}</h2>
        <div class="tabs">${tabs}</div>
        <div class="grid">${grid}</div>
      </section>
      <section>
        <h2>${esc(t(ctx.locale, "onOtherSites"))}</h2>
        <p class="lede">${esc(t(ctx.locale, "otherSitesLede"))}</p>
        <div class="grid">${links}</div>
      </section>`,
  });
}

export function gamePage(ctx: PageContext, input: {
  game: GameRow;
  parent: { id: string; title: string; titleEn: string; titleZh: string } | null;
  children: { id: string; title: string; titleEn: string; titleZh: string }[];
  shots: ShotRow[];
  showPrompt: boolean;
  liked: boolean;
  notice?: string;
}): string {
  const title = gameTitle(ctx, input.game);
  const tags = input.game.tags.map((tag) => `<a href="${esc(loc(ctx, "/"))}?tag=${esc(tag)}">${esc(tag)}</a>`).join(" ");
  const prompt = input.showPrompt
    ? `<section><h2>${esc(t(ctx.locale, "prompt"))}</h2><pre>${esc(input.game.promptBody)}</pre></section>`
    : "";
  const remix = input.game.promptPublic
    ? `<p><a class="button" href="${esc(loc(ctx, "/upload"))}?parent=${esc(input.game.id)}">${esc(t(ctx.locale, "remix"))}</a></p>`
    : "";
  const parent = input.parent
    ? `<p>${esc(t(ctx.locale, "remixOf"))} <a href="${esc(loc(ctx, `/g/${input.parent.id}`))}">${esc(gameTitle(ctx, input.parent))}</a></p>`
    : "";
  const children = input.children.length
    ? `<section><h2>${esc(t(ctx.locale, "remixes"))}</h2><ul>${input.children.map((child) => `<li><a href="${esc(loc(ctx, `/g/${child.id}`))}">${esc(gameTitle(ctx, child))}</a></li>`).join("")}</ul></section>`
    : `<section><h2>${esc(t(ctx.locale, "remixes"))}</h2><p class="empty">${esc(t(ctx.locale, "noRemixes"))}</p></section>`;
  const shotBlock = input.shots.length
    ? `<div class="shots">${input.shots.map((shot) => `<img src="/shot/${esc(input.game.id)}/${esc(shot.id)}" alt="" width="${shot.width}" height="${shot.height}">`).join("")}</div>`
    : `<p class="empty">${esc(t(ctx.locale, "noScreenshots"))}</p>`;
  const shotForm = ctx.user?.id === input.game.authorId
    ? `<form method="post" action="${esc(loc(ctx, `/g/${input.game.id}/shots`))}" enctype="multipart/form-data">
         <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
         <label>${esc(t(ctx.locale, "addScreenshot"))}
           <input type="file" name="shot" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" required>
         </label>
         <p class="lede">${esc(t(ctx.locale, "screenshotHint"))}</p>
         <button type="submit">${esc(t(ctx.locale, "publish"))}</button>
       </form>`
    : "";
  const runSrc = `${ctx.gameOrigin}/run/${encodeURIComponent(input.game.id)}/`;
  return layout(ctx, {
    title,
    notice: input.notice,
    body: `
      <article class="detail">
        <img class="hero" src="/cover/game/${esc(input.game.id)}.svg" alt="">
        <div>
          <h1>${esc(title)}</h1>
          <p class="by">@${esc(input.game.authorHandle)} · ${esc(input.game.model)}</p>
          <p class="tags">${tags}</p>
          <p class="heat"><span data-plays>${esc(formatNumber(ctx.locale, input.game.plays))}</span> ${esc(t(ctx.locale, "plays"))} · <span data-likes>${esc(formatNumber(ctx.locale, input.game.likes))}</span> ${esc(t(ctx.locale, "likes"))}</p>
          <p><button type="button" data-like="${esc(input.game.id)}" data-liked-label="${esc(t(ctx.locale, "liked"))}" data-like-label="${esc(t(ctx.locale, "like"))}">${esc(input.liked ? t(ctx.locale, "liked") : t(ctx.locale, "like"))}</button></p>
          ${parent}
          ${remix}
          <p>${esc(gameSummary(ctx, input.game))}</p>
        </div>
      </article>
      <section class="stage-wrap">
        <iframe data-play-frame data-game="${esc(input.game.id)}" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" src="${esc(runSrc)}" title="${esc(title)}"></iframe>
      </section>
      <section>
        <h2>${esc(t(ctx.locale, "screenshots"))}</h2>
        ${shotBlock}
        ${shotForm}
      </section>
      ${prompt}
      ${children}
      <section>
        <h2>${esc(t(ctx.locale, "report"))}</h2>
        <form method="post" action="/api/games/${esc(input.game.id)}/report">
          <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
          <input type="hidden" name="next" value="${esc(loc(ctx, `/g/${input.game.id}`))}">
          <label>${esc(t(ctx.locale, "reason"))}
            <select name="reason">
              <option value="malware">${esc(t(ctx.locale, "reasonMalware"))}</option>
              <option value="copyright">${esc(t(ctx.locale, "reasonCopyright"))}</option>
              <option value="sexual">${esc(t(ctx.locale, "reasonSexual"))}</option>
              <option value="violence">${esc(t(ctx.locale, "reasonViolence"))}</option>
              <option value="other">${esc(t(ctx.locale, "reasonOther"))}</option>
            </select>
          </label>
          <label>${esc(t(ctx.locale, "detail"))} <textarea name="detail" maxlength="2000"></textarea></label>
          <button type="submit">${esc(t(ctx.locale, "sendReport"))}</button>
        </form>
      </section>`,
  });
}

export function uploadPage(ctx: PageContext, input: {
  error?: string;
  parent: { id: string; title: string; titleEn: string; titleZh: string; prompt: string } | null;
}): string {
  const parentFields = input.parent
    ? `<p>${esc(t(ctx.locale, "remixOf"))} <a href="${esc(loc(ctx, `/g/${input.parent.id}`))}">${esc(gameTitle(ctx, input.parent))}</a></p>
       <input type="hidden" name="parent_id" value="${esc(input.parent.id)}">`
    : "";
  return layout(ctx, {
    title: t(ctx.locale, "pageUpload"),
    notice: input.error,
    body: `
      <h1>${esc(t(ctx.locale, "uploadHeading"))}</h1>
      <form method="post" action="${esc(loc(ctx, "/upload"))}" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
        ${parentFields}
        <label>${esc(t(ctx.locale, "fieldTitle"))} <input name="title" required maxlength="120"></label>
        <label>${esc(t(ctx.locale, "fieldTitleEn"))} <input name="title_en" maxlength="120"></label>
        <label>${esc(t(ctx.locale, "fieldTitleZh"))} <input name="title_zh" maxlength="120"></label>
        <label>${esc(t(ctx.locale, "fieldSummary"))} <textarea name="summary" required maxlength="2000"></textarea></label>
        <label>${esc(t(ctx.locale, "fieldSummaryEn"))} <textarea name="summary_en" maxlength="2000"></textarea></label>
        <label>${esc(t(ctx.locale, "fieldSummaryZh"))} <textarea name="summary_zh" maxlength="2000"></textarea></label>
        <label>${esc(t(ctx.locale, "fieldModel"))} <input name="model" required maxlength="80" list="models" value="Fable 5.2"></label>
        <datalist id="models">
          <option value="Fable 5.2"></option>
          <option value="Claude Fable 5.2"></option>
          <option value="Other"></option>
        </datalist>
        <label>${esc(t(ctx.locale, "fieldTags"))} <input name="tags" placeholder="arcade, sample"></label>
        <label>${esc(t(ctx.locale, "fieldPrompt"))} <textarea name="prompt_body" maxlength="20000">${input.parent ? esc(input.parent.prompt) : ""}</textarea></label>
        <label class="check"><input type="checkbox" name="prompt_public" checked> ${esc(t(ctx.locale, "fieldPublicPrompt"))}</label>
        <label>${esc(t(ctx.locale, "fieldFile"))} <input type="file" name="file" required accept=".html,.htm,.zip"></label>
        <button type="submit">${esc(t(ctx.locale, "publish"))}</button>
      </form>`,
  });
}

export function authPage(ctx: PageContext, input: { mode: "login" | "register"; next: string; error?: string }): string {
  const action = loc(ctx, input.mode === "login" ? "/login" : "/register");
  const title = input.mode === "login" ? t(ctx.locale, "loginTitle") : t(ctx.locale, "registerTitle");
  return layout(ctx, {
    title,
    notice: input.error,
    body: `
      <h1>${esc(title)}</h1>
      <form method="post" action="${esc(action)}">
        <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
        <input type="hidden" name="next" value="${esc(input.next)}">
        <label>${esc(t(ctx.locale, "fieldHandle"))} <input name="handle" required minlength="3" maxlength="32" autocomplete="username"></label>
        <label>${esc(t(ctx.locale, "fieldPassword"))} <input name="password" type="password" required minlength="8" maxlength="200" autocomplete="${input.mode === "login" ? "current-password" : "new-password"}"></label>
        <button type="submit">${esc(title)}</button>
      </form>
      <p>${input.mode === "login" ? `<a href="${esc(loc(ctx, "/register"))}">${esc(t(ctx.locale, "needAccount"))}</a>` : `<a href="${esc(loc(ctx, "/login"))}">${esc(t(ctx.locale, "alreadyRegistered"))}</a>`}</p>`,
  });
}

export function policyPage(ctx: PageContext): string {
  return layout(ctx, {
    title: t(ctx.locale, "pageRules"),
    body: `
      <h1>${esc(t(ctx.locale, "policyTitle"))}</h1>
      <ul>
        <li>${esc(t(ctx.locale, "policyMalware"))}</li>
        <li>${esc(t(ctx.locale, "policyMinors"))}</li>
        <li>${esc(t(ctx.locale, "policyRights"))}</li>
        <li>${esc(t(ctx.locale, "policyReview"))}</li>
      </ul>
      <p>${esc(t(ctx.locale, "policyFree"))}</p>`,
  });
}

export function adminPage(ctx: PageContext, reports: ReportRow[]): string {
  const rows = reports.length
    ? reports.map((report) => `<li>
        <strong>${esc(report.title || report.gameId)}</strong>
        · ${esc(report.reason)} · ${esc(report.status)}
        <p>${esc(report.detail)}</p>
        <form method="post" action="/admin/takedown">
          <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
          <input type="hidden" name="game_id" value="${esc(report.gameId)}">
          <button type="submit">${esc(t(ctx.locale, "adminTakeDown"))}</button>
        </form>
      </li>`).join("")
    : `<p class="empty">${esc(t(ctx.locale, "adminEmpty"))}</p>`;
  return `<!DOCTYPE html>
<html lang="${esc(t(ctx.locale, "htmlLang"))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t(ctx.locale, "adminTitle"))} · ${esc(ctx.siteName)}</title>
<meta name="csrf-token" content="${esc(ctx.csrf)}">
<link rel="stylesheet" href="/static/site.css">
</head>
<body>
<main>
  <h1>${esc(t(ctx.locale, "adminTitle"))}</h1>
  <ul class="queue">${rows}</ul>
  <form method="post" action="/admin/logout">
    <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
    <button class="text" type="submit">${esc(t(ctx.locale, "adminLogout"))}</button>
  </form>
  <p><a href="${esc(loc(ctx, "/"))}">${esc(t(ctx.locale, "adminBack"))}</a></p>
</main>
</body>
</html>`;
}

export function adminGate(ctx: PageContext): string {
  return `<!DOCTYPE html>
<html lang="${esc(t(ctx.locale, "htmlLang"))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t(ctx.locale, "adminTitle"))} · ${esc(ctx.siteName)}</title>
<meta name="csrf-token" content="${esc(ctx.csrf)}">
<link rel="stylesheet" href="/static/site.css">
</head>
<body>
<main>
  <h1>${esc(t(ctx.locale, "adminTitle"))}</h1>
  <form method="post" action="/admin">
    <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
    <label>${esc(t(ctx.locale, "adminToken"))} <input type="password" name="token" required></label>
    <button type="submit">${esc(t(ctx.locale, "adminOpen"))}</button>
  </form>
</main>
</body>
</html>`;
}
