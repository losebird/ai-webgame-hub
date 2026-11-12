import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

export type Db = DatabaseSync;

export type User = { id: string; handle: string };

export type GameRow = {
  id: string;
  authorId: string;
  authorHandle: string;
  title: string;
  summary: string;
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
  model: string;
  prompt_public: number;
  prompt_body: string;
  parent_id: string | null;
  plays: number | bigint;
  likes: number | bigint;
  featured: number;
  created_at: number | bigint;
};

export function newId(): string {
  return randomBytes(9).toString("base64url");
}

function num(value: number | bigint | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

export function openDb(file: string): Db {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_public INTEGER NOT NULL,
      prompt_body TEXT NOT NULL,
      parent_id TEXT,
      plays INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_tags (
      game_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (game_id, tag)
    );
    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS play_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      user_id TEXT,
      ip_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS external_links (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author_handle TEXT NOT NULL,
      post_url TEXT NOT NULL UNIQUE,
      play_url TEXT NOT NULL,
      summary TEXT NOT NULL,
      model TEXT NOT NULL,
      license_status TEXT NOT NULL,
      engagement_json TEXT NOT NULL,
      play_url_source_post TEXT,
      placement TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS games_parent ON games(parent_id);
    CREATE INDEX IF NOT EXISTS games_status_created ON games(status, created_at);
    CREATE INDEX IF NOT EXISTS play_lookup ON play_events(game_id, ip_hash, created_at);
  `);
  return db;
}

function withTx(db: Db, fn: () => void) {
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function createUser(db: Db, handle: string, passwordHash: string, now: number): string | null {
  const id = newId();
  try {
    db.prepare(
      "INSERT INTO users (id, handle, password_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run(id, handle, passwordHash, now);
    return id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE")) return null;
    throw err;
  }
}

export function userByHandle(db: Db, handle: string): { id: string; handle: string; passwordHash: string } | null {
  const row = db.prepare(
    "SELECT id, handle, password_hash AS passwordHash FROM users WHERE handle = ?",
  ).get(handle) as { id: string; handle: string; passwordHash: string } | undefined;
  return row ?? null;
}

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function startSession(db: Db, userId: string, now: number): string {
  const id = `${newId()}${newId()}`;
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, now + SESSION_MS);
  return id;
}

export function endSession(db: Db, sessionId: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function userFromSession(db: Db, sessionId: string, now: number): User | null {
  const row = db.prepare(`
    SELECT u.id AS id, u.handle AS handle
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, now) as User | undefined;
  return row ?? null;
}

function tagMap(db: Db): Map<string, string[]> {
  const rows = db.prepare("SELECT game_id, tag FROM game_tags ORDER BY tag").all() as { game_id: string; tag: string }[];
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
  SELECT g.id, g.author_id, u.handle AS author_handle, g.title, g.summary, g.model,
         g.prompt_public, g.prompt_body, g.parent_id, g.plays, g.likes, g.featured, g.created_at
  FROM games g JOIN users u ON u.id = g.author_id
`;

export function listGames(db: Db, tag?: string): GameRow[] {
  const tags = tagMap(db);
  const rows = tag
    ? db.prepare(`${GAME_SELECT}
        JOIN game_tags t ON t.game_id = g.id
        WHERE g.status = 'published' AND t.tag = ?
        ORDER BY g.created_at DESC`).all(tag)
    : db.prepare(`${GAME_SELECT}
        WHERE g.status = 'published'
        ORDER BY g.created_at DESC`).all();
  return (rows as GameSql[]).map((row) => mapGame(row, tags));
}

export function listFeatured(db: Db): GameRow[] {
  const tags = tagMap(db);
  const rows = db.prepare(`${GAME_SELECT}
    WHERE g.status = 'published' AND g.featured = 1
    ORDER BY g.created_at ASC`).all() as GameSql[];
  return rows.map((row) => mapGame(row, tags));
}

export function getGame(db: Db, id: string): GameRow | null {
  const row = db.prepare(`${GAME_SELECT} WHERE g.id = ? AND g.status = 'published'`).get(id) as GameSql | undefined;
  if (!row) return null;
  return mapGame(row, tagMap(db));
}

export function listTags(db: Db): string[] {
  const rows = db.prepare(`
    SELECT DISTINCT t.tag AS tag
    FROM game_tags t JOIN games g ON g.id = t.game_id
    WHERE g.status = 'published'
    ORDER BY t.tag
  `).all() as { tag: string }[];
  return rows.map((row) => row.tag);
}

export function listChildren(db: Db, parentId: string): { id: string; title: string }[] {
  return db.prepare(`
    SELECT id, title FROM games
    WHERE parent_id = ? AND status = 'published'
    ORDER BY created_at ASC
  `).all(parentId) as { id: string; title: string }[];
}

export function insertGame(
  db: Db,
  input: {
    id: string;
    authorId: string;
    title: string;
    summary: string;
    model: string;
    promptPublic: boolean;
    promptBody: string;
    parentId: string | null;
    featured: boolean;
    tags: string[];
    now: number;
  },
) {
  withTx(db, () => {
    db.prepare(`
      INSERT INTO games (
        id, author_id, title, summary, model, prompt_public, prompt_body, parent_id, featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.authorId,
      input.title,
      input.summary,
      input.model,
      input.promptPublic ? 1 : 0,
      input.promptBody,
      input.parentId,
      input.featured ? 1 : 0,
      input.now,
    );
    const insertTag = db.prepare("INSERT INTO game_tags (game_id, tag) VALUES (?, ?)");
    for (const tag of input.tags) insertTag.run(input.id, tag);
  });
}

