import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeDb, makeBus, addAgent, seedMessage } from './helpers.mjs';
import { MessagingService } from '../src/modules/messaging/messaging.service.js';
import { SessionsService } from '../src/modules/sessions/sessions.service.js';
import { WorkspacesService } from '../src/modules/workspaces/workspaces.service.js';
import { LLMGatewayClient } from '../src/modules/hosted/llm-gateway-client.js';
import { SwarmService } from '../src/modules/swarm/swarm.service.js';
import { MaterializeService } from '../src/modules/materialize/materialize.service.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';

function setup() {
  const db = makeDb();
  const bus = makeBus();
  return {
    db,
    bus,
    sessions: new SessionsService(db, bus),
    messaging: new MessagingService(db, bus, null),
  };
}

describe('messaging.getMessages', () => {
  test('devuelve los mensajes MAS NUEVOS cuando hay mas mensajes que el limite', () => {
    const { db, sessions, messaging } = setup();
    try {
      addAgent(db, 'alice');
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('alice', ses.id);

      for (let i = 1; i <= 10; i++) {
        seedMessage(db, ses.id, 'alice', `msg-${i}`, `2026-01-01 00:00:${String(i).padStart(2, '0')}`);
      }

      const got = messaging.getMessages('alice', 3);

      assert.equal(got.length, 3);
      assert.deepEqual(
        got.map((m) => m.content),
        ['msg-8', 'msg-9', 'msg-10'],
        'un agente que hace polling debe recibir la cola reciente, no el principio de la conversacion'
      );
    } finally {
      db.cleanup();
    }
  });

  test('mantiene orden cronologico ascendente', () => {
    const { db, sessions, messaging } = setup();
    try {
      addAgent(db, 'alice');
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('alice', ses.id);
      for (let i = 1; i <= 5; i++) {
        seedMessage(db, ses.id, 'alice', `msg-${i}`, `2026-01-01 00:00:0${i}`);
      }

      const got = messaging.getMessages('alice', 50);
      const times = got.map((m) => m.created_at);
      assert.deepEqual(times, [...times].sort(), 'los mensajes deben venir del mas viejo al mas nuevo');
    } finally {
      db.cleanup();
    }
  });
});

describe('sessions.resumeSession', () => {
  test('una sesion autopilot pausada por max_turns puede volver a recibir mensajes', () => {
    const { db, sessions, messaging } = setup();
    try {
      addAgent(db, 'alice');
      const ses = sessions.createSession({
        name: 'auto',
        mode: 'autopilot',
        mode_config: { max_turns: 2, cooldown_seconds: 1 },
      });
      sessions.joinSession('alice', ses.id);

      // Simula que la sesion consumio sus turnos y se auto-pauso.
      db.prepare("UPDATE sessions SET turn_count = 2, status = 'paused' WHERE id = ?").run(ses.id);

      sessions.resumeSession(ses.id, 'continue');

      const after = db.prepare('SELECT status, turn_count FROM sessions WHERE id = ?').get(ses.id);
      assert.equal(after.status, 'active');

      // El bug: si turn_count sigue >= max_turns, el primer mensaje vuelve a pausar la sesion
      // y el modo autopilot queda muerto para siempre.
      assert.doesNotThrow(
        () => messaging.sendMessage({ from: 'alice', content: 'sigo trabajando' }),
        'tras reanudar, el agente debe poder enviar al menos un mensaje mas'
      );
    } finally {
      db.cleanup();
    }
  });

  test('free mode avanza al siguiente goal sin tocar turn_count', () => {
    const { db, sessions } = setup();
    try {
      const ses = sessions.createSession({
        name: 'free',
        mode: 'free',
        mode_config: { goals: ['uno', 'dos'] },
      });
      db.prepare("UPDATE sessions SET turn_count = 7, status = 'checkpoint' WHERE id = ?").run(ses.id);

      const res = sessions.resumeSession(ses.id, 'continue');

      assert.equal(res.next_goal, 'dos');
      const after = db.prepare('SELECT turn_count FROM sessions WHERE id = ?').get(ses.id);
      assert.equal(after.turn_count, 7, 'free mode no usa limite de turnos: no debe resetearlos');
    } finally {
      db.cleanup();
    }
  });
});

