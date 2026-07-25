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

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('content must be a non-empty string');
    }

    try {
      // Validar sesión activa del agente
      const agent = this.db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(from);
      if (!agent || !agent.current_session_id) {
        throw new Error('You must join a session before sending messages. Use bridge_join_session.');
      }

      const sessionId = agent.current_session_id;

      // === MODE ENFORCEMENT (server-side) ===
      const session = this.db.prepare(
        'SELECT mode, mode_config, turn_count, status FROM sessions WHERE id = ?'
      ).get(sessionId);

      if (!session) throw new Error('Session not found');

      // 1. ¿Sesión pausada o en checkpoint?
      if (session.status === 'paused') {
        throw new Error('Session is paused. Cannot send messages. Use bridge_resume_session to reactivate.');
      }
      if (session.status === 'checkpoint') {
        throw new Error('Session is at a goal checkpoint. Waiting for human to call bridge_resume_session.');
      }
      if (session.status === 'completed') {
        throw new Error('Session is completed. All goals have been achieved. Create a new session to continue.');
      }
      if (session.status !== 'active') {
        throw new Error(`Session status is '${session.status}'. Only active sessions accept messages.`);
      }

      // 2. Autopilot: verificar límite de turnos
      if (session.mode === 'autopilot') {
        const config = session.mode_config ? JSON.parse(session.mode_config) : {};
        const maxTurns = config.max_turns || 10;

        if (session.turn_count >= maxTurns) {
          // Auto-pausar la sesión
          this.db.prepare(
            "UPDATE sessions SET status = 'paused', updated_at = datetime('now') WHERE id = ?"
          ).run(sessionId);
          throw new Error(
            `Autopilot limit reached (${maxTurns} turns). Session auto-paused. Use bridge_resume_session to continue or create a new session.`
          );
        }

        // 3. Autopilot: verificar cooldown
        const cooldownSeconds = config.cooldown_seconds || 30;
        const lastMsg = this.db.prepare(
          'SELECT created_at FROM messages WHERE session_id = ? AND from_agent = ? ORDER BY created_at DESC LIMIT 1'
        ).get(sessionId, from);

        if (lastMsg) {
          const lastTime = new Date(lastMsg.created_at + 'Z').getTime();
          const elapsed = (Date.now() - lastTime) / 1000;
          if (elapsed < cooldownSeconds) {
            const wait = Math.ceil(cooldownSeconds - elapsed);
            throw new Error(
              `Cooldown active for ${from}. Wait ${wait} more second(s) before sending again.`
            );
          }
        }
      }

      // === INSERT MESSAGE ===
      const msgId = generateId('msg');

      const stmt = this.db.prepare(`
        INSERT INTO messages (id, session_id, from_agent, content, type, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(msgId, sessionId, from, content, type, JSON.stringify(metadata));

      // Incrementar turn_count de la sesión
      this.db.prepare(
        "UPDATE sessions SET turn_count = turn_count + 1, updated_at = datetime('now') WHERE id = ?"
      ).run(sessionId);

      const message = { id: msgId, session_id: sessionId, from, content, type, metadata, created_at: new Date().toISOString() };

      this.eventBus.emit('message:new', message);
      logger.debug({ msgId, from, session_id: sessionId, mode: session.mode, turn: session.turn_count + 1 }, 'Message sent');
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
