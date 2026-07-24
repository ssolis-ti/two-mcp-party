import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../core/logger.js';

export class MCPServerTransport {
  constructor(engine) {
    this.engine = engine;
    this.server = new Server(
      {
        name: 'agentbridge-hub',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // 1. List Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.engine.getTools();
      return {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description || `Execute ${t.name}`,
          inputSchema: t.schema || { type: 'object', properties: {} },
        })),
      };
    });

    // 2. Call Tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tools = this.engine.getTools();
      const toolName = request.params.name;
      const args = request.params.arguments || {};

      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      try {
        logger.debug({ tool: toolName, args }, 'Calling MCP tool');
        const result = await tool.handler(args, this.engine);
        
        // MCP requiere que el resultado sea un array de contenido
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ tool: toolName, error }, 'Tool execution failed');
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${toolName}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start() {
    const port = process.env.PORT || 3579;
    const app = express();
    const { randomUUID } = await import('node:crypto');
    const sessions = new Map();

    app.use((req, res, next) => {
      logger.info({ method: req.method, url: req.originalUrl, query: req.query, headers: req.headers }, 'Incoming Request');
      next();
    });

    const route = async (req, res) => {
      const sessionId = req.query.sessionId || req.headers['mcp-session-id'] || req.headers['sessionid'];
      
      // Si la petición ya tiene una sesión activa, enrutarla
      if (sessionId && sessions.has(sessionId)) {
        await sessions.get(sessionId).handleRequest(req, res, req.body);
        return;
      }
      
      // Si no tiene sesión (es decir, es una inicialización GET o POST inicial)
      if (!sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        
        transport.onclose = () => {
          if (transport.sessionId) {
            logger.info({ sessionId: transport.sessionId }, 'Client disconnected');
            sessions.delete(transport.sessionId);
          }
        };

        await this.server.connect(transport);
        
        if (transport.sessionId) {
          sessions.set(transport.sessionId, transport);
          logger.info({ sessionId: transport.sessionId }, 'Created new transport session');
        }
        
        await transport.handleRequest(req, res, req.body);
        return;
      }

      logger.warn({ requestedSessionId: sessionId, activeSessions: Array.from(sessions.keys()) }, 'Received POST for unknown session');
      res.status(404).send('Session not found');
    };

    // Antigravity (y otros) conectan a /sse pero envían GET, POST y DELETE a la misma base
    app.get('/sse', route);
    app.post('/sse', route);
    app.delete('/sse', route);
    
    // Y para mantener retrocompatibilidad (por si algún cliente aún usa /message)
    app.post('/message', route);

    app.listen(port, () => {
      logger.info(`Starting MCP Server (Streamable HTTP) on http://0.0.0.0:${port}`);
      logger.info(`Agents in your LAN can connect to: http://<YOUR_IP>:${port}/sse`);
    });
  }
}
