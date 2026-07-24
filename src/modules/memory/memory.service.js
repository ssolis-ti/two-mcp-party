import { logger } from '../../core/logger.js';

export class MemoryService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  shareMemory(payload) {
    const { key, value, agent } = payload;

    if (!key || value === undefined || !agent) {
      throw new Error('key, value, and agent are required');
    }

    try {
      const agentRec = this.db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(agent);
      if (!agentRec || !agentRec.current_session_id) {
        throw new Error('You must join a session before sharing memory. Use bridge_join_session.');
      }
      
      const sessionId = agentRec.current_session_id;

      const stmt = this.db.prepare(`
        INSERT INTO shared_memory (session_id, key, value, agent_owner, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(session_id, key) DO UPDATE SET 
          value = excluded.value,
          agent_owner = excluded.agent_owner,
          updated_at = datetime('now')
      `);
      
      stmt.run(
        sessionId, 
        key, 
        typeof value === 'object' ? JSON.stringify(value) : value, 
        agent
      );

      const memEntry = { session_id: sessionId, key, value, agent };
      
      this.eventBus.emit('memory:updated', memEntry);
      logger.debug({ session_id: sessionId, key }, 'Memory updated');
      return { success: true, session_id: sessionId, key };
    } catch (err) {
      logger.error({ err, key }, 'Failed to share memory');
      throw err;
    }
  }

  getMemory(agentName, key = null) {
    if (!agentName) throw new Error('Agent name is required');
    
    try {
      const agentRec = this.db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(agentName);
      if (!agentRec || !agentRec.current_session_id) {
        throw new Error('You must join a session before reading memory. Use bridge_join_session.');
      }
      const sessionId = agentRec.current_session_id;

      if (key) {
        const stmt = this.db.prepare('SELECT * FROM shared_memory WHERE session_id = ? AND key = ?');
        const entry = stmt.get(sessionId, key);
        
        if (!entry) return null;
        try { entry.value = JSON.parse(entry.value); } catch(e) {}
        return entry;
      } else {
        const stmt = this.db.prepare('SELECT * FROM shared_memory WHERE session_id = ?');
        const entries = stmt.all(sessionId);
        
        return entries.map(entry => {
          try { entry.value = JSON.parse(entry.value); } catch(e) {}
          return entry;
        });
      }
    } catch (err) {
      logger.error({ err, key }, 'Failed to get memory');
      throw err;
    }
  }
}
