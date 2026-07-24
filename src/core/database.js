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
    
    logger.info(`Database initialized at ${dbPath} (WAL mode)`);
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
