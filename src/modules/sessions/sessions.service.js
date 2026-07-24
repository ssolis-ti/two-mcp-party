import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';

export class SessionsService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  createSession(payload) {
    const { name, metadata = {} } = payload;
    if (!name) throw new Error('Session name is required');

    try {
      const sessionId = generateId('ses');
      const stmt = this.db.prepare(`
        INSERT INTO sessions (id, name, metadata, status)
        VALUES (?, ?, ?, 'active')
      `);
      stmt.run(sessionId, name, JSON.stringify(metadata));
      
      logger.info({ sessionId, name }, 'New session created');
      this.eventBus.emit('session:created', { sessionId, name });
      
      return { id: sessionId, name, status: 'active', metadata };
    } catch (err) {
      logger.error({ err, name }, 'Error creating session');
      throw err;
    }
  }

  joinSession(agentName, sessionId) {
    if (!agentName || !sessionId) throw new Error('Agent name and Session ID required');
    
    // Verificar que la sesión exista y esté activa
    const session = this.db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Cannot join an archived session');

    // Actualizar current_session_id del agente
    const stmt = this.db.prepare('UPDATE agents SET current_session_id = ?, last_seen = datetime("now") WHERE name = ?');
    stmt.run(sessionId, agentName);
    
    logger.debug({ agentName, sessionId }, 'Agent joined session');
    return { success: true, agent: agentName, session_id: sessionId };
  }

  leaveSession(agentName) {
    if (!agentName) throw new Error('Agent name required');
    const stmt = this.db.prepare('UPDATE agents SET current_session_id = NULL, last_seen = datetime("now") WHERE name = ?');
    stmt.run(agentName);
    return { success: true, agent: agentName, session_id: null };
  }

  listSessions() {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
    const sessions = stmt.all();
    return sessions.map(s => ({
      ...s,
      metadata: s.metadata ? JSON.parse(s.metadata) : {}
    }));
  }
}
