import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeDb, makeBus, addAgent, seedMessage } from './helpers.mjs';
import { MessagingService } from '../src/modules/messaging/messaging.service.js';
import { SessionsService } from '../src/modules/sessions/sessions.service.js';
import { WorkspacesService } from '../src/modules/workspaces/workspaces.service.js';
import { LLMGatewayClient } from '../src/modules/hosted/llm-gateway-client.js';

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
