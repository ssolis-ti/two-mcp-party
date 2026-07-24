import { logger } from '../../core/logger.js';

export class MemoryService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  shareMemory(payload) {
    const { namespace = 'global', key, value, agent } = payload;

    if (!key || value === undefined) {
      throw new Error('key and value are required');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO shared_memory (namespace, key, value, agent_owner, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(namespace, key) DO UPDATE SET 
          value = excluded.value,
          agent_owner = excluded.agent_owner,
          updated_at = datetime('now')
      `);
      
      stmt.run(
        namespace, 
        key, 
        typeof value === 'object' ? JSON.stringify(value) : value, 
        agent || null
      );

      const memEntry = { namespace, key, value, agent };
      
      this.eventBus.emit('memory:updated', memEntry);
      
      logger.debug({ namespace, key }, 'Memory updated');
      return { success: true, namespace, key };
    } catch (err) {
      logger.error({ err, namespace, key }, 'Failed to share memory');
      throw err;
    }
  }

  getMemory(namespace = 'global', key = null) {
    try {
      if (key) {
        const stmt = this.db.prepare('SELECT * FROM shared_memory WHERE namespace = ? AND key = ?');
        const entry = stmt.get(namespace, key);
        
        if (!entry) return null;
        
        try {
          entry.value = JSON.parse(entry.value);
        } catch(e) {} // If not JSON, leave as string
        
        return entry;
      } else {
        const stmt = this.db.prepare('SELECT * FROM shared_memory WHERE namespace = ?');
        const entries = stmt.all(namespace);
        
        return entries.map(entry => {
          try {
            entry.value = JSON.parse(entry.value);
          } catch(e) {}
          return entry;
        });
      }
    } catch (err) {
      logger.error({ err, namespace, key }, 'Failed to get memory');
      throw err;
    }
  }
}