export function recordPlay(
  db: Db,
  input: { gameId: string; userId: string | null; ipHash: string; now: number; windowMs: number },
): { counted: boolean; plays: number } | null {
  const game = db.prepare("SELECT plays FROM games WHERE id = ? AND status = 'published'").get(input.gameId) as
    | { plays: number | bigint }
    | undefined;
  if (!game) return null;
  const recent = db.prepare(`
    SELECT 1 AS hit FROM play_events
    WHERE game_id = ? AND ip_hash = ? AND created_at > ?
  `).get(input.gameId, input.ipHash, input.now - input.windowMs);
  if (recent) return { counted: false, plays: num(game.plays) };
  let plays = num(game.plays);
  withTx(db, () => {
    db.prepare(`
      INSERT INTO play_events (game_id, user_id, ip_hash, created_at) VALUES (?, ?, ?, ?)
    `).run(input.gameId, input.userId, input.ipHash, input.now);
    plays += 1;
    db.prepare("UPDATE games SET plays = ? WHERE id = ?").run(plays, input.gameId);
  });
  return { counted: true, plays };
}

export function toggleLike(db: Db, gameId: string, userId: string, now: number): { liked: boolean; likes: number } | null {
  const game = db.prepare("SELECT id FROM games WHERE id = ? AND status = 'published'").get(gameId);
  if (!game) return null;
  let liked = false;
  let likes = 0;
  withTx(db, () => {
    const existing = db.prepare("SELECT 1 AS hit FROM likes WHERE user_id = ? AND game_id = ?").get(userId, gameId);
    if (existing) {
      db.prepare("DELETE FROM likes WHERE user_id = ? AND game_id = ?").run(userId, gameId);
      liked = false;
    } else {
      db.prepare("INSERT INTO likes (user_id, game_id, created_at) VALUES (?, ?, ?)").run(userId, gameId, now);
      liked = true;
    }
    const row = db.prepare("SELECT COUNT(*) AS n FROM likes WHERE game_id = ?").get(gameId) as { n: number | bigint };
    likes = num(row.n);
    db.prepare("UPDATE games SET likes = ? WHERE id = ?").run(likes, gameId);
  });
  return { liked, likes };
}

export function userLiked(db: Db, gameId: string, userId: string): boolean {
  return Boolean(db.prepare("SELECT 1 AS hit FROM likes WHERE user_id = ? AND game_id = ?").get(userId, gameId));
}

