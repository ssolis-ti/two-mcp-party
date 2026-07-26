import { logger } from '../../core/logger.js';
import crypto from 'crypto';

export class LoopService {
  constructor(db) {
    this.db = db;
    // Map<sessionId, Map<agentId, ToolCall[]>>
    this.toolHistory = new Map();
    // Limpieza periódica del Map (cada 5 minutos)
    setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  /**
   * Chequea si el mensaje actual representa un loop.
   * @param {string} sessionId
   * @param {string} agentId 
   * @param {string} rawContent 
   * @returns {boolean} true si es un loop ciego
   */
  checkAntiLoop(sessionId, agentId, rawContent) {
    let toolName = 'unknown';
    let argsHash = 'none';

    // Intentar extraer la firma de tool call del content (ej. formato Claude/MCP)
    // Usualmente el content tiene la tool call embedida o podemos hashear todo el raw content
    // Para simplificar, hasheamos el rawContent completo si no podemos parsearlo
    // Pero asumiendo el formato de AgentBridge, usaremos el rawContent completo como la "firma".
    // Wait, let's just hash the rawContent for exact matches.
    const contentHash = crypto.createHash('sha256').update(rawContent).digest('hex');

    // Extraer nombre de tool si existe (rudimentario)
    const toolMatch = rawContent.match(/"name":\s*"([^"]+)"/);
    if (toolMatch) {
      toolName = toolMatch[1];
    } else {
      toolName = 'message'; // chat normal
    }

    if (!this.toolHistory.has(sessionId)) {
      this.toolHistory.set(sessionId, new Map());
    }
    const sessionHistory = this.toolHistory.get(sessionId);

    if (!sessionHistory.has(agentId)) {
      sessionHistory.set(agentId, []);
    }
    const history = sessionHistory.get(agentId);

    // 1. Detectar misma tool + mismos args (exact match de content)
    let isLoop = false;
    let loopType = '';

    const lastCalls = history.slice(-5);
    
    // Check 1: ¿Los últimos 3 mensajes son idénticos en contenido (hash)?
    const last3 = history.slice(-3);
    if (last3.length === 3 && last3.every(c => c.contentHash === contentHash)) {
      isLoop = true;
      loopType = 'exact_content';
    }

    // Check 2: ¿Llamó a la misma tool 5 veces seguidas? (solo si es tool, no chat normal)
    if (!isLoop && toolName !== 'message') {
      if (lastCalls.length === 5 && lastCalls.every(c => c.toolName === toolName)) {
        isLoop = true;
        loopType = 'repeated_tool';
      }
    }

    if (isLoop) {
      logger.warn({ sessionId, agentId, loopType, toolName }, 'Anti-loop triggered');
      this._logLoopEvent(sessionId, agentId, toolName, loopType);
      return true; // Es un loop, debe ser interceptado
    }

    // Registrar en history
    history.push({ toolName, contentHash, ts: Date.now() });

    // Mantener límite de 20
    if (history.length > 20) {
      history.shift();
    }

    return false;
  }

  _logLoopEvent(sessionId, agentId, toolName, loopType) {
    try {
      this.db.prepare(`
        INSERT INTO loop_events (session_id, agent_id, tool_name, repeat_count, first_seen, last_seen)
        VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
      `).run(sessionId, agentId, toolName);
    } catch (err) {
      logger.error({ err, sessionId, agentId }, 'Failed to log loop event');
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [sessionId, sessionMap] of this.toolHistory.entries()) {
      for (const [agentId, history] of sessionMap.entries()) {
        // Remover si el último mensaje fue hace más de 5 minutos
        if (history.length > 0 && (now - history[history.length - 1].ts) > 5 * 60 * 1000) {
          sessionMap.delete(agentId);
        }
      }
      if (sessionMap.size === 0) {
        this.toolHistory.delete(sessionId);
      }
    }
  }
}
