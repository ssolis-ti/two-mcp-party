import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';

export class MessagingService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  sendMessage(payload) {
    const { from, to = null, content, type = 'message', metadata = {} } = payload;

    if (!from || !content) {
      throw new Error('from and content are required');
    }

    try {
      const msgId = generateId('msg');
      const stmt = this.db.prepare(`
        INSERT INTO messages (id, from_agent, to_agent, content, type, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        msgId, 
        from, 
        to, 
        content, 
        type, 
        JSON.stringify(metadata)
      );

      const message = { id: msgId, from, to, content, type, metadata, created_at: new Date().toISOString() };
      
      // Emitir evento para WebSockets (push real-time en el futuro)
      this.eventBus.emit('message:new', message);
      
      logger.debug({ msgId, from, to }, 'Message sent successfully');
      return message;
    } catch (err) {
      logger.error({ err, from, to }, 'Failed to send message');
      throw err;
    }
  }

  getMessages(agentName, limit = 50) {
    if (!agentName) throw new Error('agentName is required');

    try {
      // Obtener mensajes dirigidos al agente (o broadcasts)
      const stmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE to_agent = ? OR to_agent IS NULL
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const messages = stmt.all(agentName, limit);
      
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