export function addReport(db: Db, gameId: string, reason: string, detail: string, now: number): string | null {
  const game = db.prepare("SELECT id FROM games WHERE id = ? AND status = 'published'").get(gameId);
  if (!game) return null;
  const id = newId();
  db.prepare(`
    INSERT INTO reports (id, game_id, reason, detail, created_at, status) VALUES (?, ?, ?, ?, ?, 'open')
  `).run(id, gameId, reason, detail, now);
  return id;
}

export function listReports(db: Db): ReportRow[] {
  const rows = db.prepare(`
    SELECT r.id, r.game_id AS gameId, COALESCE(g.title, '') AS title, r.reason, r.detail,
           r.created_at AS createdAt, r.status
    FROM reports r LEFT JOIN games g ON g.id = r.game_id
    ORDER BY r.created_at DESC
  `).all() as ReportRow[];
  return rows.map((row) => ({ ...row, createdAt: num(row.createdAt as number | bigint) }));
}

export function takedown(db: Db, gameId: string) {
  withTx(db, () => {
    db.prepare("UPDATE games SET status = 'removed' WHERE id = ?").run(gameId);
    db.prepare("UPDATE reports SET status = 'resolved' WHERE game_id = ?").run(gameId);
  });
}

export function upsertExternalLink(
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
) {
  db.prepare(`
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

export function listHomepageLinks(db: Db): LinkRow[] {
  const rows = db.prepare(`
    SELECT id, title, author_handle AS authorHandle, post_url AS postUrl, play_url AS playUrl,
           summary, model, license_status AS licenseStatus, engagement_json AS engagementJson, placement
    FROM external_links
    WHERE placement = 'homepage'
    ORDER BY sort_order ASC, created_at ASC
  `).all() as LinkRow[];
  return rows;
}

export function getHomepageLink(db: Db, id: string): LinkRow | null {
  const row = db.prepare(`
    SELECT id, title, author_handle AS authorHandle, post_url AS postUrl, play_url AS playUrl,
           summary, model, license_status AS licenseStatus, engagement_json AS engagementJson, placement
    FROM external_links
    WHERE id = ? AND placement = 'homepage'
  `).get(id) as LinkRow | undefined;
  return row ?? null;
}

export function linkCounts(db: Db): { homepage: number; hidden: number } {
  const rows = db.prepare("SELECT placement, COUNT(*) AS n FROM external_links GROUP BY placement").all() as {
    placement: string;
    n: number | bigint;
  }[];
  let homepage = 0;
  let hidden = 0;
  for (const row of rows) {
    if (row.placement === "homepage") homepage = num(row.n);
    else hidden += num(row.n);
  }
  return { homepage, hidden };
}

export function publishedGameCount(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM games WHERE status = 'published'").get() as { n: number | bigint };
  return num(row.n);
}

export function metrics(db: Db): Metrics {
  const authors = db.prepare("SELECT COUNT(DISTINCT author_id) AS n FROM games WHERE status = 'published'").get() as {
    n: number | bigint;
  };
  const games = db.prepare("SELECT COUNT(*) AS n FROM games WHERE status = 'published'").get() as { n: number | bigint };
  const prompts = db.prepare(`
    SELECT COUNT(*) AS n FROM games
    WHERE status = 'published' AND prompt_public = 1 AND length(prompt_body) > 0
  `).get() as { n: number | bigint };
  const plays = db.prepare(`
    SELECT COUNT(*) AS n
    FROM play_events e JOIN games g ON g.id = e.game_id
    WHERE e.user_id IS NULL OR e.user_id != g.author_id
  `).get() as { n: number | bigint };
  const remixes = db.prepare(`
    SELECT COUNT(*) AS n FROM games WHERE status = 'published' AND parent_id IS NOT NULL
  `).get() as { n: number | bigint };
  const links = linkCounts(db);
  return {
    authors: num(authors.n),
    playable_games: num(games.n),
    public_prompts: num(prompts.n),
    non_author_plays: num(plays.n),
    remixes: num(remixes.n),
    homepage_links: links.homepage,
    hidden_links: links.hidden,
    external_engagement_counted_in_plays: false,
  };
}
