import { newId } from "./crypto-util.js";
import type { Database, SqlValue } from "./store.js";
import type { Locale } from "./i18n/index.js";

export type Db = Database;

export type User = { id: string; handle: string };

export type GameRow = {
  id: string;
  authorId: string;
  authorHandle: string;
  title: string;
  summary: string;
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  model: string;
  promptPublic: boolean;
  promptBody: string;
  parentId: string | null;
  plays: number;
  likes: number;
  featured: boolean;
  createdAt: number;
  tags: string[];
};

export type LinkRow = {
  id: string;
  title: string;
  authorHandle: string;
  postUrl: string;
  playUrl: string;
  summary: string;
  model: string;
  licenseStatus: string;
  engagementJson: string;
  placement: string;
};

export type ReportRow = {
  id: string;
  gameId: string;
  title: string;
  reason: string;
  detail: string;
  createdAt: number;
  status: string;
};

export type ShotRow = {
  id: string;
  gameId: string;
  contentType: string;
  width: number;
  height: number;
  createdAt: number;
};

export type Metrics = {
  authors: number;
  playable_games: number;
  public_prompts: number;
  non_author_plays: number;
  remixes: number;
  homepage_links: number;
  hidden_links: number;
  external_engagement_counted_in_plays: false;
};

type GameSql = {
  id: string;
  author_id: string;
  author_handle: string;
  title: string;
  summary: string;
  title_en: string;
  title_zh: string;
  summary_en: string;
  summary_zh: string;
  model: string;
  prompt_public: number;
  prompt_body: string;
  parent_id: string | null;
  plays: number | bigint;
  likes: number | bigint;
  featured: number;
  created_at: number | bigint;
};

