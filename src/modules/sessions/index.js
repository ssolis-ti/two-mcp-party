import { SessionsService } from './sessions.service.js';
import { getSessionsTools } from './sessions.tools.js';
import { logger } from '../../core/logger.js';

export default {
  name: 'sessions',
  version: '1.0.0',
  description: 'Manage virtual rooms for agent collaboration',
  schema: 'sessions.schema.sql',
  tools: [],

  async onLoad(engine) {
    const serviceInstance = new SessionsService(engine.db, engine.eventBus);
    const tools = getSessionsTools(serviceInstance);
    engine.registry.tools.push(...tools);
    logger.debug('Sessions module loaded successfully');
  }
};
