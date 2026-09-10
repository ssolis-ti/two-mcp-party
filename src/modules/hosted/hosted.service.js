import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';
import { Orchestrator } from './orchestrator.js';
import { LLMGatewayClient } from './llm-gateway-client.js';

/**
 * HostedService: exposes the models of the LiteLLM router as *real* agents in
 * the AgentBridge hub and lets you drive autonomous conversations between them
 * (debate / review / panel / chain).
 *
 * Key design: the hub is NOT modified. We reuse its existing MessagingService,
 * SessionsService, AgentsService and the turn/DPD/anti-loop machinery. This
 * module just registers the model-agents, injects their turns via
 * sendMessage (with proper yield_to), and watches `message:new` to advance
 * the conversation plan.
 *
 * The loop is deterministic: the Orchestrator class gives the exact turn plan
 * (who speaks, with what system prompt). The LLM only ever produces text.
 */

export class HostedService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    this.orchestrator = new Orchestrator();

    this.config = null; // set in onLoad from hosted.config.js
    this.client = null;

    // Map<sessionId: string, {plan, participants, planIndex, state, topic}>
    this.conversations = new Map();
    this._listening = false;
  }

  initialize({ config }) {
    this.config = config;
    this.client = new LLMGatewayClient({
      baseUrl: config.gateway.baseUrl,
      apiKey: config.gateway.apiKey,
      timeoutMs: config.gateway.timeoutMs,
    });

    if (!this._listening) {
      // Advance to the next speaker whenever a fresh message lands in a
      // conversation we are orchestrating.
      this.eventBus.on('message:new', (msg) => {
        const conv = this.conversations.get(msg.session_id);
        if (conv && !conv.busy) {
          // Small defer so other listeners process first; then step.
          setImmediate(() => this._step(conv).catch((err) => {
            logger.error({ err, session_id: msg.session_id }, 'Hosted _step error');
          }));
        }
      });
      this._listening = true;
    }

    logger.info('HostedService initialized (LiteLLM integration)');
  }

  getParticipants() {
    if (!this.config) return [];
    return this.config.agents;
  }

  /** Register a model-agent in the hub so it can be a session participant. */
  _registerAgent(name, role, model) {
    try {
      const existing = this.db.prepare('SELECT id FROM agents WHERE name = ?').get(name);
      if (!existing) {
        this.db.prepare(`
          INSERT INTO agents (id, name, type, description, capabilities, status)
          VALUES (?, ?, 'hosted-llm', ?, ?, 'online')
        `).run(
          `agt_hosted_${name}`,
          name,
          `LiteLLM agent backed by model ${model}. Role: ${role}.`,
          JSON.stringify(['chat'])
        );
        logger.info({ name, model }, 'Hosted model-agent registered');
      } else {
        // Re-affirm online
        this.db.prepare("UPDATE agents SET status='online', last_seen=datetime('now') WHERE name=?").run(name);
      }
      return { name, role, model, status: 'online' };
    } catch (err) {
      logger.error({ err, name }, 'Failed to register hosted model-agent');
      throw err;
    }
  }

  listModels() {
    return (this.config?.agents || []).map((a) => ({ name: a.name, role: a.role, model: a.model }));
  }

  /**
   * Spawn a conversation between the hosted model-agents.
   * @param {object} p { type, topic, max_turns, session_name }
   * @returns session info + plan
   */
  spawnConversation(p) {
    const { type = 'debate', topic } = p;
    const maxTurns = p.max_turns || 12;
    if (!topic || !topic.trim()) throw new Error('topic is required for a conversation');

    const agents = this.getParticipants();
    if (!agents || agents.length === 0) {
      throw new Error('No hosted model-agents configured. Check hosted.config.js.');
    }
    const names = agents.map((a) => a.name);

    // Register each model-agent so the hub knows them.
    agents.forEach((a) => this._registerAgent(a.name, a.role, a.model));

    // Create a session. We use 'autopilot' so we get a configurable cooldown
    // and a hard max-turns cap (both small, to protect credits). The plan
    // length is kept below autopilot's max_turns so the plan finishes cleanly.
    const sessionName = p.session_name || `hosted-${type}-${Date.now().toString(36)}`;
    const sessionsServices = this._getSessionsService();
    const created = sessionsServices.createSession({
      name: sessionName,
      mode: 'autopilot',
      mode_config: { max_turns: maxTurns + 1, cooldown_seconds: 2 },
      metadata: { hosted: true, type, topic },
    });
    const sessionId = created.id;

    // Join all participants.
    names.forEach((n) => sessionsServices.joinSession(n, sessionId));

    // Build the deterministic turn plan.
    const plan = this.orchestrator.buildPlan(type, names);
    const cappedPlan = plan.slice(0, maxTurns);

    const conversation = {
      sessionId,
      sessionName,
      topic,
      type,
      maxTurns,
      plan: cappedPlan,
      participants: names,
      planIndex: 0,
      busy: false,
      state: 'starting',
    };
    this.conversations.set(sessionId, conversation);

    // Emit the system broadcast describing the conversation.
    this._broadcastSystem(sessionId, `## 🎙️ Conversation started (${type})\n**Topic:** ${topic}\n**Participants:** ${names.map(n=>`@${n}`).join(', ')}\n**Max turns:** ${cappedPlan.length}`);

    // Kick off the first turn.
    setImmediate(() => this._step(conversation).catch((err) => {
      logger.error({ err, session_id: sessionId }, 'Hosted spawn step error');
      this._broadcastSystem(sessionId, `Conversation aborted: ${err.message}`);
      conversation.state = 'error';
    }));

    return {
      session_id: sessionId,
      session_name: sessionName,
      type,
      topic,
      plan: cappedPlan.map((s) => ({ agent: s[0], role: s[1].role })),
      status: 'started',
    };
  }

  status() {
    return [...this.conversations.entries()].map(([id, c]) => ({
      session_id: id,
      type: c.type,
      topic: c.topic,
      plan_index: c.planIndex,
      total_turns: c.plan.length,
      state: c.state,
      participants: c.participants,
    }));
  }

  // ─────────────────────────────── internals ───────────────────────────────

  _getMessagingService() {
    return this._messagingService;
  }
  setMessagingService(s) { this._messagingService = s; }

  _getSessionsService() {
    return this._sessionsService;
  }
  setSessionsService(s) { this._sessionsService = s; }

  _broadcastSystem(sessionId, content) {
    // SYSTEM messages are inserted directly (the messaging service requires a
    // joined agent sender; SYSTEM is seeded but never "joined" to sessions).
    try {
      const id = generateId('msg');
      this.db.prepare(`
        INSERT INTO messages (id, session_id, from_agent, content, type, metadata, priority, created_at)
        VALUES (?, ?, 'SYSTEM', ?, 'system', '{}', 'critical', datetime('now'))
      `).run(id, sessionId, content);
      this.eventBus.emit('message:new', {
        id, session_id: sessionId, from: 'SYSTEM', content,
        type: 'system', metadata: {}, priority: 'critical',
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn({ err, sessionId }, 'System broadcast suppressed');
    }
  }

  /**
   * Advance one turn: if conversation done, finalize; else call the next
   * agent's model and inject its reply.
   */
  async _step(conversation) {
    if (conversation.busy) return;
    conversation.busy = true;
    try {
      if (conversation.planIndex >= conversation.plan.length) {
        conversation.state = 'complete';
        this._broadcastSystem(conversation.sessionId, '## ✅ Conversation complete. All turns executed.');
        return;
      }

      const step = conversation.plan[conversation.planIndex];
      const agentName = step[0];
      const role = step[1].role;
      const closes = step[1].closes;

      // Look up the model for this agent.
      const participant = this.getParticipants().find((a) => a.name === agentName);
      if (!participant) {
        throw new Error(`No model configured for agent ${agentName}`);
      }

      // Build the LLM prompt from the transcript so far.
      const history = await this._readHistory(conversation.sessionId);
      const turn = this.orchestrator.buildTurnMessage({
        plan: conversation.plan.map((s) => ({ agent: s[0], role: s[1].role })),
        planIndex: conversation.planIndex,
        history,
        topic: conversation.topic,
      });

      conversation.state = `thinking:${agentName}`;
      logger.info({ session_id: conversation.sessionId, agent: agentName, role, model: participant.model }, 'Hosted agent thinking');

      // Call LiteLLM.
      const { text, model, usage } = await this.client.chat({
        model: participant.model,
        messages: turn.messages,
        max_tokens: this.config.gateway.maxTokens,
        temperature: this.config.gateway.temperature,
      });

      const content = (text || '').trim();
      if (!content) {
        throw new Error(`Model ${participant.model} returned empty content`);
      }

      // Inject the agent's message. Determine yields-to.
      const nextSpeaker = conversation.plan[conversation.planIndex + 1]?.[0] || null;
      conversation.busy = false; // release before sendMessage so message:new can re-enter
      const sent = this._messagingService.sendMessage({
        from: agentName,
        content,
        type: 'message',
        yield_to: closes ? 'any' : (nextSpeaker || 'any'),
        metadata: { role, model: participant.model, usage, hosted: true },
      });
      conversation.planIndex += 1;

      logger.info({ session_id: conversation.sessionId, agent: agentName, tokens: usage?.total_tokens }, 'Hosted agent spoke');
      return sent;
    } catch (err) {
      logger.error({ err, session_id: conversation.sessionId }, 'Hosted step failed');
      conversation.busy = false;
      throw err;
    }
  }

  async _readHistory(sessionId) {
    const rows = this.db.prepare(`
      SELECT from_agent AS agent, content
      FROM messages
      WHERE session_id = ? AND from_agent <> 'SYSTEM'
      ORDER BY created_at ASC, rowid ASC
    `).all(sessionId);
    return rows.map((r) => ({ agent: r.agent, content: r.content }));
  }
}
