import { logger } from '../../core/logger.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * MaterializeService — "Puente" de la mente colmena hacia el canal colaborativo MCP.
 *
 * Toma un plan maestro producido por la mente colmena (swarm_plans / swarm_tasks en SQLite)
 * y lo MATERIALIZA en una sesión MCP real con traspaso rico:
 *   register -> create_session(free) -> join -> share_memory -> publish_task xN -> send_message(handoff)
 * + escribe artefactos .md en el workspace de la sesión.
 *
 * Así el plan deja de ser una isla SQLite y entra al canal colaborativo nativo del harness,
 * donde el orquestador (Hermes) puede leer mensajes, reclamar tareas y heredar contexto.
 *
 * NO ejecuta las tareas: únicamente materializa el plan (diseño/arquitectura, sin gasto de crédito LLM).
 */
export class MaterializeService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    this.engine = null;
  }

  initialize({ engine }) {
    this.engine = engine;
    logger.info('MaterializeService initialized (swarm -> MCP session bridge ready)');
  }

  _findTool(name) {
    const tools = this.engine.getTools();
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`[materialize] Tool no registrada: ${name}`);
    return tool;
  }

  async _call(name, args) {
    const tool = this._findTool(name);
    const result = await tool.handler(args, this.engine);
    // Normaliza: el handler devuelve objeto o la tool MCP server lo serializa; aquí usamos el objeto directo.
    return result;
  }

  _planData(planId) {
    const plan = this.db.prepare('SELECT * FROM swarm_plans WHERE id = ?').get(planId);
    if (!plan) throw new Error(`Plan no encontrado: ${planId}`);
    const tasks = this.db.prepare('SELECT * FROM swarm_tasks WHERE plan_id = ?').all(planId);
    if (!tasks.length) throw new Error(`El plan ${planId} no tiene tareas.`);
    return { plan, tasks };
  }

  _parseJsonArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch (_) { return []; }
  }

  _allKnownSkills() {
    const rows = this.db.prepare("SELECT name FROM swarm_skills WHERE source = 'known' ORDER BY name").all();
    return rows.map((r) => r.name);
  }

  /**
   * T3/T4 — Exporta el plan maestro a ARTEFACTOS en el workspace de la sesión.
   * Contrato de export:
   *   <workspace>/<plan_id>/plan.json                 -> metadata completa del plan
   *   <workspace>/<plan_id>/tasks/<tsk_<id>>.md       -> una hoja de tarea por tarea
   * El workspace es un directorio real en disco (no solo isla SQLite), lo que
   * permite auditoría, revisión y consumo por herramientas externas de archivos.
   * @returns {object} { workspace, planFile, taskFiles }
   */
  _exportToWorkspace(plan, tasks) {
    const base = path.resolve(__dirname, '..', '..', '..', 'workspace');
    const planDir = path.join(base, plan.id);
    const tasksDir = path.join(planDir, 'tasks');
    mkdirSync(tasksDir, { recursive: true });

    const planDoc = {
      plan_id: plan.id,
      objective: plan.objective,
      description: plan.description || '',
      status: plan.status,
      source: plan.source,
      created_at: plan.created_at,
      summary: (() => {
        try {
          const m = plan.metadata ? JSON.parse(plan.metadata) : {};
          return m.summary || '';
        } catch (_) {
          return '';
        }
      })(),
      metadata: (() => {
        try { return plan.metadata ? JSON.parse(plan.metadata) : {}; } catch (_) { return {}; }
      })(),
      tasks_count: tasks.length,
    };
    const planFile = path.join(planDir, 'plan.json');
    writeFileSync(planFile, JSON.stringify(planDoc, null, 2), 'utf8');

    const taskFiles = [];
    for (const t of tasks) {
      const slug = (t.title || 'tarea')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'tarea';
      const md = [
        `# ${t.title}`,
        '',
        t.description || '',
        '',
        '## Deliverable',
        '',
        t.deliverable || '',
        '',
        '## Criterios de aceptación',
        '',
        ...this._parseJsonArr(t.accept_criteria).map((c) => `- ${c}`),
        '',
        '## Dependencias',
        '',
        (this._parseJsonArr(t.dependencies).length
          ? this._parseJsonArr(t.dependencies).map((d) => `- ${d}`).join('\n')
          : '- ninguna'),
        '',
        '## Capabilities / Skills',
        '',
        (this._parseJsonArr(t.capabilities).length
          ? this._parseJsonArr(t.capabilities).map((c) => `- ${c}`).join('\n')
          : '- ninguno'),
        '',
        `Modelo sugerido: ${t.suggested_model || 'n/a'}`,
        '',
        `Estado: ${t.status || 'ready'}`,
        '',
      ].join('\n');
      const tf = path.join(tasksDir, `${t.id}.md`);
      writeFileSync(tf, md, 'utf8');
      taskFiles.push(tf);
    }

    return { workspace: planDir, planFile, taskFiles };
  }

  /**
   * Materializa un plan maestro de la mente colmena en una sesión MCP real.
   * @param {object} args { plan_id, orchestrator_name }
   */
  async materializePlan(args) {
    const planId = args.plan_id;
    if (!planId) throw new Error('plan_id es requerido');
    const orchestrator = args.orchestrator_name || 'hermes-orchestrator';

    // 1) datos del plan
    const { plan, tasks } = this._planData(planId);
    logger.info({ planId, tasks: tasks.length, orchestrator }, 'Materializing swarm plan');

    // 2) skills faltantes: capabilities de las tareas que no están en el catálogo 'known'
    const known = new Set(this._allKnownSkills());
    const required = new Set();
    for (const t of tasks) for (const c of this._parseJsonArr(t.capabilities)) required.add(c);
    const missingSkills = [...required].filter((c) => !known.has(c));

    // 3) registrar orquestador (idempotente: registerAgent hace upsert por name)
    await this._call('bridge_register', {
      name: orchestrator,
      type: 'orchestrator',
      description: 'Hermes que orquesta la mente colmena y ejecuta sus planes.',
      capabilities: ['route', 'execute', 'validate', 'synthesize'],
    });

    // 4) crear sesión free con goals = títulos de las tareas
    const goals = tasks.map((t) => t.title);
    const session = await this._call('bridge_create_session', {
      name: `Colmena-Orquestador-${planId.slice(4, 8)}`,
      mode: 'free',
      mode_config: { goals },
      metadata: { plan_id: planId, maestro: orchestrator, materialized: true },
    });
    let sessionId = null;
    if (session && typeof session === 'object') {
      sessionId = session.id || session.session_id;
    } else {
      try { sessionId = JSON.parse(session).id; } catch (_) {}
    }
    if (!sessionId) throw new Error(`No se pudo obtener session_id de create_session: ${JSON.stringify(session)}`);

    // 5) join (actualiza current_session_id del agente)
    await this._call('bridge_join_session', { agent_name: orchestrator, session_id: sessionId });

    // 6) compartir contexto rico (memoria)
    const memoryValue = JSON.stringify({
      plan_id: planId,
      objective: plan.objective,
      missing_skills: missingSkills,
      decision_orchestrator: 'Hermes valida cada propuesta de la colmena contra el harness real antes de aceptarla.',
      nota_traspaso: missingSkills.length
        ? `Capabilities que el plan exige y NO existen en el catálogo: ${missingSkills.join(', ')}. Quien ejecute debe crearlas o descartarlas tras validación.`
        : 'Todas las capabilities del plan existen en el catálogo.',
    }, null, 2);
    await this._call('bridge_share_memory', { agent_name: orchestrator, key: 'colmena:contexto_rico', value: memoryValue });

    // 7) publicar las tareas del plan (usa current_session_id del agente)
    const pubResults = [];
    for (const t of tasks) {
      const desc = `${t.title}\n${t.description || ''}\n\nDeliverable: ${t.deliverable || ''}\nSkills: ${this._parseJsonArr(t.capabilities).join(', ')}\nDepende de: ${this._parseJsonArr(t.dependencies).join(', ') || 'nada'}`;
      const pub = await this._call('bridge_publish_task', { agent_name: orchestrator, description: desc });
      pubResults.push(pub.id || pub);
    }

    // 8) mensaje de handoff con traspaso narrativo rico, cediendo el turno
    const handoff = `${orchestrator} materializó el plan ${planId} de la mente colmena (${tasks.length} tareas) en la sesión ${sessionId}.
Las tareas están publicadas como tickets. La memoria compartida 'colmena:contexto_rico' contiene skills faltantes y decisiones.

⚠ SUPERVISIÓN: ${missingSkills.length
      ? `capabilities exigidas que NO existen en el catálogo → ${missingSkills.join(', ')}. Crear o descartar tras validación contra el código real.`
      : 'todas las capabilities requeridas existen en el catálogo.'}
Cedo el turno al siguiente agente.`;
    await this._call('bridge_send_message', { from: orchestrator, content: handoff, type: 'message', yield_to: 'any' });

    // 9) T3/T4: exportar el plan a artefactos en el workspace (plan.json + tasks/*.md)
    let exportArtifacts = null;
    try {
      exportArtifacts = this._exportToWorkspace(plan, tasks);
      logger.info({ planId, workspace: exportArtifacts.workspace, files: exportArtifacts.taskFiles.length + 1 }, 'Plan workspace artifacts written');
    } catch (err) {
      logger.warn({ planId, err: err.message }, 'Workspace export failed (no bloquea materialización)');
      exportArtifacts = { workspace: null, planFile: null, taskFiles: [] };
    }

    return {
      ok: true,
      plan_id: planId,
      session_id: sessionId,
      orchestrator,
      tasks_materialized: tasks.map((t) => t.title),
      missing_skills: missingSkills,
      memory_key: 'colmena:contexto_rico',
      workspace: exportArtifacts.workspace,
      artifacts: { plan_file: exportArtifacts.planFile, task_files: exportArtifacts.taskFiles },
    };
  }
}
