import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';
import { LLMGatewayClient } from '../hosted/llm-gateway-client.js';

/**
 * SwarmService — "Mente colmena" planificadora.
 *
 * Rol (IMPORTANTE, por especificación del operador):
 *   La mente colmena NO ejecuta tareas ni gasta créditos corriendo subtareas.
 *   Es la capa de:
 *     1. PLANIFICACION        : descompone un objetivo en tareas bien definidas.
 *     2. ORGANIZACION         : ordena dependencias, criterios de aceptación, entregables.
 *     3. ESTRUCTURACION       : produce "hojas de tarea" listas para ser ejecutadas.
 *     4. POTENCIACION DE SKILLS: detecta qué skills/capacidades requiere cada tarea,
 *                                cataloga las conocidas y PROPONE las faltantes.
 *   El entregable es un PLAN MAESTRO persistido + catálogo de skills, listo para
 *   que OTRAS LLM (externas) lo ejecuten. La deliberación colaborativa entre
 *   modelos se usa SOLO para DISEÑAR el plan (número controlado de llamadas).
 *
 * Automimejora: `reflectAndImprove(planId)` analiza un plan cumplido y PROPONE
 * el siguiente plan maestro (nuevo objetivo/estrategia) para mejorar el sistema
 * o el propio módulo. No ejecuta: solo propone el plan.
 */
/**
 * Angulos de deliberacion. Cada miembro de la colmena recibe uno distinto
 * (round-robin por posicion), porque con el prompt identico los modelos
 * convergian en las mismas cuatro respuestas: mas modelos daban mas eco, no
 * mas cobertura. Al repartir el problema, cada modelo agregado explora una
 * faceta que ninguno de los anteriores estaba mirando.
 */
const PLANNING_LENSES = [
  {
    name: 'descomposicion',
    brief: 'partir el objetivo en unidades de trabajo ejecutables.',
    ask: 'que subtareas concretas faltan, con que granularidad y en que entregable termina cada una.',
  },
  {
    name: 'dependencias',
    brief: 'el orden en que las cosas pueden ocurrir.',
    ask: 'que depende de que, cual es la ruta critica y que prerequisitos externos bloquean el arranque.',
  },
  {
    name: 'riesgos',
    brief: 'lo que puede salir mal y los supuestos fragiles.',
    ask: 'que supuestos no estan verificados, que modos de fallo existen y como se detectaria cada uno a tiempo.',
  },
  {
    name: 'capacidades',
    brief: 'quien puede hacer el trabajo.',
    ask: 'que skills exige el objetivo, cuales NO estan en la lista disponible y cual es el plan si no se consiguen.',
  },
  {
    name: 'restricciones',
    brief: 'los limites reales de recursos, tiempo y contexto.',
    ask: 'que restricciones de costo, plazo, normativa o infraestructura acotan las opciones, y que queda descartado por eso.',
  },
  {
    name: 'validacion',
    brief: 'como se sabra si el objetivo se cumplio.',
    ask: 'que evidencia demostraria exito, que metricas hay que medir antes de empezar y como se evita el autoengaño.',
  },
];

