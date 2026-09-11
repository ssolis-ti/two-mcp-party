import Database from 'better-sqlite3';
import { logger } from './logger.js';
import path from 'path';
import fs from 'fs';

export class DB {
  constructor(dbPath = 'agentbridge.db') {
    this.db = new Database(dbPath);
    
    // Configuración para máxima concurrencia y performance en SQLite
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this._runAutoMigrations();
    
    logger.info(`Database initialized at ${dbPath} (WAL mode, Foreign Keys ON)`);
  }

  _runAutoMigrations() {
    try {
      // Auto-migrate messages table for missing columns
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
      if (tables) {
        const columns = this.db.prepare("PRAGMA table_info(messages)").all().map(c => c.name);
        if (!columns.includes('seq')) {
          this.db.exec("ALTER TABLE messages ADD COLUMN seq INTEGER");
          logger.info("Auto-migrated table 'messages': added column 'seq'");
        }
        if (!columns.includes('priority')) {
          this.db.exec("ALTER TABLE messages ADD COLUMN priority TEXT DEFAULT 'normal'");
          logger.info("Auto-migrated table 'messages': added column 'priority'");
        }
      }
      
      // Auto-migrate tasks table: liga el ticket ejecutable con la hoja de tarea
      // que la colmena diseño. SQLite permite ADD COLUMN con REFERENCES siempre
      // que el default sea NULL, que es justo el caso (un ticket publicado a mano
      // no viene de ningun plan).
      const tasksTable = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").get();
      if (tasksTable) {
        const taskCols = this.db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
        if (!taskCols.includes('swarm_task_id')) {
          this.db.exec('ALTER TABLE tasks ADD COLUMN swarm_task_id TEXT REFERENCES swarm_tasks(id)');
          this.db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_swarm_task ON tasks(swarm_task_id)');
          logger.info("Auto-migrated table 'tasks': added column 'swarm_task_id'");
        }
      }

      // Seed SYSTEM agent to satisfy Foreign Key constraints for SYSTEM messages
      const agentsTable = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'").get();
      if (agentsTable) {
        this.db.exec("INSERT OR IGNORE INTO agents (id, name, type, status) VALUES ('agt_system', 'SYSTEM', 'system', 'online')");
      }
    } catch (err) {
      logger.error({ err }, "Error running auto-migrations");
    }
  }

  // Ejecuta un archivo .sql completo (útil para schemas de módulos)
  executeSchema(schemaPath) {
    try {
      if (fs.existsSync(schemaPath)) {
        const schemaStr = fs.readFileSync(schemaPath, 'utf8');
        this.db.exec(schemaStr);
        logger.debug(`Schema loaded from ${schemaPath}`);
      }
    } catch (err) {
      logger.error({ err, schemaPath }, 'Error executing schema');
      throw err;
    }
  }

  // Helpers genéricos para facilitar el uso en los módulos
  prepare(sql) {
    return this.db.prepare(sql);
  }

  close() {
    this.db.close();
  }
}

// Instancia global (singleton para la app)
export const db = new DB();
