CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  from_agent  TEXT NOT NULL,
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'message',
  metadata    TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (from_agent) REFERENCES agents(name),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