describe('sessions.completeGoal', () => {
  test('rechaza a un agente que no participa en la sesion', () => {
    const { db, sessions } = setup();
    try {
      addAgent(db, 'alice');
      addAgent(db, 'intruso');
      const ses = sessions.createSession({ name: 'free', mode: 'free', mode_config: { goals: ['uno'] } });
      sessions.joinSession('alice', ses.id);

      assert.throws(
        () => sessions.completeGoal(ses.id, 'intruso'),
        /no participa|not a participant|not in session/i,
        'un agente ajeno no debe poder cerrar el goal de otra sesion'
      );
    } finally {
      db.cleanup();
    }
  });

  test('permite cerrar el goal a un participante', () => {
    const { db, sessions } = setup();
    try {
      addAgent(db, 'alice');
      const ses = sessions.createSession({ name: 'free', mode: 'free', mode_config: { goals: ['uno'] } });
      sessions.joinSession('alice', ses.id);

      const res = sessions.completeGoal(ses.id, 'alice');
      assert.equal(res.completed_goal, 'uno');
      assert.equal(res.status, 'checkpoint');
    } finally {
      db.cleanup();
    }
  });
});

describe('messaging.sendMessage', () => {
  test('asigna seq incremental por sesion', () => {
    const { db, sessions, messaging } = setup();
    try {
      addAgent(db, 'alice');
      addAgent(db, 'bob');
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('alice', ses.id);
      sessions.joinSession('bob', ses.id);

      messaging.sendMessage({ from: 'alice', content: 'primero' });
      messaging.sendMessage({ from: 'bob', content: 'segundo' });

      const rows = db
        .prepare("SELECT seq, content FROM messages WHERE session_id = ? AND from_agent != 'SYSTEM' ORDER BY rowid")
        .all(ses.id);

      for (const r of rows) {
        assert.notEqual(r.seq, null, `el mensaje "${r.content}" quedo sin seq`);
      }
      const seqs = rows.map((r) => r.seq);
      assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'seq debe ser monotonico dentro de la sesion');
      assert.equal(new Set(seqs).size, seqs.length, 'seq no debe repetirse dentro de la sesion');
    } finally {
      db.cleanup();
    }
  });

  test('el cooldown bloquea mensajes consecutivos del mismo agente', () => {
    const { db, sessions, messaging } = setup();
    try {
      addAgent(db, 'alice');
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('alice', ses.id);

      messaging.sendMessage({ from: 'alice', content: 'uno' });
      assert.throws(
        () => messaging.sendMessage({ from: 'alice', content: 'dos' }),
        /cooldown/i,
        'el cooldown universal de 3s debe seguir activo'
      );
    } finally {
      db.cleanup();
    }
  });

  test('respeta el token de turno', () => {
    const { db, sessions, messaging } = setup();
    try {
      addAgent(db, 'alice');
      addAgent(db, 'bob');
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('alice', ses.id);
      sessions.joinSession('bob', ses.id);
      db.prepare("UPDATE sessions SET current_turn = 'alice' WHERE id = ?").run(ses.id);

      assert.throws(
        () => messaging.sendMessage({ from: 'bob', content: 'me cuelo' }),
        /not your turn/i
      );
    } finally {
      db.cleanup();
    }
  });
});

describe('workspaces.getSafePath', () => {
  const svc = () => new WorkspacesService({}, makeBus());

  test('bloquea directory traversal', () => {
    const w = svc();
    assert.throws(() => w.getSafePath('ses_1', '../../etc/passwd'), /Access denied/);
    assert.throws(() => w.getSafePath('ses_1', '..\\..\\secret.txt'), /Access denied/);
  });

  test('bloquea rutas absolutas', () => {
    const w = svc();
    assert.throws(() => w.getSafePath('ses_1', 'C:\\Windows\\System32\\config'), /Access denied/);
  });

  test('bloquea sessionId malicioso', () => {
    const w = svc();
    assert.throws(() => w.getSafePath('../otro', 'a.txt'), /Invalid sessionId/);
  });

  test('permite rutas normales dentro del workspace', () => {
    const w = svc();
    const p = w.getSafePath('ses_1', 'docs/plan.md');
    assert.ok(p.includes('ses_1'));
  });
});

