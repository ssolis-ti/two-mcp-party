import Database from 'better-sqlite3';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');

// Orden de carga: las FK apuntan hacia atrás (messages -> agents/sessions).
const SCHEMAS = [
  'modules/agents/agents.schema.sql',
  'modules/sessions/sessions.schema.sql',
  'modules/messaging/messaging.schema.sql',
  'modules/memory/memory.schema.sql',
  'modules/tasks/tasks.schema.sql',
  'modules/swarm/schema.sql',
];

export function makeDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agentbridge-qa-'));
  const db = new Database(path.join(dir, 'test.db'));
  db.pragma('foreign_keys = ON');
  for (const rel of SCHEMAS) {
    db.exec(readFileSync(path.join(SRC, rel), 'utf8'));
  }
  db.exec("INSERT OR IGNORE INTO agents (id, name, type, status) VALUES ('agt_system','SYSTEM','system','online')");
  db.cleanup = () => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  };
  return db;
}

export function makeBus() {
  const bus = new EventEmitter();
  bus.setMaxListeners(50);
  bus.captured = [];
  const emit = bus.emit.bind(bus);
  bus.emit = (name, ...args) => {
    bus.captured.push({ name, args });
    return emit(name, ...args);
  };
  return bus;
}

export function addAgent(db, name, type = 'generic') {
  db.prepare('INSERT INTO agents (id, name, type, status) VALUES (?, ?, ?, ?)')
    .run(`agt_${name}`, name, type, 'online');
}

/** Inserta un mensaje con created_at explícito, para controlar el orden temporal. */
export function seedMessage(db, sessionId, from, content, createdAt) {
  db.prepare(
    `INSERT INTO messages (id, session_id, from_agent, content, type, metadata, priority, created_at)
     VALUES (?, ?, ?, ?, 'message', '{}', 'normal', ?)`
  ).run(`msg_${Math.random().toString(16).slice(2, 12)}`, sessionId, from, content, createdAt);
}
