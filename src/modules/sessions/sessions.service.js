import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';

const VALID_MODES = ['autopilot', 'moderator', 'free'];

const MODE_DEFAULTS = {
  autopilot: { max_turns: 10, cooldown_seconds: 30 },
  moderator: {},
  free: { goals: [], current_goal_index: 0 }
};

export class SessionsService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  createSession(payload) {
    const { name, mode = 'moderator', mode_config = {}, metadata = {} } = payload;
    if (!name) throw new Error('Session name is required');

    if (!VALID_MODES.includes(mode)) {
      throw new Error(`Invalid mode '${mode}'. Valid modes: ${VALID_MODES.join(', ')}`);
    }

    // Merge defaults del modo con config del usuario
    const config = { ...MODE_DEFAULTS[mode], ...mode_config };

    // Validación específica por modo
    if (mode === 'free' && (!config.goals || config.goals.length === 0)) {
      throw new Error('Free mode requires at least one goal in mode_config.goals');
    }

    try {
      const sessionId = generateId('ses');
      const stmt = this.db.prepare(`
        INSERT INTO sessions (id, name, mode, mode_config, turn_count, metadata, status)
        VALUES (?, ?, ?, ?, 0, ?, 'active')
      `);
      stmt.run(sessionId, name, mode, JSON.stringify(config), JSON.stringify(metadata));

      logger.info({ sessionId, name, mode }, 'New session created');
      this.eventBus.emit('session:created', { sessionId, name, mode });

      return { id: sessionId, name, mode, mode_config: config, status: 'active', turn_count: 0, metadata };
    } catch (err) {
      logger.error({ err, name }, 'Error creating session');
      throw err;
    }
  }

  joinSession(agentName, sessionId) {
    if (!agentName || !sessionId) throw new Error('Agent name and Session ID required');

    const session = this.db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status === 'archived') throw new Error('Cannot join an archived session');

    try {
      const stmt = this.db.prepare(
        "UPDATE agents SET current_session_id = ?, last_seen = datetime('now') WHERE name = ?"
      );
      stmt.run(sessionId, agentName);
      return { success: true, message: `Agent ${agentName} joined session ${sessionId}` };
    } catch (error) {
      logger.error({ error, agentName, sessionId }, 'Error joining session');
      throw error;
    }
  }

  leaveSession(agentName) {
    if (!agentName) throw new Error('Agent name is required');
    try {
      const stmt = this.db.prepare(
        "UPDATE agents SET current_session_id = NULL, last_seen = datetime('now') WHERE name = ?"
      );
      stmt.run(agentName);
      return { success: true, agent: agentName, session_id: null };
    } catch (error) {
      logger.error({ error, agentName }, 'Error leaving session');
      throw error;
    }
  }

  getSessionStatus(sessionId) {
    if (!sessionId) throw new Error('Session ID is required');

    const session = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error('Session not found');

    const config = session.mode_config ? JSON.parse(session.mode_config) : {};
    const metadata = session.metadata ? JSON.parse(session.metadata) : {};

    const result = {
      id: session.id,
      name: session.name,
      mode: session.mode,
      status: session.status,
      turn_count: session.turn_count,
      mode_config: config,
      metadata,
      created_at: session.created_at,
      updated_at: session.updated_at
    };

    // Info adicional por modo
    if (session.mode === 'autopilot') {
      result.turns_remaining = Math.max(0, (config.max_turns || 10) - session.turn_count);
    }

    if (session.mode === 'free' && config.goals && config.goals.length > 0) {
      const idx = config.current_goal_index || 0;
      result.current_goal = config.goals[idx] || null;
      result.current_goal_index = idx;
      result.total_goals = config.goals.length;
      result.goals_remaining = config.goals.length - idx;
    }

    // Listar agentes en esta sesión
    const agents = this.db.prepare('SELECT name, type, status FROM agents WHERE current_session_id = ?').all(sessionId);
    result.participants = agents;

    return result;
  }

  completeGoal(sessionId, agentName) {
    if (!sessionId || !agentName) throw new Error('Session ID and agent name are required');

    const session = this.db.prepare('SELECT mode, mode_config, status FROM sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.mode !== 'free') throw new Error('bridge_complete_goal is only available in free mode');
    if (session.status !== 'active') throw new Error(`Session is not active (current status: ${session.status})`);

    const config = JSON.parse(session.mode_config);
    const currentIndex = config.current_goal_index || 0;
    const completedGoal = config.goals[currentIndex];

    logger.info({ sessionId, agentName, completedGoal, goalIndex: currentIndex }, 'Goal completed');

    // Cambiar sesión a checkpoint
    this.db.prepare(
      "UPDATE sessions SET status = 'checkpoint', updated_at = datetime('now') WHERE id = ?"
    ).run(sessionId);

    this.eventBus.emit('session:checkpoint', { sessionId, completedGoal, agentName });

    return {
      success: true,
      completed_goal: completedGoal,
      goal_index: currentIndex,
      status: 'checkpoint',
      message: `Goal "${completedGoal}" marked complete. Session paused at checkpoint. Waiting for human to call bridge_resume_session with action: continue, improve, or pause.`
    };
  }

  resumeSession(sessionId, action) {
    if (!sessionId || !action) throw new Error('Session ID and action are required');

    const validActions = ['continue', 'improve', 'pause'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action '${action}'. Valid actions: ${validActions.join(', ')}`);
    }

    const session = this.db.prepare('SELECT mode, mode_config, status FROM sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'checkpoint' && session.status !== 'paused') {
      throw new Error(`Session must be in checkpoint or paused status to resume (current: ${session.status})`);
    }

    const config = JSON.parse(session.mode_config);

    if (action === 'pause') {
      this.db.prepare(
        "UPDATE sessions SET status = 'paused', updated_at = datetime('now') WHERE id = ?"
      ).run(sessionId);
      return { success: true, status: 'paused', message: 'Session paused by human.' };
    }

    if (action === 'improve') {
      // Mantener el mismo goal, reactivar la sesión
      this.db.prepare(
        "UPDATE sessions SET status = 'active', updated_at = datetime('now') WHERE id = ?"
      ).run(sessionId);
      const currentGoal = config.goals ? config.goals[config.current_goal_index || 0] : null;
      return { success: true, status: 'active', message: `Retrying goal: "${currentGoal}". Session reactivated.` };
    }

    if (action === 'continue') {
      // Avanzar al siguiente goal
      const nextIndex = (config.current_goal_index || 0) + 1;

      if (config.goals && nextIndex >= config.goals.length) {
        // Todos los goals completados
        this.db.prepare(
          "UPDATE sessions SET status = 'completed', updated_at = datetime('now') WHERE id = ?"
        ).run(sessionId);
        return { success: true, status: 'completed', message: 'All goals completed! Session finished.' };
      }

      // Actualizar al siguiente goal
      config.current_goal_index = nextIndex;
      this.db.prepare(
        "UPDATE sessions SET status = 'active', mode_config = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(JSON.stringify(config), sessionId);

      return {
        success: true,
        status: 'active',
        next_goal: config.goals[nextIndex],
        goal_index: nextIndex,
        message: `Moving to next goal: "${config.goals[nextIndex]}". Session reactivated.`
      };
    }
  }

  listSessions() {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
    const sessions = stmt.all();
    return sessions.map(s => ({
      ...s,
      mode_config: s.mode_config ? JSON.parse(s.mode_config) : {},
      metadata: s.metadata ? JSON.parse(s.metadata) : {}
    }));
  }
}