describe('LLMGatewayClient', () => {
  // Puerto cerrado (fuera de la blocklist de fetch): simula el gateway apagado.
  const dead = () => new LLMGatewayClient({ baseUrl: 'http://127.0.0.1:45999', timeoutMs: 3000 });

  test('chat() explica que el gateway no responde en vez de "fetch failed"', async () => {
    await assert.rejects(
      () => dead().chat({ model: 'x', messages: [{ role: 'user', content: 'hola' }] }),
      (err) => {
        assert.match(err.message, /gateway de LLMs no responde/i);
        assert.match(err.message, /127\.0\.0\.1:45999/, 'el error debe nombrar el endpoint que fallo');
        return true;
      }
    );
  });

  test('listModels() explica que el gateway no responde', async () => {
    await assert.rejects(
      () => dead().listModels(),
      (err) => {
        assert.match(err.message, /gateway de LLMs no responde/i);
        return true;
      }
    );
  });
});

describe('swarm._deliberate', () => {
  // Cliente falso: no toca la red, registra que prompt recibio cada modelo.
  function fakeClient(seen) {
    return {
      async chat({ model, messages }) {
        seen.push({ model, system: messages[0].content, user: messages[1].content });
        return { text: `aporte de ${model}`, reasoning: '' };
      },
    };
  }

  function svcWith(agents, seen) {
    const db = makeDb();
    const svc = new SwarmService(db, makeBus());
    svc.config = {
      gateway: { baseUrl: 'http://x', maxTokens: 500, temperature: 0.5, synthMaxTokens: 2000 },
      planning_agents: agents,
      seed_skills: [],
    };
    svc.client = fakeClient(seen);
    return { svc, db };
  }

  const mkAgents = (n) =>
    Array.from({ length: n }, (_, i) => ({ name: `a${i}`, role: 'analyst', model: `modelo-${i}` }));

  test('deliberan todos los agentes menos el sintetizador', async () => {
    const seen = [];
    const { svc, db } = svcWith(mkAgents(6), seen);
    try {
      const r = await svc._deliberate('objetivo', '', [], []);
      assert.equal(seen.length, 5, 'con 6 agentes deben deliberar 5 (el ultimo sintetiza)');
      assert.equal(r.expected, 5);
      assert.deepEqual(
        seen.map((s) => s.model),
        ['modelo-0', 'modelo-1', 'modelo-2', 'modelo-3', 'modelo-4'],
        'ningun agente intermedio debe quedar ignorado'
      );
    } finally {
      db.cleanup();
    }
  });

  test('agregar un modelo agrega un angulo, no un eco', async () => {
    const seen3 = [];
    const a = svcWith(mkAgents(4), seen3);
    const seen4 = [];
    const b = svcWith(mkAgents(5), seen4);
    try {
      await a.svc._deliberate('objetivo', '', [], []);
      await b.svc._deliberate('objetivo', '', [], []);

      const lentes = (seen) => seen.map((s) => s.system.match(/TU ANGULO ASIGNADO — (\w+)/)[1]);
      const l3 = lentes(seen3);
      const l4 = lentes(seen4);

      assert.equal(new Set(l3).size, 3, 'cada deliberador recibe un angulo distinto');
      assert.equal(new Set(l4).size, 4, 'el modelo agregado trae un angulo nuevo');
      assert.ok(l4.length > l3.length, 'sumar un modelo debe sumar cobertura');
    } finally {
      a.db.cleanup();
      b.db.cleanup();
    }
  });

  test('el angulo llega al prompt del modelo, no es decorativo', async () => {
    const seen = [];
    const { svc, db } = svcWith(mkAgents(4), seen);
    try {
      await svc._deliberate('objetivo', '', [], []);
      for (const s of seen) {
        assert.match(s.system, /TU ANGULO ASIGNADO/, 'el system prompt debe declarar el angulo');
      }
      const systems = new Set(seen.map((s) => s.system));
      assert.equal(systems.size, seen.length, 'ningun par de deliberadores puede recibir el mismo prompt');
    } finally {
      db.cleanup();
    }
  });

  test('un modelo que solo razona no contamina la deliberacion', async () => {
    const { svc, db } = svcWith(mkAgents(3), []);
    svc.client = {
      async chat({ model }) {
        if (model === 'modelo-1') return { text: '', reasoning: 'The user wants me to...' };
        return { text: `aporte de ${model}`, reasoning: '' };
      },
    };
    try {
      const r = await svc._deliberate('objetivo', '', [], []);
      assert.equal(r.contributions.length, 1, 'el turno sin respuesta no debe contar como aporte');
      assert.equal(r.expected, 2, 'pero si debe reportarse como angulo esperado');
      assert.ok(!/The user wants/.test(r.text), 'el razonamiento crudo nunca entra al texto consolidado');
    } finally {
      db.cleanup();
    }
  });
});