function num(value: number | bigint | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

async function withTx(db: Db, ops: { sql: string; args: SqlValue[] }[]): Promise<void> {
  await db.batch(ops);
}

export function localizedText(
  locale: Locale,
  original: string,
  en: string,
  zh: string,
): string {
  if (locale === "zh") return zh || en || original;
  return en || zh || original;
}

export { newId };

export async function createUser(db: Db, handle: string, passwordHash: string, now: number): Promise<string | null> {
  const id = newId();
  try {
    await db.prepare(
      "INSERT INTO users (id, handle, password_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run(id, handle, passwordHash, now);
    return id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE") || message.toLowerCase().includes("unique")) return null;
    throw err;
  }
}

export async function userByHandle(
  db: Db,
  handle: string,
): Promise<{ id: string; handle: string; passwordHash: string } | null> {
  const row = await db.prepare(
    "SELECT id, handle, password_hash AS passwordHash FROM users WHERE handle = ?",
  ).get<{ id: string; handle: string; passwordHash: string }>(handle);
  return row ?? null;
}

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

export async function startSession(db: Db, userId: string, now: number): Promise<string> {
  const id = `${newId()}${newId()}`;
  await db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, now + SESSION_MS);
  return id;
}

export async function endSession(db: Db, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export async function userFromSession(db: Db, sessionId: string, now: number): Promise<User | null> {
  const row = await db.prepare(`
    SELECT u.id AS id, u.handle AS handle
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get<User>(sessionId, now);
  return row ?? null;
}

export async function startAdminSession(db: Db, now: number): Promise<string> {
  const id = `${newId()}${newId()}`;
  await db.prepare("INSERT INTO admin_sessions (id, expires_at) VALUES (?, ?)").run(id, now + ADMIN_SESSION_MS);
  return id;
}

export async function adminSessionValid(db: Db, sessionId: string, now: number): Promise<boolean> {
  const row = await db.prepare(
    "SELECT 1 AS hit FROM admin_sessions WHERE id = ? AND expires_at > ?",
  ).get(sessionId, now);
  return Boolean(row);
}

export async function endAdminSession(db: Db, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM admin_sessions WHERE id = ?").run(sessionId);
}

async function tagMap(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.prepare("SELECT game_id, tag FROM game_tags ORDER BY tag").all<{ game_id: string; tag: string }>();
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.game_id) ?? [];
    list.push(row.tag);
    map.set(row.game_id, list);
  }
  return map;
}

function mapGame(row: GameSql, tags: Map<string, string[]>): GameRow {
  return {
    id: row.id,
    authorId: row.author_id,
    authorHandle: row.author_handle,
    title: row.title,
    summary: row.summary,
    titleEn: row.title_en ?? "",
    titleZh: row.title_zh ?? "",
    summaryEn: row.summary_en ?? "",
    summaryZh: row.summary_zh ?? "",
    model: row.model,
    promptPublic: row.prompt_public === 1,
    promptBody: row.prompt_body,
    parentId: row.parent_id,
    plays: num(row.plays),
    likes: num(row.likes),
    featured: row.featured === 1,
    createdAt: num(row.created_at),
    tags: tags.get(row.id) ?? [],
  };
}

const GAME_SELECT = `
  SELECT g.id, g.author_id, u.handle AS author_handle, g.title, g.summary,
         g.title_en, g.title_zh, g.summary_en, g.summary_zh, g.model,
         g.prompt_public, g.prompt_body, g.parent_id, g.plays, g.likes, g.featured, g.created_at
  FROM games g JOIN users u ON u.id = g.author_id
`;

export async function listGames(db: Db, tag?: string): Promise<GameRow[]> {
  const tags = await tagMap(db);
  const rows = tag
    ? await db.prepare(`${GAME_SELECT}
        JOIN game_tags t ON t.game_id = g.id
        WHERE g.status = 'published' AND t.tag = ?
        ORDER BY g.created_at DESC`).all<GameSql>(tag)
    : await db.prepare(`${GAME_SELECT}
        WHERE g.status = 'published'
        ORDER BY g.created_at DESC`).all<GameSql>();
  return rows.map((row) => mapGame(row, tags));
}

export async function listFeatured(db: Db): Promise<GameRow[]> {
  const tags = await tagMap(db);
  const rows = await db.prepare(`${GAME_SELECT}
    WHERE g.status = 'published' AND g.featured = 1
    ORDER BY g.created_at ASC`).all<GameSql>();
  return rows.map((row) => mapGame(row, tags));
}

export async function getGame(db: Db, id: string): Promise<GameRow | null> {
  const row = await db.prepare(`${GAME_SELECT} WHERE g.id = ? AND g.status = 'published'`).get<GameSql>(id);
  if (!row) return null;
  return mapGame(row, await tagMap(db));
}

export async function listTags(db: Db): Promise<string[]> {
  const rows = await db.prepare(`
    SELECT DISTINCT t.tag AS tag
    FROM game_tags t JOIN games g ON g.id = t.game_id
    WHERE g.status = 'published'
    ORDER BY t.tag
  `).all<{ tag: string }>();
  return rows.map((row) => row.tag);
}

export async function listChildren(db: Db, parentId: string): Promise<{ id: string; title: string; titleEn: string; titleZh: string }[]> {
  return db.prepare(`
    SELECT id, title, title_en AS titleEn, title_zh AS titleZh FROM games
    WHERE parent_id = ? AND status = 'published'
    ORDER BY created_at ASC
  `).all(parentId);
}

export async function insertGame(
  db: Db,
  input: {
    id: string;
    authorId: string;
    title: string;
    summary: string;
    titleEn: string;
    titleZh: string;
    summaryEn: string;
    summaryZh: string;
    model: string;
    promptPublic: boolean;
    promptBody: string;
    parentId: string | null;
    featured: boolean;
    tags: string[];
    now: number;
  },
): Promise<void> {
  const ops: { sql: string; args: SqlValue[] }[] = [
    {
      sql: `INSERT INTO games (
        id, author_id, title, summary, title_en, title_zh, summary_en, summary_zh,
        model, prompt_public, prompt_body, parent_id, featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.id,
        input.authorId,
        input.title,
        input.summary,
        input.titleEn,
        input.titleZh,
        input.summaryEn,
        input.summaryZh,
        input.model,
        input.promptPublic ? 1 : 0,
        input.promptBody,
        input.parentId,
        input.featured ? 1 : 0,
        input.now,
      ],
    },
  ];
  for (const tag of input.tags) {
    ops.push({ sql: "INSERT INTO game_tags (game_id, tag) VALUES (?, ?)", args: [input.id, tag] });
  }
  await withTx(db, ops);
}

export async function recordPlay(
  db: Db,
  input: { gameId: string; userId: string | null; ipHash: string; now: number; windowMs: number },
): Promise<{ counted: boolean; plays: number } | null> {
  const game = await db.prepare(
    "SELECT plays, author_id AS authorId FROM games WHERE id = ? AND status = 'published'",
  ).get<{ plays: number | bigint; authorId: string }>(input.gameId);
  if (!game) return null;
  const recent = await db.prepare(`
    SELECT 1 AS hit FROM play_events
    WHERE game_id = ? AND ip_hash = ? AND created_at > ?
  `).get(input.gameId, input.ipHash, input.now - input.windowMs);
  if (recent) return { counted: false, plays: num(game.plays) };
  const authorPlay = Boolean(input.userId && input.userId === game.authorId);
  const nextPlays = authorPlay ? num(game.plays) : num(game.plays) + 1;
  const ops: { sql: string; args: SqlValue[] }[] = [
    {
      sql: "INSERT INTO play_events (game_id, user_id, ip_hash, created_at) VALUES (?, ?, ?, ?)",
      args: [input.gameId, input.userId, input.ipHash, input.now],
    },
  ];
  if (!authorPlay) {
    ops.push({ sql: "UPDATE games SET plays = ? WHERE id = ?", args: [nextPlays, input.gameId] });
  }
  await withTx(db, ops);
  return { counted: !authorPlay, plays: nextPlays };
}

export async function toggleLike(
  db: Db,
  gameId: string,
  userId: string,
  now: number,
): Promise<{ liked: boolean; likes: number } | null> {
  const game = await db.prepare("SELECT id FROM games WHERE id = ? AND status = 'published'").get(gameId);
  if (!game) return null;
  const existing = await db.prepare("SELECT 1 AS hit FROM likes WHERE user_id = ? AND game_id = ?").get(userId, gameId);
  if (existing) {
    await db.prepare("DELETE FROM likes WHERE user_id = ? AND game_id = ?").run(userId, gameId);
  } else {
    await db.prepare("INSERT INTO likes (user_id, game_id, created_at) VALUES (?, ?, ?)").run(userId, gameId, now);
  }
  const row = await db.prepare("SELECT COUNT(*) AS n FROM likes WHERE game_id = ?").get<{ n: number | bigint }>(gameId);
  const likes = num(row?.n);
  await db.prepare("UPDATE games SET likes = ? WHERE id = ?").run(likes, gameId);
  return { liked: !existing, likes };
}

export async function userLiked(db: Db, gameId: string, userId: string): Promise<boolean> {
  return Boolean(await db.prepare("SELECT 1 AS hit FROM likes WHERE user_id = ? AND game_id = ?").get(userId, gameId));
}

export async function addReport(db: Db, gameId: string, reason: string, detail: string, now: number): Promise<string | null> {
  const game = await db.prepare("SELECT id FROM games WHERE id = ? AND status = 'published'").get(gameId);
  if (!game) return null;
  const id = newId();
  await db.prepare(`
    INSERT INTO reports (id, game_id, reason, detail, created_at, status) VALUES (?, ?, ?, ?, ?, 'open')
  `).run(id, gameId, reason, detail, now);
  return id;
}

export async function listReports(db: Db): Promise<ReportRow[]> {
  const rows = await db.prepare(`
    SELECT r.id, r.game_id AS gameId, COALESCE(g.title, '') AS title, r.reason, r.detail,
           r.created_at AS createdAt, r.status
    FROM reports r LEFT JOIN games g ON g.id = r.game_id
    ORDER BY r.created_at DESC
  `).all<ReportRow>();
  return rows.map((row) => ({ ...row, createdAt: num(row.createdAt as number | bigint) }));
}

export async function takedown(db: Db, gameId: string): Promise<void> {
  await withTx(db, [
    { sql: "UPDATE games SET status = 'removed' WHERE id = ?", args: [gameId] },
    { sql: "UPDATE reports SET status = 'resolved' WHERE game_id = ?", args: [gameId] },
  ]);
}

export async function addShot(
  db: Db,
  input: { id: string; gameId: string; contentType: string; width: number; height: number; now: number },
): Promise<void> {
  await db.prepare(
    "INSERT INTO game_shots (id, game_id, content_type, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(input.id, input.gameId, input.contentType, input.width, input.height, input.now);
}

export async function listShots(db: Db, gameId: string): Promise<ShotRow[]> {
  const rows = await db.prepare(`
    SELECT id, game_id AS gameId, content_type AS contentType, width, height, created_at AS createdAt
    FROM game_shots WHERE game_id = ? ORDER BY created_at ASC
  `).all<ShotRow>(gameId);
  return rows.map((row) => ({ ...row, createdAt: num(row.createdAt as number | bigint), width: num(row.width), height: num(row.height) }));
}

export async function shotCount(db: Db, gameId: string): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM game_shots WHERE game_id = ?").get<{ n: number | bigint }>(gameId);
  return num(row?.n);
}

export async function getShot(db: Db, gameId: string, shotId: string): Promise<ShotRow | null> {
  const row = await db.prepare(`
    SELECT id, game_id AS gameId, content_type AS contentType, width, height, created_at AS createdAt
    FROM game_shots WHERE game_id = ? AND id = ?
  `).get<ShotRow>(gameId, shotId);
  if (!row) return null;
  return { ...row, createdAt: num(row.createdAt as number | bigint), width: num(row.width), height: num(row.height) };
}

export async function upsertExternalLink(
  db: Db,
  link: {
    title: string;
    authorHandle: string;
    postUrl: string;
    playUrl: string;
    summary: string;
    model: string;
    licenseStatus: string;
    engagementJson: string;
    playUrlSourcePost: string | null;
    placement: string;
    sortOrder: number;
    now: number;
  },
): Promise<void> {
  await db.prepare(`
    INSERT INTO external_links (
      id, title, author_handle, post_url, play_url, summary, model, license_status,
      engagement_json, play_url_source_post, placement, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(post_url) DO UPDATE SET
      title = excluded.title,
      author_handle = excluded.author_handle,
      play_url = excluded.play_url,
      summary = excluded.summary,
      model = excluded.model,
      license_status = excluded.license_status,
      engagement_json = excluded.engagement_json,
      play_url_source_post = excluded.play_url_source_post,
      placement = excluded.placement,
      sort_order = excluded.sort_order
  `).run(
    newId(),
    link.title,
    link.authorHandle,
    link.postUrl,
    link.playUrl,
    link.summary,
    link.model,
    link.licenseStatus,
    link.engagementJson,
    link.playUrlSourcePost,
    link.placement,
    link.sortOrder,
    link.now,
  );
}

export async function listHomepageLinks(db: Db): Promise<LinkRow[]> {
  return db.prepare(`
    SELECT id, title, author_handle AS authorHandle, post_url AS postUrl, play_url AS playUrl,
           summary, model, license_status AS licenseStatus, engagement_json AS engagementJson, placement
    FROM external_links
    WHERE placement = 'homepage'
    ORDER BY sort_order ASC, created_at ASC
  `).all<LinkRow>();
}

export async function getHomepageLink(db: Db, id: string): Promise<LinkRow | null> {
  const row = await db.prepare(`
    SELECT id, title, author_handle AS authorHandle, post_url AS postUrl, play_url AS playUrl,
           summary, model, license_status AS licenseStatus, engagement_json AS engagementJson, placement
    FROM external_links
    WHERE id = ? AND placement = 'homepage'
  `).get<LinkRow>(id);
  return row ?? null;
}

export async function linkCounts(db: Db): Promise<{ homepage: number; hidden: number }> {
  const rows = await db.prepare("SELECT placement, COUNT(*) AS n FROM external_links GROUP BY placement").all<{
    placement: string;
    n: number | bigint;
  }>();
  let homepage = 0;
  let hidden = 0;
  for (const row of rows) {
    if (row.placement === "homepage") homepage = num(row.n);
    else hidden += num(row.n);
  }
  return { homepage, hidden };
}

export async function publishedGameCount(db: Db): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM games WHERE status = 'published'").get<{ n: number | bigint }>();
  return num(row?.n);
}

