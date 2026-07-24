CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  from_agent  TEXT NOT NULL,
  to_agent    TEXT,            -- NULL = broadcast
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'message',  -- message, finding, question, answer
  metadata    TEXT,            -- JSON
  read        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (from_agent) REFERENCES agents(name)
);