describe('FEAT-011 disenso preservado', () => {
  function swarmSvc() {
    const db = makeDb();
    const svc = new SwarmService(db, makeBus());
    svc.config = { gateway: { baseUrl: 'http://x', maxTokens: 500, synthMaxTokens: 2000, temperature: 0.5 }, planning_agents: [], seed_skills: [] };
    return { svc, db };
  }

  const CLAIM = 'Las pantallas de estado con datos de pacientes violan el RGPD por exposicion publica de informacion clinica';

  describe('fail-closed: ausencia de evidencia no es evidencia de ausencia', () => {
    test('un plan SIN el campo disputes se marca degraded', () => {
      const { svc, db } = swarmSvc();
      try {
        const plan = svc._parsePlanJson(JSON.stringify({ summary: 's', tasks: [{ title: 'T1' }] }), 'm');
        assert.equal(plan.degraded, true, 'campo ausente no puede pasar como "no hubo objeciones"');
        assert.deepEqual(plan.disputes, []);
      } finally { db.cleanup(); }
    });

    test('un plan con disputes:[] EXPLICITO no se marca degraded', () => {
      const { svc, db } = swarmSvc();
      try {
        const plan = svc._parsePlanJson(JSON.stringify({ disputes: [], summary: 's', tasks: [{ title: 'T1' }] }), 'm');
        assert.equal(plan.degraded, false, 'afirmar ausencia de disenso es distinto de omitirlo');
      } finally { db.cleanup(); }
    });

    test('las capas de fallback tambien emiten el campo y marcan degraded', () => {
      const { svc, db } = swarmSvc();
      try {
        for (const raw of ['esto no es JSON en absoluto', '{"tasks": [', '']) {
          const plan = svc._parsePlanJson(raw, 'm');
          assert.ok(Array.isArray(plan.disputes), `fallback sin disputes[] para: ${raw.slice(0, 20)}`);
          assert.equal(plan.degraded, true, `fallback sin marca degraded para: ${raw.slice(0, 20)}`);
        }
      } finally { db.cleanup(); }
    });
  });

  describe('validador determinista (sin LLM)', () => {
    test('un rationale de relleno NO alcanza para descartar: vuelve a open', () => {
      const { svc, db } = swarmSvc();
      try {
        const [d] = svc._validateDisputes([
          { claim: CLAIM, resolution: 'dismissed', rationale: 'Fuera de alcance.', severity: 'critical' },
        ]);
        assert.equal(d.resolution, 'open', 'una frase hecha no puede enterrar una objecion');
      } finally { db.cleanup(); }
    });

    test('un rationale que CITA el claim si permite descartarlo', () => {
      const { svc, db } = swarmSvc();
      try {
        const [d] = svc._validateDisputes([
          {
            claim: CLAIM,
            resolution: 'dismissed',
            severity: 'critical',
            rationale: 'Se descarta: "con datos de pacientes violan el RGPD por exposicion publica" no aplica porque el panel sera anonimo.',
          },
        ]);
        assert.equal(d.resolution, 'dismissed');
      } finally { db.cleanup(); }
    });

    test('la cita funciona con acentos y puntuacion distintos', () => {
      const { svc, db } = swarmSvc();
      try {
        const [d] = svc._validateDisputes([
          {
            claim: 'Las pantallas con datos de pacientes violan el RGPD por exposición pública',
            resolution: 'dismissed',
            rationale: 'Sobre "pantallas con datos de pacientes violan el RGPD por exposicion publica": el panel es anonimo.',
          },
        ]);
        assert.equal(d.resolution, 'dismissed', 'la normalizacion debe ignorar acentos y signos');
      } finally { db.cleanup(); }
    });

    test('severity y resolution invalidas caen a valores seguros', () => {
      const { svc, db } = swarmSvc();
      try {
        const [d] = svc._validateDisputes([{ claim: CLAIM, resolution: 'inventada', severity: 'altisima' }]);
        assert.equal(d.resolution, 'open');
        assert.equal(d.severity, 'normal');
      } finally { db.cleanup(); }
    });

    test('descarta entradas sin claim', () => {
      const { svc, db } = swarmSvc();
      try {
        assert.equal(svc._validateDisputes([{ claim: '   ' }, { target: 'T1' }, null]).length, 0);
      } finally { db.cleanup(); }
    });
  });

  describe('persistencia y resolucion humana', () => {
    function planWithDispute(severity = 'critical') {
      const { svc, db } = swarmSvc();
      db.prepare("INSERT INTO swarm_plans (id, objective) VALUES ('pln_t', 'obj')").run();
      db.prepare("INSERT INTO swarm_tasks (id, plan_id, title) VALUES ('tsk_t', 'pln_t', 'Panel de estado')").run();
      svc._persistDisputes('pln_t', svc._validateDisputes([
        { claim: CLAIM, raised_by: 'restricciones', target: 'Panel de estado', severity, resolution: 'open' },
      ]));
      return { svc, db };
    }

    test('la disputa se liga al ticket concreto por titulo', () => {
      const { svc, db } = planWithDispute();
      try {
        const row = db.prepare('SELECT * FROM swarm_disputes WHERE plan_id = ?').get('pln_t');
        assert.equal(row.target_task, 'tsk_t', 'materialize necesita el id, no solo el titulo');
        assert.equal(row.resolution, 'open');
      } finally { db.cleanup(); }
    });

    test('el resumen devuelve el TEXTO del claim, no solo un conteo', () => {
      const { svc, db } = planWithDispute();
      try {
        const s = svc._disputeSummary('pln_t');
        assert.equal(s.open, 1);
        assert.equal(s.blocking, 1);
        assert.match(s.top[0].claim, /RGPD/, 'el humano debe poder leer la objecion en el CHECKPOINT');
      } finally { db.cleanup(); }
    });

    test('resolver con relleno no cierra la disputa y lo informa', () => {
      const { svc, db } = planWithDispute();
      try {
        const id = db.prepare('SELECT id FROM swarm_disputes WHERE plan_id = ?').get('pln_t').id;
        const r = svc.resolveDispute({ plan_id: 'pln_t', dispute_id: id, resolution: 'dismissed', rationale: 'No aplica' });
        assert.equal(r.resolution, 'open');
        assert.equal(r.downgraded, true);
        assert.equal(svc._disputeSummary('pln_t').blocking, 1, 'sigue bloqueando');
      } finally { db.cleanup(); }
    });

    test('resolver citando el claim si la cierra y desbloquea', () => {
      const { svc, db } = planWithDispute();
      try {
        const id = db.prepare('SELECT id FROM swarm_disputes WHERE plan_id = ?').get('pln_t').id;
        const r = svc.resolveDispute({
          plan_id: 'pln_t', dispute_id: id, resolution: 'dismissed',
          rationale: 'Revisado: "con datos de pacientes violan el RGPD por exposicion publica" se resuelve anonimizando el panel.',
        });
        assert.equal(r.resolution, 'dismissed');
        assert.equal(svc._disputeSummary('pln_t').blocking, 0);
      } finally { db.cleanup(); }
    });
  });

  describe('compuerta de materializacion', () => {
    function matSvc() {
      const db = makeDb();
      const svc = new SwarmService(db, makeBus());
      svc.config = { gateway: { baseUrl: 'http://x', maxTokens: 500, synthMaxTokens: 2000 }, planning_agents: [], seed_skills: [] };
      const mat = new MaterializeService(db, makeBus());
      db.prepare("INSERT INTO swarm_plans (id, objective) VALUES ('pln_t', 'obj')").run();
      db.prepare("INSERT INTO swarm_tasks (id, plan_id, title) VALUES ('tsk_t', 'pln_t', 'Panel de estado')").run();
      return { svc, mat, db };
    }

    test('un veto critico abierto bloquea, y materializePlan aborta sin efectos', async () => {
      const { svc, mat, db } = matSvc();
      try {
        svc._persistDisputes('pln_t', svc._validateDisputes([{ claim: CLAIM, severity: 'critical', resolution: 'open' }]));
        assert.equal(mat._blockingDisputes('pln_t').length, 1);
        await assert.rejects(
          () => mat.materializePlan({ plan_id: 'pln_t' }),
          /BLOQUEADO/,
          'no se puede ejecutar trabajo que ya fue invalidado'
        );
        assert.equal(db.prepare('SELECT COUNT(*) c FROM sessions').get().c, 0, 'no debe dejar sesion a medias');
      } finally { db.cleanup(); }
    });

    test('una disputa no critica no bloquea', () => {
      const { svc, mat, db } = matSvc();
      try {
        svc._persistDisputes('pln_t', svc._validateDisputes([{ claim: CLAIM, severity: 'high', resolution: 'open' }]));
        assert.equal(mat._blockingDisputes('pln_t').length, 0);
      } finally { db.cleanup(); }
    });

    test('el export redacta datos personales y conserva las descartadas', () => {
      const { svc, mat, db } = matSvc();
      try {
        svc._persistDisputes('pln_t', [
          { claim: 'Contactar a paciente@hospital.cl es ilegal', severity: 'high', resolution: 'open' },
          { claim: 'Idea ya evaluada', severity: 'low', resolution: 'dismissed', rationale: 'Idea ya evaluada y descartada por costo' },
        ]);
        const md = mat._disputesMarkdown('pln_t');
        assert.ok(!md.includes('paciente@hospital.cl'), 'el email no puede llegar al disco');
        assert.match(md, /\[email redactado\]/);
        assert.match(md, /dismissed/, 'el ejecutor debe ver lo ya descartado para no repetirlo');
      } finally { db.cleanup(); }
    });
  });
});

