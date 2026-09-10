import { HostedService } from './hosted.service.js';
import { getHostedTools } from './hosted.tools.js';
import { hostedConfig } from './hosted.config.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { LoopService } from '../messaging/loop.service.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'hosted',
  version: '1.0.0',
  description: 'LiteLLM-hosted model-agents that converse autonomously through the hub',
  tools: [],

  async onLoad(engine) {
    // The hosted module drives turns through the same MessagingService /
    // SessionsService machinery the external clients use. We share the
    // singleton db + eventBus, so hosted turns integrate with turn-taking,
    // DPD, anti-loop, cooldown and the message log exactly like any agent.
    // (Instantiate fresh wrappers: they hold no per-instance state beyond the
    // shared db, so this is safe and leaves the other modules untouched.)
    const loopService = new LoopService(engine.db);
    const messagingService = new MessagingService(engine.db, engine.eventBus, loopService);
    const sessionsService = new SessionsService(engine.db, engine.eventBus);

    serviceInstance = new HostedService(engine.db, engine.eventBus);
    serviceInstance.initialize({ config: hostedConfig });
    serviceInstance.setMessagingService(messagingService);
    serviceInstance.setSessionsService(sessionsService);

    const tools = getHostedTools(serviceInstance);
    engine.registry.tools.push(...tools);

    if (!hostedConfig.gateway.apiKey) {
      logger.warn(
        `Hosted module: no gateway key configured for ${hostedConfig.gateway.baseUrl}. ` +
        'Set LLM_GATEWAY_KEY (or LLM_GATEWAY_ENV_FILE pointing at an env file) ' +
        'before running conversations. See .env.example.'
      );
    }

    logger.info('Hosted module loaded (gateway model-agents available). Models configured: ' +
      hostedConfig.agents.map((a) => `${a.role}=${a.model}`).join(', '));
  },
};
