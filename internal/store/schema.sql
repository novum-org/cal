PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  policy_json TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS space_members (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (space_id, user_id)
);

CREATE TABLE IF NOT EXISTS months (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  actuals_json TEXT,
  planned_json TEXT,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (space_id, month)
);

CREATE TABLE IF NOT EXISTS source_secrets (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  config_json TEXT NOT NULL,
  PRIMARY KEY (space_id, source_id)
);