describe('trazabilidad tarea -> skill', () => {
  function swarmWithPlan() {
    const db = makeDb();
    const svc = new SwarmService(db, makeBus());
    svc.config = { gateway: { baseUrl: 'http://x', maxTokens: 500, synthMaxTokens: 2000 }, planning_agents: [], seed_skills: [] };
    db.prepare("INSERT INTO swarm_plans (id, objective) VALUES ('pln_t','obj')").run();
    db.prepare("INSERT INTO swarm_tasks (id, plan_id, title) VALUES ('tsk_a','pln_t','Disenar API')").run();
    db.prepare("INSERT INTO swarm_tasks (id, plan_id, title) VALUES ('tsk_b','pln_t','Escribir tests')").run();
    db.prepare("INSERT INTO swarm_skills (id, name, domain, source) VALUES ('skl_cod','coding','software','known')").run();
    return { svc, db };
  }

  test('una capability conocida se liga al skill existente, sin duplicarlo', () => {
    const { svc, db } = swarmWithPlan();
    try {
      const proposed = svc._linkTaskSkills('tsk_a', ['coding']);
      assert.deepEqual(proposed, [], 'no debe proponer un skill que ya existe');
      const row = db.prepare('SELECT skill_id FROM swarm_task_skills WHERE task_id = ?').get('tsk_a');
      assert.equal(row.skill_id, 'skl_cod');
      assert.equal(db.prepare('SELECT COUNT(*) c FROM swarm_skills').get().c, 1, 'no debe duplicar el catalogo');
    } finally { db.cleanup(); }
  });

  test('una capability desconocida se CATALOGA como propuesta en vez de perderse', () => {
    const { svc, db } = swarmWithPlan();
    try {
      const proposed = svc._linkTaskSkills('tsk_a', ['prompt-protocol design']);
      assert.deepEqual(proposed, ['prompt-protocol design']);
      const s = db.prepare("SELECT * FROM swarm_skills WHERE name = 'prompt-protocol design'").get();
      assert.equal(s.source, 'proposed', 'debe quedar marcado como inexistente en el catalogo');
      assert.ok(db.prepare('SELECT 1 FROM swarm_task_skills WHERE task_id = ? AND skill_id = ?').get('tsk_a', s.id));
    } finally { db.cleanup(); }
  });

  test('dos tareas comparten el mismo skill (relacion muchos-a-muchos)', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['coding']);
      svc._linkTaskSkills('tsk_b', ['coding', 'testing']);

      const r = svc.planSkills('pln_t');
      const coding = r.skills.find((s) => s.skill === 'coding');
      assert.equal(coding.required_by.length, 2, 'un skill puede ser exigido por varias tareas');
      assert.equal(r.total, 2);
      assert.equal(r.missing, 1, 'testing no estaba en el catalogo');
      assert.match(r.message, /testing/);
    } finally { db.cleanup(); }
  });

  test('el enlace es idempotente: repetir la capability no duplica la fila', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['coding', 'coding', ' coding ']);
      assert.equal(db.prepare('SELECT COUNT(*) c FROM swarm_task_skills WHERE task_id = ?').get('tsk_a').c, 1);
    } finally { db.cleanup(); }
  });

  test('el catalogo no admite dos skills con el mismo nombre', () => {
    const { svc, db } = swarmWithPlan();
    try {
      assert.throws(
        () => db.prepare("INSERT INTO swarm_skills (id, name, source) VALUES ('skl_dup','coding','known')").run(),
        /UNIQUE/i,
        'resolver por nombre exige que el nombre sea unico'
      );
    } finally { db.cleanup(); }
  });

  test('borrar una tarea no deja enlaces huerfanos', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['coding']);
      db.prepare("DELETE FROM swarm_tasks WHERE id = 'tsk_a'").run();
      assert.equal(db.prepare('SELECT COUNT(*) c FROM swarm_task_skills').get().c, 0, 'el CASCADE debe limpiar');
    } finally { db.cleanup(); }
  });
});

