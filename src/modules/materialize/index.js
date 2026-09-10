import { MaterializeService } from './materialize.service.js';
import { getMaterializeTools } from './materialize.tools.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'materialize',
  version: '1.0.0',
  description:
    'Puente que materializa los planes de la mente colmena (swarm) en sesiones MCP reales con traspaso rico: ' +
    'registra orquestador, crea sesión free con goals, comparte memoria de contexto, publica tareas como ' +
    'tickets y emite handoff. Requiere que los módulos sessions/memory/tasks/messaging/swarm estén cargados.',
  tools: [],

  async onLoad(engine) {
    serviceInstance = new MaterializeService(engine.db, engine.eventBus);
    serviceInstance.initialize({ engine });

    const tools = getMaterializeTools(serviceInstance);
    engine.registry.tools.push(...tools);

    logger.info('Materialize module loaded (swarm -> MCP session bridge)');
  },
};
