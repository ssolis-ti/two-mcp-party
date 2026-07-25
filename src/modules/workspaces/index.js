import { WorkspacesService } from './workspaces.service.js';
import { createWorkspaceTools } from './workspaces.tools.js';
import { logger } from '../../core/logger.js';

let serviceInstance;

export default {
  name: 'workspaces',
  version: '1.0.0',
  description: 'Shared File System Sandbox for Agents',
  
  // No database schema needed for file operations
  
  tools: [],

  async onLoad(engine) {
    serviceInstance = new WorkspacesService(engine.db, engine.eventBus);
    
    // Inject the tools dynamically by passing the service instance
    const tools = createWorkspaceTools(serviceInstance);
    engine.registry.tools.push(...tools);

    logger.debug('Workspaces module loaded successfully');
  }
};
