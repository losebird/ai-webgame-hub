export const SCHEMA_SQL = `
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
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  summary_zh TEXT NOT NULL DEFAULT '',
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
CREATE TABLE IF NOT EXISTS game_shots (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at INTEGER NOT NULL
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
CREATE INDEX IF NOT EXISTS shots_game ON game_shots(game_id, created_at);
`;
