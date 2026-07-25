CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  status      TEXT DEFAULT 'active',
  mode        TEXT DEFAULT 'moderator',
  mode_config TEXT,
  turn_count  INTEGER DEFAULT 0,
  current_turn TEXT,
  metadata    TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
