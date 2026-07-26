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

CREATE TABLE IF NOT EXISTS loop_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  agent_id     TEXT NOT NULL,
  tool_name    TEXT NOT NULL,
  repeat_count INTEGER DEFAULT 0,
  first_seen   TEXT DEFAULT (datetime('now')),
  last_seen    TEXT DEFAULT (datetime('now')),
  resolved_at  TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
