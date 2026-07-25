import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';

export class AgentsService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    this.heartbeatTimeout = 1 * 60 * 1000; // 1 minuto (Dead Peer Detection)
  }

  registerAgent(payload) {
    const { name, type = 'generic', description = '', capabilities = [] } = payload;
    
    if (!name) {
      throw new Error('Agent name is required');
    }

    try {
      // Verificar si ya existe
      const existing = this.db.prepare('SELECT id, current_session_id FROM agents WHERE name = ?').get(name);
      
      let agentId;
      if (existing) {
        agentId = existing.id;
        // Actualizar datos pero mantener su sesión actual
        const stmt = this.db.prepare(`
          UPDATE agents 
          SET type = ?, description = ?, capabilities = ?, status = 'online', last_seen = datetime('now')
          WHERE id = ?
        `);
        stmt.run(type, description, JSON.stringify(capabilities), agentId);
        logger.info({ agentId, name }, 'Agent re-registered and marked online');
      } else {
        // Crear nuevo
        agentId = generateId('agt');
        const stmt = this.db.prepare(`
          INSERT INTO agents (id, name, type, description, capabilities, status)
          VALUES (?, ?, ?, ?, ?, 'online')
        `);
        stmt.run(agentId, name, type, description, JSON.stringify(capabilities));
        logger.info({ agentId, name }, 'New agent registered');
      }

      this.eventBus.emit('agent:registered', { agentId, name });
      return { agentId, name, status: 'online', current_session_id: existing?.current_session_id || null };

    } catch (err) {
      logger.error({ err, name }, 'Error registering agent');
      throw err;
    }
  }

  setCurrentSession(name, sessionId) {
    const stmt = this.db.prepare(`
      UPDATE agents SET current_session_id = ?, last_seen = datetime('now'), status = 'online'
      WHERE name = ?
    `);
    const result = stmt.run(sessionId, name);
    if (result.changes === 0) throw new Error(`Agent ${name} not found`);
  }

  getAgent(name) {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE name = ?');
    return stmt.get(name);
  }

  heartbeat(name) {
    if (!name) throw new Error('Agent name is required for heartbeat');
    
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET last_seen = datetime('now'), status = 'online'
      WHERE name = ?
    `);
    const result = stmt.run(name);
    
    if (result.changes === 0) {
      throw new Error(`Agent ${name} not found. Please register first.`);
    }
    
    return { success: true, timestamp: new Date().toISOString() };
  }

  listAgents() {
    this.checkTimeouts();

    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY last_seen DESC');
    const agents = stmt.all();
    
    return agents.map(a => ({
      ...a,
      capabilities: a.capabilities ? JSON.parse(a.capabilities) : [],
      metadata: a.metadata ? JSON.parse(a.metadata) : {}
    }));
  }

  checkTimeouts() {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET status = 'offline' 
      WHERE status = 'online' AND last_seen < datetime('now', '-1 minute')
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      logger.debug(`Marked ${result.changes} agents as offline due to timeout`);
    }
  }
}
