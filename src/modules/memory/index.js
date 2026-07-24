import { MemoryService } from './memory.service.js';
import { getMemoryTools } from './memory.tools.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'memory',
  version: '1.0.0',
  description: 'Shared memory space across agents',
  schema: 'memory.schema.sql',
  tools: [],

  async onLoad(engine) {
    serviceInstance = new MemoryService(engine.db, engine.eventBus);
    
    const tools = getMemoryTools(serviceInstance);
    engine.registry.tools.push(...tools);
    
    logger.debug('Memory module loaded successfully');
  }
};
