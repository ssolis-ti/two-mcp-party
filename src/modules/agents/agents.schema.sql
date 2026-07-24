CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  type        TEXT DEFAULT 'generic',
  description TEXT,
  capabilities TEXT,  -- JSON array
  status      TEXT DEFAULT 'online',
  host        TEXT,
  metadata    TEXT,  -- JSON object
  created_at  TEXT DEFAULT (datetime('now')),
  last_seen   TEXT DEFAULT (datetime('now'))
);