describe('missing_skills derivados, no inventados', () => {
  function swarmWithPlan() {
    const db = makeDb();
    const svc = new SwarmService(db, makeBus());
    svc.config = { gateway: { baseUrl: 'http://x', maxTokens: 500, synthMaxTokens: 2000 }, planning_agents: [], seed_skills: [] };
    db.prepare("INSERT INTO swarm_plans (id, objective) VALUES ('pln_t','obj')").run();
    db.prepare("INSERT INTO swarm_tasks (id, plan_id, title) VALUES ('tsk_a','pln_t','Disenar API')").run();
    db.prepare("INSERT INTO swarm_skills (id, name, domain, source) VALUES ('skl_cod','coding','software','known')").run();
    return { svc, db };
  }

  test('solo cuenta como faltante lo que una tarea realmente exige', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['coding', 'vector_store']);
      const gap = svc._deriveMissingSkills('pln_t', []);
      assert.deepEqual(gap.missing, ['vector_store'], 'coding existe; vector_store no');
    } finally { db.cleanup(); }
  });

  test('lo que el modelo sugiere sin atarlo a una tarea NO ensucia el catalogo', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['coding']);
      const antes = db.prepare('SELECT COUNT(*) c FROM swarm_skills').get().c;

      const gap = svc._deriveMissingSkills('pln_t', ['observability/traces', 'schema/API']);

      assert.deepEqual(gap.missing, [], 'ninguna tarea exige algo ausente');
      assert.equal(db.prepare('SELECT COUNT(*) c FROM swarm_skills').get().c, antes,
        'una sugerencia que ninguna tarea usa no debe crear filas huerfanas');
    } finally { db.cleanup(); }
  });

  test('pero tampoco se descarta en silencio: queda como unattached', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['coding']);
      const gap = svc._deriveMissingSkills('pln_t', ['observability/traces']);
      assert.deepEqual(gap.unattached, ['observability/traces'], 'la desalineacion debe ser visible');
    } finally { db.cleanup(); }
  });

  test('una sugerencia que SI corresponde a una capability no se reporta como suelta', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['vector_store']);
      const gap = svc._deriveMissingSkills('pln_t', ['Vector_Store ']);
      assert.deepEqual(gap.unattached, [], 'la comparacion ignora mayusculas y espacios');
      assert.deepEqual(gap.missing, ['vector_store']);
    } finally { db.cleanup(); }
  });

  test('el catalogo separa carencias reales del ruido historico', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['vector_store']);
      db.prepare("INSERT INTO swarm_skills (id,name,source) VALUES ('skl_o','observability/traces','orphan')").run();

      const r = svc.listSkills();
      assert.equal(r.known, 1);
      assert.equal(r.proposed, 1, 'vector_store si es una carencia: una tarea lo exige');
      assert.equal(r.orphans, 1);
      assert.ok(!r.skills.some((s) => s.source === 'orphan'), 'el ruido no se mezcla con el catalogo');
      assert.match(r.note, /orphan/);

      assert.equal(svc.listSkills({ include_orphans: true }).skills.length, 3, 'pero sigue siendo consultable');
    } finally { db.cleanup(); }
  });

  test('acepta el caso degradado en que el modelo emite un string en vez de array', () => {
    const { svc, db } = swarmWithPlan();
    try {
      svc._linkTaskSkills('tsk_a', ['coding']);
      assert.deepEqual(svc._deriveMissingSkills('pln_t', 'algo suelto').unattached, ['algo suelto']);
    } finally { db.cleanup(); }
  });
});

