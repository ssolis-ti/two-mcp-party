import { eventBus } from './event-bus.js';
import { db } from './database.js';
import { ModuleRegistry } from './module-registry.js';
import { logger } from './logger.js';
import path from 'path';

export class AgentBridgeEngine {
  constructor() {
    this.eventBus = eventBus;
    this.db = db;
    this.registry = new ModuleRegistry();
    this.isInitialized = false;
  }

  async initialize(options = {}) {
    if (this.isInitialized) return;
    
    logger.info('Initializing AgentBridge Engine...');

    const modulesPath = options.modulesPath || path.resolve(process.cwd(), 'src/modules');
    
    // Cargar todos los módulos dinámicamente
    await this.registry.loadModules(modulesPath, this);

    this.isInitialized = true;
    logger.info('Engine initialized successfully');
  }

  getTools() {
    return this.registry.getTools();
  }

  async shutdown() {
    logger.info('Shutting down AgentBridge Engine...');
    this.db.close();
    logger.info('Database connection closed');
  }
}

// Singleton global
export const engine = new AgentBridgeEngine();
