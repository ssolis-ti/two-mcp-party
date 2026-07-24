CREATE TABLE IF NOT EXISTS shared_memory (
  namespace   TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL, -- JSON
  agent_owner TEXT,          -- Agent that wrote this (optional)
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (namespace, key)
);
