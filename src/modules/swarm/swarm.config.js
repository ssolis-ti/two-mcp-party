import { readFileSync } from 'node:fs';
import { hostedConfig } from '../hosted/hosted.config.js';

/**
 * Configuración del módulo "swarm" — Mente colmena planificadora.
 *
 * Referencia arquitectónica:
 *   La mente colmena NO ejecuta tareas. Es la capa de PLANIFICACION,
 *   ORGANIZACION, ESTRUCTURACION de tareas y POTENCIACION de skills.
 *   Un objetivo se descompone en tareas bien definidas (hojas de tarea)
 *   que quedan persistidas como entregable accionable para que OTRAS LLM
 *   las ejecuten (vía MCP/JSON-RPC o cualquier ejecutor). La deliberación
 *   colaborativa entre modelos solo se usa para DISEÑAR el plan maestro.
 *
 * Reutiliza la master key y el baseUrl del módulo "hosted" (mismo router
 * LiteLLM en localhost:4000), de modo que NO se duplica configuración.
 */

const LITELLM_KEY =
  process.env.LITELLM_KEY ||
  process.env.LITELLM_MASTER_KEY ||
  (() => {
    const candidates = [
      'C:/Users/user/Desktop/deploys-docker/litellm-deploy/internal/litellm.env',
    ];
    for (const f of candidates) {
      try {
        const txt = readFileSync(f, 'utf8');
        const m = txt.match(/^\s*LITELLM_MASTER_KEY\s*=\s*(.+)\s*$/m);
        if (m && m[1]) return m[1].trim().replace(/^['"]|['"]$/g, '');
      } catch (_) { /* continuar */ }
    }
    return hostedConfig.liteLLM.apiKey || '<pon_aqui_tu_key_master_real>';
  })();

export const swarmConfig = {
  liteLLM: {
    baseUrl: process.env.LITELLM_URL || hostedConfig.liteLLM.baseUrl || 'http://localhost:4000',
    apiKey: LITELLM_KEY,
    timeoutMs: 240000,   // 240s, coherente con request_timeout del router
    maxTokens: 1200,     // deliberación de diseño (modelos aportan ~150 palabras)
    synthMaxTokens: 5000, // SINTETIZADOR necesita presupuesto para leer la deliberación
                          // completa + emitir un JSON con 2-8 tareas (6 campos c/u).
                          // Con solo 1200 tokens truncaba el summary y no emitía las tareas.
    temperature: 0.6,    // ligeramente más bajo: queremos estructura, no creatividad frenética
  },

  // Quién delibera para DISEÑAR el plan maestro. Son los mapeos del módulo
  // hosted (mismos modelos del listado de Hermes). El último es el "síntesis":
  // consolida la colaboración en el plan final con tareas y skills.
  // Cambia `model` por cualquiera del listado de Hermes en localhost:4000.
  planning_agents: hostedConfig.agents,

  // Capacidades que la mente colmena conoce por defecto y semilla el catálogo.
  seed_skills: [
    { name: 'coding',         domain: 'software',        description: 'Escribir y corregir código' },
    { name: 'code_review',    domain: 'software',        description: 'Revisar calidad y seguridad del código' },
    { name: 'architecture',   domain: 'software',        description: 'Diseñar arquitectura y sistemas' },
    { name: 'research',       domain: 'general',         description: 'Investigar y sintetizar información' },
    { name: 'writing',        domain: 'general',         description: 'Redacción y documentación de calidad' },
    { name: 'planning',       domain: 'general',         description: 'Descomponer objetivos en tareas accionables' },
    { name: 'testing',        domain: 'software',        description: 'Diseñar y ejecutar pruebas' },
    { name: 'data_analysis',  domain: 'data',            description: 'Analizar datos y extraer conclusiones' },
  ],
};