export async function metrics(db: Db): Promise<Metrics> {
  const authors = await db.prepare("SELECT COUNT(DISTINCT author_id) AS n FROM games WHERE status = 'published'").get<{
    n: number | bigint;
  }>();
  const games = await db.prepare("SELECT COUNT(*) AS n FROM games WHERE status = 'published'").get<{ n: number | bigint }>();
  const prompts = await db.prepare(`
    SELECT COUNT(*) AS n FROM games
    WHERE status = 'published' AND prompt_public = 1 AND length(prompt_body) > 0
  `).get<{ n: number | bigint }>();
  const plays = await db.prepare(`
    SELECT COUNT(*) AS n
    FROM play_events e JOIN games g ON g.id = e.game_id
    WHERE e.user_id IS NULL OR e.user_id != g.author_id
  `).get<{ n: number | bigint }>();
  const remixes = await db.prepare(`
    SELECT COUNT(*) AS n FROM games WHERE status = 'published' AND parent_id IS NOT NULL
  `).get<{ n: number | bigint }>();
  const links = await linkCounts(db);
  return {
    authors: num(authors?.n),
    playable_games: num(games?.n),
    public_prompts: num(prompts?.n),
    non_author_plays: num(plays?.n),
    remixes: num(remixes?.n),
    homepage_links: links.homepage,
    hidden_links: links.hidden,
    external_engagement_counted_in_plays: false,
  };
}
