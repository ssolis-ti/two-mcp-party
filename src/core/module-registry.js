import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { logger } from './logger.js';

export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.tools = []; // Array de tools MCP registrados
  }

  async loadModules(modulesDir, engine) {
    logger.info(`Loading modules from ${modulesDir}...`);
    
    if (!fs.existsSync(modulesDir)) {
      logger.warn(`Modules directory ${modulesDir} does not exist`);
      return;
    }

    const dirs = fs.readdirSync(modulesDir, { withFileTypes: true });
    
    for (const dirent of dirs) {
      if (dirent.isDirectory()) {
        const indexPath = path.join(modulesDir, dirent.name, 'index.js');
        
        if (fs.existsSync(indexPath)) {
          try {
            // Importar módulo dinámicamente
            const moduleUrl = pathToFileURL(indexPath).href;
            const mod = await import(moduleUrl);
            const moduleDef = mod.default;

            await this.register(moduleDef, engine, path.dirname(indexPath));
          } catch (err) {
            logger.error({ err, module: dirent.name }, 'Failed to load module');
          }
        }
      }
    }
  }

  async register(moduleDef, engine, modulePath) {
    if (!moduleDef || !moduleDef.name) {
      throw new Error('Invalid module definition');
    }

    // 1. Cargar schema si existe
    if (moduleDef.schema) {
      const schemaPath = path.join(modulePath, moduleDef.schema);
      engine.db.executeSchema(schemaPath);
    }

    // 2. Registrar tools MCP
    if (moduleDef.tools && Array.isArray(moduleDef.tools)) {
      this.tools.push(...moduleDef.tools);
    }

    // 3. Ejecutar hook de onLoad
    if (typeof moduleDef.onLoad === 'function') {
      await moduleDef.onLoad(engine);
    }

    this.modules.set(moduleDef.name, moduleDef);
    logger.info(`Module loaded: ${moduleDef.name} v${moduleDef.version || '1.0'}`);
  }

  getTools() {
    return this.tools;
  }
}
