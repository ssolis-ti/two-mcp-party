import { DebuggerService } from './debugger.service.js';
import { getDebuggerTools } from './debugger.tools.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'debugger',
  version: '1.0.0',
  description: 'Hot-Reload & Diagnostics module for meta-agents',
  tools: [],

  async onLoad(engine) {
    // Si no estamos en modo debug, el módulo aborta la inyección de tools
    if (process.env.DEBUG_MODE !== 'true') {
      logger.debug('Debugger module disabled. Set DEBUG_MODE=true to enable.');
      return;
    }

    serviceInstance = new DebuggerService(engine.db);
    
    const tools = getDebuggerTools(serviceInstance);
    engine.registry.tools.push(...tools);
    
    logger.warn('⚠️ DEBUGGER MODULE ACTIVE. Agents have read access to system state and source code.');
  }
};