describe('trazabilidad ticket -> plan', () => {
  test('un ticket materializado queda ligado a la hoja de tarea que lo origino', () => {
    const db = makeDb();
    try {
      addAgent(db, 'orq');
      db.prepare("INSERT INTO swarm_plans (id, objective) VALUES ('pln_t','obj')").run();
      db.prepare("INSERT INTO swarm_tasks (id, plan_id, title) VALUES ('tsk_plan','pln_t','Disenar API')").run();
      const sessions = new SessionsService(db, makeBus());
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('orq', ses.id);

      const svc = new TasksService(db, makeBus());
      const t = svc.publishTask('orq', ses.id, 'Implementar la API disenada', 'tsk_plan');

      const row = db.prepare('SELECT swarm_task_id FROM tasks WHERE id = ?').get(t.id);
      assert.equal(row.swarm_task_id, 'tsk_plan', 'el ticket debe saber que tarea del plan ejecuta');

      // La consulta que antes era imposible: del ticket al objetivo del plan.
      const trace = db.prepare(`
        SELECT p.objective, st.title FROM tasks t
        JOIN swarm_tasks st ON st.id = t.swarm_task_id
        JOIN swarm_plans p ON p.id = st.plan_id
        WHERE t.id = ?`).get(t.id);
      assert.equal(trace.title, 'Disenar API');
      assert.equal(trace.objective, 'obj');
    } finally { db.cleanup(); }
  });

  test('un ticket publicado a mano sigue siendo valido sin plan', () => {
    const db = makeDb();
    try {
      addAgent(db, 'humano');
      const sessions = new SessionsService(db, makeBus());
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('humano', ses.id);

      const t = new TasksService(db, makeBus()).publishTask('humano', ses.id, 'Tarea suelta');
      assert.equal(db.prepare('SELECT swarm_task_id FROM tasks WHERE id = ?').get(t.id).swarm_task_id, null);
    } finally { db.cleanup(); }
  });

  test('la FK rechaza un swarm_task_id inexistente', () => {
    const db = makeDb();
    try {
      addAgent(db, 'orq');
      const sessions = new SessionsService(db, makeBus());
      const ses = sessions.createSession({ name: 's', mode: 'moderator' });
      sessions.joinSession('orq', ses.id);

      assert.throws(
        () => new TasksService(db, makeBus()).publishTask('orq', ses.id, 'x', 'tsk_inexistente'),
        /FOREIGN KEY/i,
        'la integridad referencial debe impedir ligar a un plan que no existe'
      );
    } finally { db.cleanup(); }
  });
});

