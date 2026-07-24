import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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
    
    // Mapa para almacenar todas las conexiones SSE activas por sessionId
    const transports = new Map();

    // Ruta principal para conectarse vía SSE
    app.get('/sse', async (req, res) => {
      logger.info({ ip: req.ip }, 'New client connecting via SSE');
      
      // El cliente mandará sus POSTs a /message?sessionId=...
      const transport = new SSEServerTransport('/message', res);
      await this.server.connect(transport);
      
      // Guardar el transport en el mapa usando el sessionId que generó el SDK
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
        
        transport.onclose = () => {
          logger.info({ sessionId: transport.sessionId }, 'Client SSE disconnected');
          transports.delete(transport.sessionId);
        };
      }
    });

    // Ruta para recibir los mensajes del cliente (POST)
    app.post('/message', async (req, res) => {
      const sessionId = req.query.sessionId;
      const transport = transports.get(sessionId);
      
      if (!transport) {
        logger.warn({ sessionId }, 'Received POST for unknown session');
        res.status(404).send('Session not found');
        return;
      }

      try {
        await transport.handlePostMessage(req, res);
      } catch (err) {
        logger.error({ err, sessionId }, 'Error handling POST message');
      }
    });

    app.listen(port, () => {
      logger.info(`Starting MCP Server (SSE transport) on http://0.0.0.0:${port}`);
      logger.info(`Agents in your LAN can connect to: http://<YOUR_IP>:${port}/sse`);
    });
  }
}