export class SwarmService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    this.config = null;
    this.client = null;
  }

  initialize({ config }) {
    this.config = config;
    // T5 — Blindaje fail-fast de la configuración de síntesis. Sin un presupuesto
    // de tokens suficiente, el sintetizador se truncaba a mitad del summary y
    // colapsaba el plan a 1 tarea. Fallamos de forma explícita y temprana en vez
    // de dejar que degrade silenciosamente (no usamos Zod: validación manual, sin
    // añadir dependencia al stack del harness).
    const lite = config && config.gateway;
    if (!lite || !lite.baseUrl) throw new Error('[swarm] config.gateway.baseUrl es requerido (config inválida).');
    const synth = Number(lite.synthMaxTokens);
    if (!Number.isFinite(synth) || synth < 2000) {
      throw new Error(
        `[swarm] config.gateway.synthMaxTokens debe ser un número >= 2000 (actual: ${lite.synthMaxTokens}). ` +
        'Con presupuesto pequeño el sintetizador trunca su salida y colapsa el plan a 1 tarea.'
      );
    }
    if (!Number.isFinite(Number(lite.maxTokens)) || Number(lite.maxTokens) < 200) {
      throw new Error(`[swarm] config.gateway.maxTokens debe ser un número >= 200 (actual: ${lite.maxTokens}).`);
    }
    this.client = new LLMGatewayClient({
      baseUrl: lite.baseUrl,
      apiKey: config.gateway.apiKey,
      timeoutMs: lite.timeoutMs,
    });
    this._seedSkills();
    logger.info('SwarmService initialized (planning hivemind ready)');
  }

  // ───────────────────────────── semilla ─────────────────────────────
  _seedSkills() {
    const existing = this.db.prepare('SELECT name FROM swarm_skills WHERE source = ?').all('known');
    const have = new Set(existing.map((r) => r.name));
    const ins = this.db.prepare(
      'INSERT INTO swarm_skills (id, name, domain, description, source) VALUES (?, ?, ?, ?, ?)'
    );
    for (const s of this.config.seed_skills || []) {
      if (!have.has(s.name)) {
        ins.run(generateId('skl'), s.name, s.domain || 'general', s.description || '', 'known');
      }
    }
  }

  _knownSkills() {
    return this.db
      .prepare("SELECT name FROM swarm_skills WHERE source = 'known' ORDER BY name")
      .all()
      .map((r) => r.name);
  }

  _knownAgents() {
    try {
      return this.db.prepare('SELECT name, capabilities FROM agents').all().map((a) => ({
        name: a.name,
        capabilities: a.capabilities ? JSON.parse(a.capabilities) : [],
      }));
    } catch (_) {
      return [];
    }
  }

  // ─────────────────────── deliberación colaborativa ───────────────────────
  /**
   * Recolecta una ronda de deliberación para enriquecer la descomposición del
   * plan. Cada miembro recibe un ANGULO distinto (PLANNING_LENSES), de modo que
   * sumar modelos amplía la cobertura en vez de duplicarla. Cuesta una llamada
   * por deliberador; el último agente no delibera: sintetiza.
   */
  async _deliberate(objective, description, knownSkills, agents) {
    // Deliberan TODOS los planning_agents menos el ultimo, que sintetiza.
    // Antes habia un slice(0, 3) fijo: sumar modelos no ampliaba nada y los que
    // caian entre la posicion 3 y la ultima quedaban ignorados en silencio.
    const all = this.config.planning_agents || [];
    const planners = all.length > 1 ? all.slice(0, -1) : all;

    const prompts = planners.map((pa, i) => {
      const lens = PLANNING_LENSES[i % PLANNING_LENSES.length];
      return {
        model: pa.model,
        name: pa.name,
        role: pa.role,
        lens: lens.name,
        messages: [
          {
            role: 'system',
            content: [
              'Eres parte de una MENTE COLMENA planificadora. No vas a ejecutar nada:',
              'solo DISEÑAS y ORGANIZAS. Otros miembros cubren otros angulos del mismo',
              'objetivo, asi que NO intentes ser exhaustivo: aporta profundidad en el tuyo.',
              '',
              `TU ANGULO ASIGNADO — ${lens.name.toUpperCase()}: ${lens.brief}`,
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `OBJETIVO PRINCIPAL: "${objective}".`,
              description ? `CONTEXTO: ${description}\n` : '',
              `SKILLS/AGENTES DISPONIBLES: ${JSON.stringify({ skills: knownSkills, agents })}\n`,
              `Aporta EXCLUSIVAMENTE desde tu angulo (${lens.name}): ${lens.ask}`,
              'SÉ CONCRETO y especifico del dominio. Máx 200 palabras. Sin preambulos.',
            ].join('\n'),
          },
        ],
        max_tokens: this.config.gateway.maxTokens,
        temperature: this.config.gateway.temperature,
      };
    });

    const results = [];
    // T2: retiene cada aporte individual (model, role, content) para persistirlo.
    const contributions = [];
    for (const pr of prompts) {
      try {
        const { text, reasoning } = await this.client.chat({
          model: pr.model,
          messages: pr.messages,
          max_tokens: pr.max_tokens,
          temperature: pr.temperature,
        });
        // `reasoning` NUNCA se usa como aporte: es el borrador interno del modelo.
        if (text && text.trim()) {
          const content = text.trim();
          results.push(`[${pr.name} — angulo: ${pr.lens}] ${content}`);
          contributions.push({ model: pr.model, role: pr.lens, content });
          logger.info({ model: pr.model, lens: pr.lens }, 'Swarm deliberation contribution collected');
        } else {
          logger.warn(
            { model: pr.model, lens: pr.lens, reasoningChars: (reasoning || '').length },
            'Swarm deliberation: model produced no answer (only reasoning?); angulo sin cubrir'
          );
        }
      } catch (err) {
        logger.warn({ model: pr.model, lens: pr.lens, err: err.message }, 'Swarm deliberation skip');
      }
    }
    // Retorna el texto consolidado (para la sintesis) + aportes crudos (para DB)
    // + cuantos angulos se esperaban, para poder reportar deliberacion degradada.
    return { text: results.join('\n\n'), contributions, expected: prompts.length };
  }

  /**
   * Un solo modelo "sintetizador" convierte objetivo + aportes en un plan
   * maestro estructurado (JSON) con tareas, skills y criterios de aceptación.
   */
  async _synthesizePlan(objective, description, contributors) {
    const synth = (this.config.planning_agents || []).slice(-1)[0] || { model: null, name: 'chair', role: 'moderator' };
    const skillsStr = this._knownSkills().join(', ');

    const messages = [
      {
        role: 'system',
        content: [
          'Eres el SINTETIZADOR de una mente colmena. NO ejecutas: produces el PLAN MAESTRO final.',
          'Responde SOLO con JSON válido, sin markdown, con este esquema EXACTO.',
          'IMPORTANTE: emite "disputes" ANTES que "tasks". Si tu respuesta se corta,',
          'las objeciones deben haberse emitido ya.',
          JSON.stringify({
            disputes: [
              {
                claim: 'la objecion, en las palabras del angulo que la planteo',
                raised_by: 'angulo que objeto (descomposicion|dependencias|riesgos|capacidades|restricciones|validacion)',
                target: 'titulo de la tarea o propuesta que se objeta',
                severity: 'low | normal | high | critical',
                resolution: 'open | accepted | dismissed',
                rationale: 'si es dismissed: OBLIGATORIO, y debe CITAR TEXTUALMENTE una frase del claim',
              },
            ],
            summary: 'resumen del plan (1 frase)',
            tasks: [
              {
                title: 'título corto',
                description: 'qué hay que hacer',
                deliverable: 'entregable concreto que debe producir la LLM ejecutora',
                accept_criteria: ['criterio1', 'criterio2'],
                dependencies: ['título de otra tarea que debe ir antes'],
                capabilities: ['skill requerido'],
                suggested_model: 'modelo sugerido (opcional)',
              },
            ],
            missing_skills: ['habilidades necesarias pero NO disponibles'],
            risks: 'breve lista de riesgos del objetivo',
          }, null, 2),
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `OBJETIVO: "${objective}"`,
          description ? `CONTEXTO: ${description}` : '',
          `SKILLS CONOCIDOS: ${skillsStr}`,
          '',
          'APORTES DE LA MENTE COLMENA (úsalos para enriquecer, no repetir):',
          contributors ? contributors : '(ninguno)',
          '',
          'Genera de 2 a 8 tareas. Las dependencias deben referirse por su "title".',
          'Sugiere un modelo de los disponibles SOLO si es claramente idóneo.',
          '',
          'DISPUTES: revisa los aportes y extrae TODA objecion en la que un angulo',
          'contradiga, invalide o marque como inviable lo que otro propone. No las',
          'promedies ni las resuelvas silenciosamente: cada una va en "disputes".',
          'Si de verdad no hubo ninguna objecion, emite "disputes": [] de forma',
          'EXPLICITA. Omitir el campo NO es lo mismo que no haber objeciones.',
        ].join('\n'),
      },
    ];

    const { text } = await this.client.chat({
      model: synth.model,
      messages,
      max_tokens: this.config.gateway.synthMaxTokens || Math.max(1500, this.config.gateway.maxTokens),
      temperature: 0.3,
    });

    return this._parsePlanJson(text || '', synth.model);
  }

  /**
   * FEAT-011 — Envoltorio fail-closed sobre el parseo del plan.
   *
   * Regla central: ausencia de evidencia NO es evidencia de ausencia. Si el
   * sintetizador no emitio `disputes`, no podemos concluir que no hubo objeciones:
   * pudo truncarse o degradar a un fallback. En ese caso el plan se marca
   * `degraded` para que la perdida sea ruidosa en vez de silenciosa.
   *
   * Solo un `disputes: []` EXPLICITO cuenta como "no hubo disenso". Como ninguna
   * de las cuatro capas de fallback puede emitir el campo, todas quedan marcadas
   * automaticamente al pasar por aqui.
   */
  _parsePlanJson(raw, model) {
    const plan = this._parsePlanJsonInner(raw, model) || { tasks: [] };
    const hadField = Array.isArray(plan.disputes);

    if (!hadField) {
      logger.warn({ model }, 'FEAT-011: el plan llego sin `disputes`; se marca degraded (posible perdida de disenso)');
    }

    plan.disputes = this._validateDisputes(hadField ? plan.disputes : [], raw);
    plan.degraded = !hadField;
    return plan;
  }

  /**
   * Valida las disputas SIN llamar a ningun modelo. Un `dismissed` solo se acepta
   * si su `rationale` cita textualmente el claim que descarta; de lo contrario
   * bastaba un "fuera de alcance" generico para enterrar una objecion y pasar
   * igual todos los criterios. Si no cita, la disputa vuelve a `open`.
   */
  _validateDisputes(disputes, rawContext = '') {
    if (!Array.isArray(disputes)) return [];
    const VALID_RES = ['open', 'accepted', 'dismissed'];
    const VALID_SEV = ['low', 'normal', 'high', 'critical'];

    return disputes
      .filter((d) => d && typeof d.claim === 'string' && d.claim.trim())
      .map((d) => {
        const claim = String(d.claim).trim();
        let resolution = VALID_RES.includes(d.resolution) ? d.resolution : 'open';
        const severity = VALID_SEV.includes(d.severity) ? d.severity : 'normal';
        const rationale = typeof d.rationale === 'string' ? d.rationale.trim() : '';

        if (resolution === 'dismissed' && !this._rationaleCitesClaim(rationale, claim)) {
          logger.warn({ claim: claim.slice(0, 80) }, 'FEAT-011: dismissed sin cita literal del claim; degradado a open');
          resolution = 'open';
        }

        return {
          claim,
          raised_by: typeof d.raised_by === 'string' ? d.raised_by.trim() : null,
          target: typeof d.target === 'string' ? d.target.trim() : null,
          severity,
          resolution,
          rationale: rationale || null,
        };
      });
  }

  /**
   * El rationale debe contener una secuencia literal de >= MIN_RUN palabras del
   * claim. Comparacion de texto normalizado, no regex sobre input del modelo.
   */
  _rationaleCitesClaim(rationale, claim, minRun = 8) {
    if (!rationale || !claim) return false;
    const norm = (s) => s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const hay = norm(rationale);
    const words = norm(claim).split(' ').filter(Boolean);
    if (words.length < minRun) return hay.includes(words.join(' ')) && words.length > 0;
    for (let i = 0; i + minRun <= words.length; i++) {
      if (hay.includes(words.slice(i, i + minRun).join(' '))) return true;
    }
    return false;
  }

  /**
   * FEAT-011 — Persiste el disenso del plan. `target` llega como titulo de tarea;
   * se resuelve a un id real cuando coincide, para que materialize pueda marcar el
   * ticket concreto sin reparsear el plan.
   */
  /**
   * Skills exigidos por un plan, resueltos contra el catalogo. Responde las dos
   * preguntas que antes exigian recorrer blobs JSON: que skills necesita este
   * plan, y que tareas dependen de cada uno.
   */
  planSkills(planId) {
    if (!planId) throw new Error('plan_id es requerido');
    const rows = this.db.prepare(`
      SELECT s.id, s.name, s.domain, s.source, t.id AS task_id, t.title AS task_title
      FROM swarm_task_skills ts
      JOIN swarm_skills s ON s.id = ts.skill_id
      JOIN swarm_tasks  t ON t.id = ts.task_id
      WHERE t.plan_id = ?
      ORDER BY s.source, s.name`).all(planId);

    const bySkill = new Map();
    for (const r of rows) {
      if (!bySkill.has(r.id)) {
        bySkill.set(r.id, { skill: r.name, domain: r.domain, source: r.source, required_by: [] });
      }
      bySkill.get(r.id).required_by.push({ task_id: r.task_id, title: r.task_title });
    }
    const skills = [...bySkill.values()];
    const missing = skills.filter((s) => s.source === 'proposed');
    return {
      plan_id: planId,
      total: skills.length,
      missing: missing.length,
      skills,
      message: missing.length
        ? `${missing.length} skill(s) exigidos por el plan NO estan en el catalogo conocido: ${missing.map((m) => m.skill).join(', ')}.`
        : 'Todas las capacidades exigidas por el plan existen en el catalogo.',
    };
  }

  /** FEAT-011 — Todas las disputas de un plan, con el resumen del disenso abierto. */
  listDisputes(planId) {
    if (!planId) throw new Error('plan_id es requerido');
    const plan = this.db.prepare('SELECT id FROM swarm_plans WHERE id = ?').get(planId);
    if (!plan) throw new Error(`Plan no encontrado: ${planId}`);
    const disputes = this.db
      .prepare('SELECT * FROM swarm_disputes WHERE plan_id = ? ORDER BY created_at')
      .all(planId);
    return { plan_id: planId, summary: this._disputeSummary(planId), disputes };
  }

  /**
   * FEAT-011 — Resolucion humana de una disputa. La validacion es la MISMA que
   * se aplica a la salida del sintetizador: un dismissed sin cita literal del
   * claim vuelve a open, para que nadie entierre una objecion con una frase hecha.
   */
  resolveDispute({ plan_id, dispute_id, resolution, rationale }) {
    if (!plan_id || !dispute_id) throw new Error('plan_id y dispute_id son requeridos');
    const row = this.db
      .prepare('SELECT * FROM swarm_disputes WHERE id = ? AND plan_id = ?')
      .get(dispute_id, plan_id);
    if (!row) throw new Error(`Disputa no encontrada: ${dispute_id}`);

    const [validated] = this._validateDisputes([
      { claim: row.claim, raised_by: row.raised_by, target: row.target, severity: row.severity, resolution, rationale },
    ]);
    if (!validated) throw new Error('Disputa invalida');

    const downgraded = resolution === 'dismissed' && validated.resolution === 'open';
    this.db.prepare(
      "UPDATE swarm_disputes SET resolution = ?, rationale = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(validated.resolution, validated.rationale, dispute_id);

    return {
      dispute_id,
      resolution: validated.resolution,
      downgraded,
      message: downgraded
        ? 'El rationale no cita textualmente el claim, asi que la disputa sigue ABIERTA. Cita una frase de la objecion para descartarla.'
        : `Disputa marcada como ${validated.resolution}.`,
      summary: this._disputeSummary(plan_id),
    };
  }

  /**
   * Resuelve las capabilities de una tarea contra el catalogo de skills y deja
   * la relacion escrita en swarm_task_skills.
   *
   * Una capability que no existe se CATALOGA como 'proposed' en vez de ignorarse:
   * antes el texto quedaba dentro del blob JSON de la tarea y nadie se enteraba de
   * que exigia un skill inexistente. Se devuelven los nombres recien propuestos
   * para poder reportarlos.
   */
  _linkTaskSkills(taskId, capabilities) {
    const proposed = [];
    if (!Array.isArray(capabilities)) return proposed;

    const findSkill = this.db.prepare('SELECT id FROM swarm_skills WHERE name = ?');
    const insSkill = this.db.prepare(
      "INSERT INTO swarm_skills (id, name, domain, description, source) VALUES (?, ?, 'general', ?, 'proposed')"
    );
    const link = this.db.prepare(
      'INSERT OR IGNORE INTO swarm_task_skills (task_id, skill_id) VALUES (?, ?)'
    );

    for (const raw of capabilities) {
      const name = String(raw || '').trim();
      if (!name) continue;
      let skill = findSkill.get(name);
      if (!skill) {
        const id = generateId('skl');
        insSkill.run(id, name, 'Exigido por una tarea del plan y ausente del catalogo');
        skill = { id };
        proposed.push(name);
      }
      link.run(taskId, skill.id);
    }
    return proposed;
  }

  _persistDisputes(planId, disputes) {
    if (!Array.isArray(disputes) || !disputes.length) return 0;
    const ins = this.db.prepare(
      `INSERT INTO swarm_disputes (id, plan_id, claim, raised_by, target, target_task, severity, resolution, rationale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let n = 0;
    for (const d of disputes) {
      const match = d.target
        ? this.db.prepare('SELECT id FROM swarm_tasks WHERE plan_id = ? AND title = ?').get(planId, d.target)
        : null;
      ins.run(
        generateId('dsp'), planId, d.claim, d.raised_by || null, d.target || null,
        match ? match.id : null, d.severity || 'normal', d.resolution || 'open', d.rationale || null
      );
      n += 1;
    }
    return n;
  }

  /** Resumen del disenso de un plan, para respuestas de tools y CHECKPOINT. */
  _disputeSummary(planId, topN = 5) {
    const rows = this.db.prepare(
      `SELECT id, claim, raised_by, target, severity, resolution, rationale
       FROM swarm_disputes WHERE plan_id = ?
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                created_at`
    ).all(planId);
    const open = rows.filter((r) => r.resolution === 'open');
    return {
      total: rows.length,
      open: open.length,
      blocking: open.filter((r) => r.severity === 'critical').length,
      // El humano necesita LEER la objecion, no contarla: se devuelve el texto.
      top: open.slice(0, topN).map((r) => ({ id: r.id, claim: r.claim, raised_by: r.raised_by, target: r.target, severity: r.severity })),
      more: Math.max(0, open.length - topN),
    };
  }

  _parsePlanJsonInner(raw, model) {
    let cleaned = raw.trim();
    // Quitar fences de markdown si los hay
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    // Si el texto parece "JSON escapado" (nemotron a veces emite con \\\" y \\n),
    // desescapar un nivel para recuperar el JSON plano real.
    if (/\\\\"/.test(cleaned) || /\\n/.test(cleaned)) {
      const unescaped = cleaned.replace(/\\\\"/g, '"').replace(/\\\\n/g, '\n').replace(/\\\\t/g, '\t');
      if (unescaped !== cleaned) {
        try { JSON.parse(unescaped); cleaned = unescaped; } catch { /* si igualmente esta roto, seguimos con el limpio */ }
      }
    }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end >= start) cleaned = cleaned.slice(start, end + 1);
    let parsed;
    // Nivel externo TOLERANTE: los LLM suelen emitir saltos de línea reales en
    // `summary` (que contiene JSON anidado). `_safeParseObject` lo recupera.
    parsed = this._safeParseObject(cleaned);
    if (!parsed) {
      // Backstop: si el JSON está demasiado corrupto para parsear, reconstruye
      // las tareas por bloques (regex tolerante) sobre el texto crudo del modelo.
      logger.warn({ model }, 'Swarm synthesizer JSON corrupto; intentando extracción tolerante por tarea');
      const extracted = this._extractTasksTolerant(raw);
      if (extracted && extracted.tasks && extracted.tasks.length) return extracted;
      logger.error({ model }, 'Swarm synthesizer returned non-JSON; falling back to single task');
      return this._fallbackPlan(raw, model);
    }

    // NORMALIZACIÓN: algunos modelos anidan el plan completo dentro de `summary`
    // como un string JSON (o como un objeto). Desanida a nivel raíz si hace falta.
    parsed = this._normalizePlan(parsed, model);

    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      // Backstop: el nivel externo sí parseó pero no logró desanidar tareas.
      // El contenido rico suele estar DENTRO de `summary` (string JSON anidado) o
      // como sub-objeto. Antes de degradar a extraction sobre el RAW externo,
      // damos prioridad al contenido del `summary` interno, y solo después al raw.
      const innerSources = [];
      const sum = parsed && parsed.summary;
      if (typeof sum === 'string' && sum.trim()) innerSources.push(sum);
      if (
        parsed &&
        parsed.summary &&
        typeof parsed.summary === 'object' &&
        parsed.summary.summary &&
        typeof parsed.summary.summary === 'string'
      ) {
        innerSources.push(parsed.summary.summary);
      }
      let extracted = null;
      for (const src of innerSources) {
        const attempt = this._extractTasksTolerant(src);
        if (attempt && attempt.tasks && attempt.tasks.length) {
          extracted = attempt;
          logger.info({ model, srcLen: src.length }, 'Swarm: tareas recuperadas desde summary interno');
          break;
        }
      }
      if (!extracted) {
        logger.warn({ model }, 'Swarm synthesizer plan had no parseable tasks; trying tolerant extraction on raw');
        extracted = this._extractTasksTolerant(raw);
      }
      if (extracted && extracted.tasks && extracted.tasks.length) {
        return {
          ...extracted,
          summary: extracted.summary || '',
          missing_skills: extracted.missing_skills || [],
          risks: extracted.risks || '',
        };
      }
      logger.warn({ model }, 'Swarm synthesizer plan had no parseable tasks; falling back to single task');
      return this._fallbackPlan('', model, this._cleanSummary(parsed));
    }
    return parsed;
  }

  // Extrae un resumen legible a partir de un plan (posiblemente anidado), evitando
  // persistir el JSON crudo como `summary`.
  _cleanSummary(parsed) {
    if (!parsed) return '';
    // Caso: summary es un string JSON anidado -> extrae su propio campo "summary".
    if (typeof parsed.summary === 'string') {
      const s = parsed.summary.trim();
      if (s) {
        if (s.startsWith('{')) {
          const inner = this._safeParseObject(s);
          if (inner && typeof inner.summary === 'string') return inner.summary;
        }
        // Si empieza como texto plano, usar lo primero coherente (p.ej. 200 chars).
        return s.replace(/[\r\n\\]+/g, ' ').slice(0, 200);
      }
    }
    // Caso: summary es un objeto con campo summary.
    if (parsed.summary && typeof parsed.summary === 'object') {
      const inner = parsed.summary;
      if (typeof inner.summary === 'string') return inner.summary;
      if (Array.isArray(inner.tasks) && inner.tasks[0] && inner.tasks[0].title) {
        return `Plan de ${inner.tasks.length} tareas: ${inner.tasks[0].title}${inner.tasks.length > 1 ? ', …' : ''}`;
      }
    }
    return '';
  }

  _normalizePlan(parsed, model) {
    const candidate = parsed && typeof parsed === 'object' ? parsed : {};
    let found = candidate;

    // Caso 1: summary es un string JSON que contiene el plan real.
    if (typeof candidate.summary === 'string' && candidate.summary.trim().startsWith('{')) {
      const inner = this._safeParseObject(candidate.summary);
      if (inner && Array.isArray(inner.tasks) && inner.tasks.length > 0) {
        found = { ...inner, _outer: candidate };
        // Clean summary para no persistir el JSON anidado crudo.
        if (typeof found.summary === 'string' && found.summary.trim().startsWith('{')) {
          const clean = this._cleanSummary(inner);
          if (clean) found = { ...found, summary: clean };
        } else if (!found.summary) {
          found = { ...found, summary: inner.summary || '' };
        }
        logger.info({ model }, 'Swarm plan package normalized (plan nested in summary)');
      }
    }

    // Caso 2: summary es un objeto JSON con tasks.
    if (Array.isArray(found.tasks)) {
      // Aspira summary anidado a texto limpio.
      if (found.summary && typeof found.summary !== 'string') {
        const clean = this._cleanSummary(found);
        if (clean) found = { ...found, summary: clean };
      }
      return found;
    }

    if (candidate.summary && typeof candidate.summary === 'object' &&
        Array.isArray(candidate.summary.tasks)) {
      found = { ...candidate.summary, _outer: candidate };
      const clean = this._cleanSummary(found);
      if (clean) found = { ...found, summary: clean };
      logger.info({ model }, 'Swarm plan package normalized (plan nested as summary object)');
    }
    return found;
  }

  /**
   * Extracción tolerante de tareas por bloques cuando el JSON del modelo está
   * demasiado corrupto para `JSON.parse` (comillas sin escapar, campos partidos).
   * Recorre el texto y captura objetos {title, description, deliverable, ...}.
   */
  _extractTasksTolerant(raw) {
    if (!raw) return null;
    const src = raw.replace(/```(?:json)?/gi, '');
    const tasks = [];
    // Patrón: un bloque de tarea con "title" presente, tolerando campos previos
    // (p.ej. {"id":..., "title": ...}) y saltos de línea entre `{` y `"title"`.
    const blockRe = /\{\s*"?(?:id|title|name|tarea|task|titulo)"?\s*:\s*[^,}]*?,?\s*"title"\s*:\s*"([^"]*?)"([\s\S]*?)(?=\{"?(?:id|title|name|tarea|task|titulo)"?\s*:|$)/gi;
    let m;
    while ((m = blockRe.exec(src)) !== null) {
      const title = m[1].trim() || 'Tarea sin título';
      const body = m[2] || '';
      const grab = (re) => { const mm = re.exec(body); return mm ? mm[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim() : ''; };
      const grabArr = (re) => {
        const mm = re.exec(body);
        if (!mm) return [];
        return mm[1].split(',').map((s) => s.replace(/\\"/g, '').replace(/[\[\]"]/g, '').trim()).filter(Boolean);
      };
      tasks.push({
        title,
        description: grab(/"description"\s*:\s*"([^"]*?)"/i) || '',
        deliverable: grab(/"deliverable"\s*:\s*"([^"]*?)"/i) || '',
        accept_criteria: grabArr(/"accept_criteria"\s*:\s*\[([\s\S]*?)\]/i),
        dependencies: grabArr(/"dependencies"\s*:\s*\[([\s\S]*?)\]/i),
        capabilities: grabArr(/"capabilities"\s*:\s*\[([\s\S]*?)\]/i),
        suggested_model: grab(/"suggested_model"\s*:\s*"([^"]*?)"/i) || null,
      });
    }
    if (!tasks.length) return null;
    const riskM = /"risks"\s*:\s*"([^"]*?)"/i.exec(src);
    const missM = src.match(/"missing_skills"\s*:\s*\[([\s\S]*?)\]/i);
    const missing = missM
      ? missM[1].split(',').map((s) => s.replace(/[\[\]"\\']/g, '').trim()).filter(Boolean)
      : [];
    return {
      summary: raw.slice(0, 200),
      tasks,
      missing_skills: missing,
      risks: riskM ? riskM[1] : '',
      _from_tolerant_backstop: true,
    };
  }

  /**
   * `JSON.parse` tolerante: algunos modelos emiten saltos de línea REALES
   * (caracteres de control sin escapar) dentro de las cadenas de un JSON
   * anidado, lo que rompe el parser estricto. Este método sanitiza
   * caracteres de control *reales* (no la secuencia \\n) dentro de strings.
   */
  _safeParseObject(text) {
    if (typeof text !== 'string') return null;
    let t = text;
    // Intento estricto primero.
    try { return JSON.parse(t); } catch (_) { /* continua */ }
    // Sanitiza saltos de línea reales que no formen parte de la secuencia \\n.
    const sanitized = t
      // Colapsa CR.
      .replace(/\r/g, ' ')
      // Reemplaza saltos de línea reales por el escape \\n (si no ya es \\n).
      .replace(/\\?(?:\r\n|\r|\n)/g, (m) => { const _x = m; return m[0] === '\\' ? m : '\\n'; });
    try { return JSON.parse(sanitized); } catch (_) { return null; }
  }

  _fallbackPlan(raw, model, preSummary) {
    return {
      summary: (typeof preSummary === 'string' && preSummary.trim()) ? preSummary : raw.slice(0, 300),
      tasks: [
        {
          title: 'Ejecutar objetivo',
          description: 'Desarrollar el objetivo según el plan solicitado.',
          deliverable: 'Resultado final del objetivo solicitado.',
          accept_criteria: ['resultado coherente y completo'],
          dependencies: [],
          capabilities: [],
          suggested_model: model || null,
        },
      ],
      missing_skills: [],
      risks: 'Fallo de estructuración automática; revisar manualmente.',
      _fallback: true,
    };
  }

  // ────────────────────────────── API pública ──────────────────────────────
  /**
   * Crea un plan maestro a partir de un objetivo. Corre deliberación
   * colaborativa (controlada) + síntesis, y persiste el entregable accionable.
   */
  async createPlan({ objective, description = '', source = 'manual', parent_plan = null }) {
    if (!objective || !objective.trim()) throw new Error('objective is required');
    const planId = generateId('pln');

    const agents = this._knownAgents();
    // T2: _deliberate ahora devuelve { text, contributions }; `text` alimenta la
    // síntesis y `contributions` se persistirá después (retuvo cada aporte crudo).
    const deliberation = await this._deliberate(objective.trim(), description.trim(), this._knownSkills(), agents);
    const contributors = deliberation.text;
    const plan = await this._synthesizePlan(objective.trim(), description.trim(), contributors);

    const stmtPlan = this.db.prepare(
      `INSERT INTO swarm_plans (id, objective, description, status, source, parent_plan, metadata)
       VALUES (?, ?, ?, 'ready', ?, ?, ?)`
    );
    stmtPlan.run(planId, objective.trim(), description.trim(), source, parent_plan, JSON.stringify({ _synthetic: true }));

    // T2: persiste cada aporte individual de la deliberación (trazabilidad real).
    const stmtContrib = this.db.prepare(
      `INSERT INTO swarm_contributions (id, plan_id, model, role, content) VALUES (?, ?, ?, ?, ?)`
    );
    for (const c of deliberation.contributions || []) {
      if (c && c.model && c.content) {
        stmtContrib.run(generateId('ctb'), planId, c.model, c.role || null, c.content);
      }
    }

    const stmtTask = this.db.prepare(
      `INSERT INTO swarm_tasks
         (id, plan_id, title, description, deliverable, accept_criteria, dependencies, capabilities, suggested_model, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')`
    );
    const taskIds = [];
    for (const t of plan.tasks || []) {
      const taskId = generateId('tsk');
      stmtTask.run(
        taskId,
        planId,
        (t.title || 'Tarea').trim(),
        (t.description || '').trim(),
        (t.deliverable || '').trim(),
        JSON.stringify(Array.isArray(t.accept_criteria) ? t.accept_criteria : []),
        JSON.stringify(Array.isArray(t.dependencies) ? t.dependencies : []),
        JSON.stringify(Array.isArray(t.capabilities) ? t.capabilities : []),
        (t.suggested_model || '').trim() || null
      );
      this._linkTaskSkills(taskId, Array.isArray(t.capabilities) ? t.capabilities : []);
      taskIds.push({ id: taskId, title: t.title || 'Tarea' });
    }

    // Catalogar skills faltantes propuestas.
    const insSkill = this.db.prepare(
      "INSERT INTO swarm_skills (id, name, domain, description, source) VALUES (?, ?, 'proposed', ?, 'proposed')"
    );
    for (const ms of plan.missing_skills || []) {
      if (ms && typeof ms === 'string') {
        const exists = this.db.prepare('SELECT name FROM swarm_skills WHERE name = ?').get(ms);
        if (!exists) insSkill.run(generateId('skl'), ms.trim(), 'Propuesto por mente colmena como skill faltante');
      }
    }

    const meta = {
      summary: plan.summary || objective.trim(),
      tasks: taskIds,
      // Normaliza risks: el extractor tolerante puede devolver un string en vez de array.
      missing_skills: (plan.missing_skills && typeof plan.missing_skills === 'string' ? [plan.missing_skills] : plan.missing_skills) || [],
      risks: typeof plan.risks === 'string' && plan.risks.trim() ? plan.risks.split(',').map((s) => s.trim()).filter(Boolean)
        : (Array.isArray(plan.risks) ? plan.risks : []),
    };
    this.db.prepare('UPDATE swarm_plans SET metadata = ? WHERE id = ?').run(JSON.stringify(meta), planId);

    this._persistDisputes(planId, plan.disputes);

    this.eventBus.emit('swarm:plan_created', { plan_id: planId, objective: objective.trim(), task_count: taskIds.length });
    logger.info({ plan_id: planId, tasks: taskIds.length }, 'Swarm plan created');

    // `contributors` contaba parrafos del texto concatenado (reportaba 13 con 3
    // modelos). Ahora se informa la cobertura real de la deliberacion, y si algun
    // angulo quedo sin cubrir el llamador se entera en vez de recibir un plan
    // degradado sin aviso.
    const got = (deliberation.contributions || []).length;
    const expected = deliberation.expected ?? got;
    const disputes = { ...this._disputeSummary(planId), degraded: !!plan.degraded };
    const warnings = [];
    if (got < expected) warnings.push(`deliberacion degradada (${got}/${expected} angulos)`);
    if (plan.degraded) warnings.push('el sintetizador no emitio `disputes`: puede haberse perdido disenso');
    if (disputes.blocking) warnings.push(`${disputes.blocking} veto(s) critico(s) abierto(s): la materializacion esta bloqueada`);
    return {
      plan_id: planId,
      objective: objective.trim(),
      status: 'ready',
      summary: plan.summary,
      deliberation: {
        contributors: got,
        expected,
        lenses: (deliberation.contributions || []).map((c) => c.role).filter(Boolean),
        degraded: got < expected,
      },
      disputes,
      tasks: taskIds,
      missing_skills: plan.missing_skills || [],
      risks: plan.risks || [],
      message: warnings.length
        ? `ATENCION: ${warnings.join('. ')}.`
        : 'Plan maestro listo para que otras LLM lo ejecuten. Consulta bridge_swarm_tasks para ver las hojas de tarea.',
    };
  }

  /**
   * Crea un plan maestro a partir del transcripto de un DEBATE real (módulo
   * hosted, tool bridge_spawn_conversation). A diferencia de createPlan, NO
   * dispara deliberación paralela: recibe ya la deliberación hecha (el debate
   * secuencial donde los LLM se leen y pueden incluir el aporte de Hermes), la
   * pasa al sintetizador y persiste plan + aportes + hojas.
   *
   * @param {object} o
   * @param {string} o.objective   - objetivo del plan.
   * @param {string} [o.description]
   * @param {string} o.debateTranscript - texto crudo completo del debate (por turno).
   * @param {Array<{model:string, role?:string, content:string}>} [o.contributions]
   *    - aportes por turno, para persistirlos en swarm_contributions (trazabilidad).
   * @param {string} [o.source] = 'debate'
   * @param {string|null} [o.parent_plan]
   */
  async createPlanFromDebate({ objective, description = '', debateTranscript, contributions = [], source = 'debate', parent_plan = null }) {
    if (!objective || !objective.trim()) throw new Error('objective is required');
    if (!debateTranscript || !debateTranscript.trim()) throw new Error('debateTranscript is required');
    const planId = generateId('pln');

    // La deliberación ya ocurrió en el debate; el sintetizador la convierte en plan.
    const plan = await this._synthesizePlan(objective.trim(), description.trim(), debateTranscript.trim());

    this.db.prepare(
      `INSERT INTO swarm_plans (id, objective, description, status, source, parent_plan, metadata)
       VALUES (?, ?, ?, 'ready', ?, ?, ?)`
    ).run(planId, objective.trim(), description.trim(), source, parent_plan, JSON.stringify({ _fromDebate: true }));

    // Persistir los aportes del debate (trazabilidad real).
    const stmtContrib = this.db.prepare(
      `INSERT INTO swarm_contributions (id, plan_id, model, role, content) VALUES (?, ?, ?, ?, ?)`
    );
    for (const c of contributions || []) {
      if (c && c.model && c.content) {
        stmtContrib.run(generateId('ctb'), planId, c.model, c.role || null, c.content);
      }
    }

    const stmtTask = this.db.prepare(
      `INSERT INTO swarm_tasks
        (id, plan_id, title, description, deliverable, accept_criteria, dependencies, capabilities, suggested_model, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')`
    );
    const taskIds = [];
    for (const t of plan.tasks || []) {
      const taskId = generateId('tsk');
      stmtTask.run(
        taskId,
        planId,
        (t.title || 'Tarea').trim(),
        (t.description || '').trim(),
        (t.deliverable || '').trim(),
        JSON.stringify(Array.isArray(t.accept_criteria) ? t.accept_criteria : []),
        JSON.stringify(Array.isArray(t.dependencies) ? t.dependencies : []),
        JSON.stringify(Array.isArray(t.capabilities) ? t.capabilities : []),
        (t.suggested_model || '').trim() || null
      );
      this._linkTaskSkills(taskId, Array.isArray(t.capabilities) ? t.capabilities : []);
      taskIds.push({ id: taskId, title: t.title || 'Tarea' });
    }

    // Catalogar skills faltantes propuestas.
    const insSkill = this.db.prepare(
      "INSERT INTO swarm_skills (id, name, domain, description, source) VALUES (?, ?, 'proposed', ?, 'proposed')"
    );
    for (const ms of plan.missing_skills || []) {
      if (ms && typeof ms === 'string') {
        const exists = this.db.prepare('SELECT name FROM swarm_skills WHERE name = ?').get(ms);
        if (!exists) insSkill.run(generateId('skl'), ms.trim(), 'Propuesto por debate como skill faltante');
      }
    }

    const meta = {
      summary: plan.summary || objective.trim(),
      tasks: taskIds,
      missing_skills: (plan.missing_skills && typeof plan.missing_skills === 'string' ? [plan.missing_skills] : plan.missing_skills) || [],
      risks: typeof plan.risks === 'string' && plan.risks.trim() ? plan.risks.split(',').map((s) => s.trim()).filter(Boolean)
        : (Array.isArray(plan.risks) ? plan.risks : []),
    };
    this.db.prepare('UPDATE swarm_plans SET metadata = ? WHERE id = ?').run(JSON.stringify(meta), planId);

    this._persistDisputes(planId, plan.disputes);

    this.eventBus.emit('swarm:plan_created', { plan_id: planId, objective: objective.trim(), task_count: taskIds.length });
    logger.info({ plan_id: planId, tasks: taskIds.length, source: 'debate' }, 'Swarm plan created from debate');

    return {
      plan_id: planId,
      objective: objective.trim(),
      status: 'ready',
      source: 'debate',
      debate_contributions: contributions.length,
      summary: plan.summary,
      tasks: taskIds,
      missing_skills: plan.missing_skills || [],
      risks: plan.risks || [],
      message: 'Plan maestro creado a partir del debate. Consulta bridge_swarm_tasks para las hojas.',
    };
  }


  /**
   * Automimejora: analiza un plan (idealmente completado) y PROPONE el siguiente
   * plan maestro para mejorar el sistema o el módulo. NO ejecuta.
   */
  async reflectAndImprove({ plan_id }) {
    if (!plan_id) throw new Error('plan_id is required');
    const plan = this.db.prepare('SELECT * FROM swarm_plans WHERE id = ?').get(plan_id);
    if (!plan) throw new Error('plan not found');

    const tasks = this.db.prepare('SELECT * FROM swarm_tasks WHERE plan_id = ?').all(plan_id);

    const objective = `Mejora del sistema AgentBridge / modelo de trabajo, a partir de la retroalimentación del plan "${plan.objective}".`;
    const description = [
      `Plan analizado: ${plan.objective}`,
      `Tareas previstas: ${tasks.length}`,
      `Estados: ${tasks.map((t) => `${t.title}::${t.status}`).join(', ')}`,
      'Propón el siguiente plan de mejora concreta (estructura, skills a potenciar, próximas tareas).',
    ].join('\n');

    const nextPlan = await this.createPlan({ objective, description, source: 'self_improve', parent_plan: plan_id });

    const reflId = generateId('rfl');
    this.db.prepare(
      `INSERT INTO swarm_reflections (id, plan_id, summary, strengths, gaps, next_plan_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      reflId,
      plan_id,
      plan.objective,
      JSON.stringify([`Objetivo: ${plan.objective}`]),
      JSON.stringify(tasks.filter((t) => t.status !== 'done').map((t) => `Pendiente: ${t.title}`)),
      nextPlan.plan_id
    );

    return {
      reflection_id: reflId,
      source_plan: plan_id,
      next_plan: { plan_id: nextPlan.plan_id, objective: nextPlan.objective },
      message: 'Plan de automimejora propuesto. Está listo para ejecutarse por otras LLM; no se ejecutó nada.',
    };
  }

  listPlans() {
    return this.db.prepare('SELECT * FROM swarm_plans ORDER BY created_at DESC').all().map((p) => ({
      ...p,
      metadata: p.metadata ? JSON.parse(p.metadata) : {},
    }));
  }

  planStatus(plan_id) {
    const plan = this.db.prepare('SELECT * FROM swarm_plans WHERE id = ?').get(plan_id);
    if (!plan) throw new Error('plan not found');
    const tasks = this.db.prepare(
      'SELECT id, title, status, deliverable, accept_criteria, dependencies, capabilities, suggested_model, result_ref FROM swarm_tasks WHERE plan_id = ? ORDER BY created_at'
    ).all(plan_id).map((t) => ({
      ...t,
      accept_criteria: t.accept_criteria ? JSON.parse(t.accept_criteria) : [],
      dependencies: t.dependencies ? JSON.parse(t.dependencies) : [],
      capabilities: t.capabilities ? JSON.parse(t.capabilities) : [],
    }));
    return {
      ...plan,
      metadata: plan.metadata ? JSON.parse(plan.metadata) : {},
      tasks,
    };
  }

  listSkills() {
    return this.db.prepare('SELECT * FROM swarm_skills ORDER BY source, domain, name').all();
  }

  listContributions(plan_id) {
    if (!plan_id) throw new Error('plan_id is required');
    return this.db.prepare(
      'SELECT id, model, role, content, created_at FROM swarm_contributions WHERE plan_id = ? ORDER BY created_at'
    ).all(plan_id);
  }

  // Permite a una LLM externa marcar una tarea como ejecutada (es decir, el
  // hub solo REGISTRA el estado; no ejecuta la tarea).
  markTaskDone(task_id, result_ref = null) {
    if (!task_id) throw new Error('task_id is required');
    const res = this.db.prepare(
      "UPDATE swarm_tasks SET status = 'done', result_ref = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(result_ref, task_id);
    if (res.changes === 0) throw new Error('task not found');
    return { success: true, task_id, status: 'done' };
  }
}
