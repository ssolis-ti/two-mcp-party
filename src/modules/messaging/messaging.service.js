import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';

export class MessagingService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  sendMessage(payload) {
    const { from, content, type = 'message', metadata = {} } = payload;

    if (!from || !content) {
      throw new Error('from and content are required');
    }

    try {
      // Validar sesión activa
      const agent = this.db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(from);
      if (!agent || !agent.current_session_id) {
        throw new Error('You must join a session before sending messages. Use bridge_join_session.');
      }

      const sessionId = agent.current_session_id;
      const msgId = generateId('msg');
      
      const stmt = this.db.prepare(`
        INSERT INTO messages (id, session_id, from_agent, content, type, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(msgId, sessionId, from, content, type, JSON.stringify(metadata));

      const message = { id: msgId, session_id: sessionId, from, content, type, metadata, created_at: new Date().toISOString() };
      
      this.eventBus.emit('message:new', message);
      logger.debug({ msgId, from, session_id: sessionId }, 'Message sent');
      return message;
    } catch (err) {
      logger.error({ err, from }, 'Failed to send message');
      throw err;
    }
  }

  getMessages(agentName, limit = 50) {
    if (!agentName) throw new Error('agentName is required');

    try {
      const agent = this.db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(agentName);
      if (!agent || !agent.current_session_id) {
        throw new Error('You must join a session to read messages. Use bridge_join_session.');
      }

      const stmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE session_id = ?
        ORDER BY created_at ASC
        LIMIT ?
      `);
      
      const messages = stmt.all(agent.current_session_id, limit);
      
      return messages.map(m => ({
        ...m,
        metadata: m.metadata ? JSON.parse(m.metadata) : {}
      }));
    } catch (err) {
      logger.error({ err, agentName }, 'Failed to get messages');
      throw err;
    }
  }
}
