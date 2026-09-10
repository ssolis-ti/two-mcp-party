import { SwarmService } from './swarm.service.js';
import { getSwarmTools } from './swarm.tools.js';
import { swarmConfig } from './swarm.config.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'swarm',
  version: '1.0.0',
  description: 'Mente colmena planificadora: descompone objetivos en un plan maestro de tareas (con skills y criterios) listo para que otras LLM lo ejecuten. No ejecuta tareas: planifica, organiza y potencia skills.',
  schema: 'schema.sql',
  tools: [],

  async onLoad(engine) {
    serviceInstance = new SwarmService(engine.db, engine.eventBus);
    serviceInstance.initialize({ config: swarmConfig });

    const tools = getSwarmTools(serviceInstance);
    engine.registry.tools.push(...tools);

    logger.info('Swarm module loaded (planning hivemind). Planning agents: ' +
      (swarmConfig.planning_agents || []).map((a) => `${a.name}=${a.model}`).join(', '));
  },
};