describe('LLMGatewayClient.chat parsing', () => {
  test('no usa reasoning_content como respuesta', async () => {
    const client = new LLMGatewayClient({ baseUrl: 'http://x' });
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        model: 'thinking-model',
        choices: [{ message: { content: '', reasoning_content: 'Okay, let me think about this...' }, finish_reason: 'length' }],
        usage: {},
      }),
    });
    try {
      const r = await client.chat({ model: 'thinking-model', messages: [{ role: 'user', content: 'x' }] });
      assert.equal(r.text, '', 'el borrador interno no es la respuesta');
      assert.match(r.reasoning, /let me think/, 'pero queda disponible para diagnostico');
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('resolveGatewayKey', () => {
  const withEnv = async (vars, fn) => {
    const saved = {};
    for (const [k, v] of Object.entries(vars)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      return await fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };

  const CLEAR = {
    LLM_GATEWAY_KEY: undefined,
    LLM_GATEWAY_ENV_FILE: undefined,
    LITELLM_KEY: undefined,
    LITELLM_MASTER_KEY: undefined,
    LITELLM_ENV_FILE: undefined,
  };

  test('prefiere LLM_GATEWAY_KEY', async () => {
    const { resolveGatewayKey } = await import('../src/modules/hosted/hosted.config.js');
    await withEnv({ ...CLEAR, LLM_GATEWAY_KEY: 'nueva', LITELLM_KEY: 'vieja' }, () => {
      assert.equal(resolveGatewayKey(), 'nueva');
    });
  });

  test('acepta LITELLM_KEY como alias historico', async () => {
    const { resolveGatewayKey } = await import('../src/modules/hosted/hosted.config.js');
    await withEnv({ ...CLEAR, LITELLM_KEY: 'heredada' }, () => {
      assert.equal(resolveGatewayKey(), 'heredada');
    });
  });

  test('devuelve cadena vacia cuando no hay nada configurado', async () => {
    const { resolveGatewayKey } = await import('../src/modules/hosted/hosted.config.js');
    await withEnv({ ...CLEAR, LLM_GATEWAY_ENV_FILE: 'C:/ruta/que/no/existe.env' }, () => {
      assert.equal(resolveGatewayKey(), '');
    });
  });
});
