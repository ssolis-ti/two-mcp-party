import { MessagingService } from './messaging.service.js';
import { getMessagingTools } from './messaging.tools.js';
import { logger } from '../../core/logger.js';
import { LoopService } from './loop.service.js';

let serviceInstance;
let loopServiceInstance;

export default {
  name: 'messaging',
  version: '1.0.0',
  description: 'Agent-to-agent messaging protocol',
  schema: 'messaging.schema.sql',
  tools: [],

  async onLoad(engine) {
    loopServiceInstance = new LoopService(engine.db);
    serviceInstance = new MessagingService(engine.db, engine.eventBus, loopServiceInstance);
    
    const tools = getMessagingTools(serviceInstance);
    engine.registry.tools.push(...tools);
    
    logger.debug('Messaging module loaded successfully');
  }
};
