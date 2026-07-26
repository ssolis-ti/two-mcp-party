import { TasksService } from './tasks.service.js';
import { getTasksTools } from './tasks.tools.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'tasks',
  version: '1.0.0',
  description: 'Task Discovery and Maker/Checker pattern module',
  schema: 'tasks.schema.sql',
  
  tools: [],

  async onLoad(engine) {
    serviceInstance = new TasksService(engine.db, engine.eventBus);
    
    const tools = getTasksTools(serviceInstance, engine.db);
    engine.registry.tools.push(...tools);
    
    logger.debug('Tasks module loaded successfully');
  }
};
