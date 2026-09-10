import { readFileSync } from 'node:fs';

/**
 * Configuración del módulo "hosted" — integración con el router LiteLLM.
 *
 * LITELLM_KEY debe ser una clave MASTER de LiteLLM válida (la que autentica el
 *proxy en localhost:4000). Se toma de la variable de entorno LITELLM_KEY; si no
 *está definida, usa la variable LITELLM_MASTER_KEY del entorno.
 *
 * Los modelos listados en `agents` corresponden EXACTAMENTE a los que figuran
 * en el listado de modelos de Hermes (custom_providers en config.yaml), que
 * apuntan al mismo router LiteLLM en localhost:4000:
 *
 *   NVIDIA NIM LiteLLM  -> nvidia-* (rate limit ~40 RPM, gratis)
 *   Inference LiteLLM   -> deepseek-via-inference*, gemini-3.7-flash, kimi-k3*,
 *                          glm-5.3*, grok-4.6
 *   DeepSeek LiteLLM    -> deepseek-v4-flash, deepseek-v4-pro,
 *                          deepseek-chat-fallback
 */
const LITELLM_KEY =
  process.env.LITELLM_KEY ||
  process.env.LITELLM_MASTER_KEY ||
  (() => {
    // Fallback: leer la master key real del .env del deploy Docker de LiteLLM.
    // Útil para que corra "de una" sin exportar variables de entorno.
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
    return '<pon_aqui_tu_key_master_real>';
  })();

export const hostedConfig = {
  liteLLM: {
    baseUrl: process.env.LITELLM_URL || 'http://localhost:4000',
    apiKey: LITELLM_KEY,
    timeoutMs: 240000,  // 240s (coherente con request_timeout del router)
    maxTokens: 1024,
    temperature: 0.7,
  },

  // Mapeo de agentes alojados -> modelos del router LiteLLM.
  // Todos estos modelos están en el listado de Hermes (localhost:4000).
  // Cambia `model` por cualquiera que figure en tu config de Hermes:
  //  nvidia-deepseek-flash, nvidia-deepseek-pro, nvidia-nemotron,
  //  nvidia-minimax-m3, nvidia-gpt-oss-120b, nvidia-gpt-oss-20b,
  //  nvidia-nemotron-nano-30b, nvidia-kimi-k2-6, nvidia-nemotron-ultra-550b,
  //  deepseek-via-inference, deepseek-via-inference-pro, gemini-3.7-flash,
  //  kimi-k3, kimi-k3-fast, glm-5.3, glm-5.3-flash, grok-4.6,
  //  deepseek-v4-flash, deepseek-v4-pro, deepseek-chat-fallback.
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
