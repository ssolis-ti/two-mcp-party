import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';

export class MessagingService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  sendMessage(payload) {
    const { from, content, type = 'message', metadata = {}, yield_to = null, priority = 'normal' } = payload;

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
        'SELECT mode, mode_config, turn_count, status, current_turn FROM sessions WHERE id = ?'
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

      // === DPD (Dead Peer Detection) ===
      if (session.current_turn && session.current_turn !== from) {
        // Consultar estado del dueño actual del token
        const currentOwner = this.db.prepare('SELECT status FROM agents WHERE name = ?').get(session.current_turn);
        if (!currentOwner || currentOwner.status === 'offline') {
          logger.info(`Dead Peer Detection: Reclaiming token from offline agent ${session.current_turn}`);
          session.current_turn = null; // Liberar el candado localmente para esta iteración
        }
      }

      // 1.5. Verificar Token de Turno (Ignorado si es critical)
      if (priority !== 'critical' && session.current_turn && session.current_turn !== from) {
        throw new Error(`It is not your turn. Waiting for TX token from: ${session.current_turn}`);
      }

      // 2. Autopilot: verificar límite de turnos (Bypass si es critical)
      let config = {};
      if (priority !== 'critical' && session.mode === 'autopilot') {
        config = session.mode_config ? JSON.parse(session.mode_config) : {};
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
      }

      // 3. Universal Cooldown (Bypass si es critical)
      if (priority !== 'critical') {
        // En modo autopilot el cooldown puede ser mayor (ej: 30s). En otros modos (free, moderator), 3s minimo anti-spam.
        const cooldownSeconds = (session.mode === 'autopilot' && config.cooldown_seconds) ? config.cooldown_seconds : 3;
        const lastMsg = this.db.prepare(
          'SELECT created_at FROM messages WHERE session_id = ? AND from_agent = ? ORDER BY created_at DESC LIMIT 1'
        ).get(sessionId, from);

        if (lastMsg) {
          const lastTime = new Date(lastMsg.created_at + 'Z').getTime();
          const elapsed = (Date.now() - lastTime) / 1000;
          if (elapsed < cooldownSeconds) {
            const wait = Math.ceil(cooldownSeconds - elapsed);
            throw new Error(
              `Universal Cooldown active for ${from}. Wait ${wait} more second(s) before sending again.`
            );
          }
        }
      }

      // === ANTI-LOOPING (No-Progress Detection) ===
      const lastMessages = this.db.prepare(
        'SELECT content FROM messages WHERE session_id = ? AND from_agent = ? ORDER BY rowid DESC LIMIT 3'
      ).all(sessionId, from);
      
      let isLooping = false;
      if (lastMessages.length === 3) {
        isLooping = lastMessages.every(msg => msg.content === content);
      }

      // === INSERT MESSAGE ===
      const msgId = generateId('msg');

      const stmt = this.db.prepare(`
        INSERT INTO messages (id, session_id, from_agent, content, type, metadata, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(msgId, sessionId, from, content, type, JSON.stringify(metadata), priority);

      if (isLooping) {
        const sysMsgId = generateId('msg');
        const sysContent = "Anti-Looping Protection: Se han detectado llamadas idénticas repetidas sin progreso aparente. Por favor, cambia tu estrategia, usa otras herramientas, o detente si estás atascado.";
        stmt.run(sysMsgId, sessionId, 'SYSTEM', sysContent, 'message', '{}', 'critical');
        this.eventBus.emit('message:new', { id: sysMsgId, session_id: sessionId, from: 'SYSTEM', content: sysContent, type: 'message', metadata: {}, priority: 'critical', created_at: new Date().toISOString() });
        logger.warn({ session_id: sessionId, agent: from }, 'Loop detected and intercepted');
      }


      // Procesar yield_to y actualizar sesión
      let nextTurn = session.current_turn;
      if (yield_to) {
        nextTurn = yield_to.toLowerCase() === 'any' ? null : yield_to;
      }

      this.db.prepare(
        "UPDATE sessions SET turn_count = turn_count + 1, current_turn = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(nextTurn, sessionId);

      const message = { id: msgId, session_id: sessionId, from, content, type, metadata, priority, created_at: new Date().toISOString() };

      this.eventBus.emit('message:new', message);
      logger.debug({ msgId, from, session_id: sessionId, mode: session.mode, turn: session.turn_count + 1 }, 'Message sent');
      return message;
    } catch (err) {
      logger.error({ err, from }, 'Failed to send message');
      throw err;
    }
  }

  yieldTurn(agentName, yieldTo) {
    if (!agentName || !yieldTo) throw new Error('agentName and yieldTo are required');

    try {
      const agent = this.db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(agentName);
      if (!agent || !agent.current_session_id) {
        throw new Error('You must join a session to yield turn. Use bridge_join_session.');
      }

      const sessionId = agent.current_session_id;
      const session = this.db.prepare('SELECT current_turn FROM sessions WHERE id = ?').get(sessionId);
      
      if (!session) throw new Error('Session not found');

      if (session.current_turn && session.current_turn !== agentName) {
        throw new Error(`It is not your turn to yield. Current turn belongs to: ${session.current_turn}`);
      }

      const nextTurn = yieldTo.toLowerCase() === 'any' ? null : yieldTo;

      this.db.prepare(
        "UPDATE sessions SET current_turn = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(nextTurn, sessionId);

      return { success: true, message: `Turn yielded to ${nextTurn || 'any'}` };
    } catch (err) {
      logger.error({ err, agentName, yieldTo }, 'Failed to yield turn');
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
        SELECT *, rowid as seq FROM messages 
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
