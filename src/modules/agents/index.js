import { AgentsService } from './agents.service.js';
import { getAgentsTools } from './agents.tools.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'agents',
  version: '1.0.0',
  description: 'Agent identity and discovery module',
  schema: 'agents.schema.sql',
  
  // Array vacío inicialmente, se llenará en onLoad para tener acceso al servicio
  tools: [],

  async onLoad(engine) {
    serviceInstance = new AgentsService(engine.db, engine.eventBus);
    
    // Inyectar los tools dinámicamente pasándole el servicio
    const tools = getAgentsTools(serviceInstance);
    engine.registry.tools.push(...tools);
    
    // Configurar cron para limpieza de offline agents cada minuto
    setInterval(() => {
      try {
        serviceInstance.checkTimeouts();
      } catch (err) {
        logger.error({ err }, 'Error in agent timeout check');
      }
    }, 60000);

    logger.debug('Agents module loaded successfully');
  }
};
