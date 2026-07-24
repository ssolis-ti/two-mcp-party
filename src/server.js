import { engine } from './core/engine.js';
import { MCPServerTransport } from './transport/mcp-server.js';
import { logger } from './core/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Server {
  constructor() {
    this.transport = null;
  }

  async start() {
    try {
      logger.info('Bootstrapping AgentBridge...');

      // 1. Iniciar Engine y Cargar Módulos
      const modulesPath = path.join(__dirname, 'modules');
      await engine.initialize({ modulesPath });

      // 2. Iniciar Capa de Transporte MCP
      this.transport = new MCPServerTransport(engine);
      await this.transport.start();

      logger.info('🚀 AgentBridge Hub is running and accepting connections.');

      // 3. Manejo limpio del cierre
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT. Shutting down...');
        await engine.shutdown();
        process.exit(0);
      });

    } catch (err) {
      logger.error({ err }, 'Fatal error during server startup');
      process.exit(1);
    }
  }
}
