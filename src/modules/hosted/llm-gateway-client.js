import { logger } from '../../core/logger.js';

/**
 * Cliente HTTP delgado contra un gateway de LLMs con API OpenAI-compatible.
 * Endpoint: {LLM_GATEWAY_URL}/v1/chat/completions
 * Auth:     Authorization: Bearer {LLM_GATEWAY_KEY}
 *
 * Deliberadamente agnostico del proveedor: solo habla el dialecto de chat de
 * OpenAI y reenvia `model`, `messages`, `max_tokens`, `temperature`, `tools`.
 * Quien multiplexa proveedores, hace fallback y aplica rate limits es el
 * gateway, no este hub. Por eso funciona sin cambios contra LiteLLM, Bifrost,
 * vLLM, LM Studio, Ollama (endpoint OpenAI), OpenRouter o la API de OpenAI:
 * basta apuntar la URL al que uses.
 */
export class LLMGatewayClient {
  constructor({ baseUrl = 'http://localhost:4000', apiKey = '', timeoutMs = 240000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  /**
   * fetch() de Node falla con un escueto "fetch failed" y esconde la causa real en
   * err.cause. Sin esto, un gateway apagado le llega al agente como "fetch failed",
   * que no le dice ni que backend fallo ni que puede hacer al respecto.
   */
  _wrapNetworkError(err, endpoint) {
    const code = err?.cause?.code || err?.code;
    const isFetchFailure = err?.message === 'fetch failed' || Boolean(code);
    if (!isFetchFailure) return err;

    const unreachable = ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'EAI_AGAIN'];
    const detail = code || err?.cause?.message || 'causa desconocida';
    const hint = unreachable.includes(code)
      ? `El gateway de LLMs no responde en ${this.baseUrl}. Verifica que este levantado antes de reintentar.`
      : `El gateway de LLMs no responde en ${this.baseUrl} (${detail}).`;
    return new Error(`${hint} [${endpoint}]`, { cause: err });
  }

  /**
   * Perform a chat completion request.
   * @param {object} params { model, messages, max_tokens, temperature, tools, tool_choice }
   * @returns {Promise<{text: string, model: string, usage: object}>}
   */
  async chat(params) {
    const { model, messages, ...rest } = params;
    if (!model) throw new Error('LLMGatewayClient.chat: model is required');
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('LLMGatewayClient.chat: messages array is required');
    }

    const body = {
      model,
      messages,
      ...rest,
    };

    logger.debug({ model, msgCount: messages.length, baseUrl: this.baseUrl }, 'Gateway chat request');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gateway HTTP ${res.status}: ${errText.slice(0, 500)}`);
      }

      const data = await res.json();

      // Tool call response?
      const toolCalls = data?.choices?.[0]?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        return {
          text: data.choices[0].message.content || '',
          toolCalls,
          model: data.model || model,
          usage: data.usage || {},
          finish_reason: data.choices?.[0]?.finish_reason,
        };
      }

      const text = data?.choices?.[0]?.message?.content ?? '';
      const reasoning = data?.choices?.[0]?.message?.reasoning_content ?? '';
      return {
        // Algunos modelos "thinking" (p.ej. deepseek-r1, ciertos GLM/kimi)
        // entregan el razonamiento en `reasoning_content` y dejan `content`
        // vacío. Si ocurre, lo usamos como texto para no abortar el turno.
        text: typeof text === 'string' && text.trim()
          ? text
          : (typeof reasoning === 'string' ? reasoning.trim() : ''),
        model: data.model || model,
        usage: data.usage || {},
        finish_reason: data.choices?.[0]?.finish_reason,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Gateway request timed out after ${this.timeoutMs}ms (model ${model})`);
      }
      throw this._wrapNetworkError(err, '/v1/chat/completions');
    } finally {
      clearTimeout(timeout);
    }
  }

  /** List the models the proxy exposes (via /v1/models). */
  async listModels() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Gateway /v1/models HTTP ${res.status}`);
      }
      const data = await res.json();
      return (data?.data || []).map((m) => m.id).filter(Boolean);
    } catch (err) {
      logger.error({ err, baseUrl: this.baseUrl }, 'Failed to list gateway models');
      if (err.name === 'AbortError') {
        throw new Error(`Gateway /v1/models timed out after ${this.timeoutMs}ms`);
      }
      throw this._wrapNetworkError(err, '/v1/models');
    } finally {
      clearTimeout(timeout);
    }
  }
}
