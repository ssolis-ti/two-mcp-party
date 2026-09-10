import { readFileSync } from 'node:fs';

/**
 * Configuración del módulo "hosted" — conexión a un gateway de LLMs.
 *
 * El hub NO integra proveedores: habla un unico dialecto (chat de OpenAI)
 * contra un gateway que se encarga de multiplexar proveedores, hacer fallback
 * y aplicar rate limits. Sirve cualquiera que exponga API OpenAI-compatible
 * —LiteLLM, Bifrost, vLLM, LM Studio, Ollama, OpenRouter, la API de OpenAI—
 * apuntando LLM_GATEWAY_URL al que uses.
 *
 * Los nombres de `agents[].model` son strings que el gateway debe reconocer;
 * cambialos por los que exponga tu instancia. Ver .env.example.
 */

/** Gateway URL. LITELLM_URL se acepta como alias historico. */
export const GATEWAY_URL =
  process.env.LLM_GATEWAY_URL || process.env.LITELLM_URL || 'http://localhost:4000';

/**
 * Resuelve la API key del gateway, en orden de precedencia:
 *   1. LLM_GATEWAY_KEY (o los alias LITELLM_KEY / LITELLM_MASTER_KEY).
 *   2. LLM_GATEWAY_ENV_FILE (alias LITELLM_ENV_FILE): ruta a un archivo tipo
 *      .env del que se extrae LLM_GATEWAY_KEY o LITELLM_MASTER_KEY.
 * Devuelve '' si no hay ninguna configurada, para que el modulo avise en el
 * arranque en vez de fallar recien al primer request.
 */
export function resolveGatewayKey() {
  const direct =
    process.env.LLM_GATEWAY_KEY || process.env.LITELLM_KEY || process.env.LITELLM_MASTER_KEY;
  if (direct) return direct.trim();

  const envFile = process.env.LLM_GATEWAY_ENV_FILE || process.env.LITELLM_ENV_FILE;
  if (envFile) {
    try {
      const txt = readFileSync(envFile, 'utf8');
      const m = txt.match(/^\s*(?:LLM_GATEWAY_KEY|LITELLM_MASTER_KEY)\s*=\s*(.+)\s*$/m);
      if (m && m[1]) return m[1].trim().replace(/^['"]|['"]$/g, '');
    } catch (_) { /* archivo ausente o ilegible: se trata como "sin key" */ }
  }

  return '';
}

export const hostedConfig = {
  gateway: {
    baseUrl: GATEWAY_URL,
    apiKey: resolveGatewayKey(),
    timeoutMs: 240000,  // 240s (coherente con el request_timeout tipico de un gateway)
    maxTokens: 1024,
    temperature: 0.7,
  },

  // Mapeo de agentes alojados -> nombres de modelo que el gateway debe reconocer.
  // Estos valores son de ejemplo: reemplazalos por los que exponga tu instancia
  // (consultables con bridge_list_models o el /v1/models de tu gateway).
  agents: [
    {
      name: 'producer',
      role: 'author',
      model: 'kimi-k3',
      description: 'Backed by kimi-k3 (Inference). Produces the first draft.',
    },
    {
      name: 'peer1',
      role: 'reviewer',
      model: 'glm-5.3',
      description: 'Backed by glm-5.3 (Inference). Rigorous reviewer.',
    },
    {
      name: 'peer2',
      role: 'critic',
      model: 'grok-4.6',
      description: 'Backed by grok-4.6 (Inference). Tough, constructive critic.',
    },
    {
      name: 'chair',
      role: 'synthesizer',
      model: 'nvidia-nemotron-ultra-550b',
      description: 'Backed by nvidia-nemotron-ultra-550b (NIM). Synthesizes and closes.',
    },
  ],
};
