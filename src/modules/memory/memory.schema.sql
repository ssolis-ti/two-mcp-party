CREATE TABLE IF NOT EXISTS shared_memory (
  session_id  TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL, -- JSON
  agent_owner TEXT,          -- Agent that wrote this (optional)
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, key),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
