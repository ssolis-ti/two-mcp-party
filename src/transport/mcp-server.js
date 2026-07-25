import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../core/logger.js';

export class MCPServerTransport {
  constructor(engine) {
    this.engine = engine;
  }

  // Factoría para crear un nuevo servidor MCP por cada cliente conectado
  createServerInstance() {
    const server = new Server(
      {
        name: 'agentbridge-hub',
        version: '1.2.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 1. List Tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
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
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

    return server;
  }

  async start() {
    const port = process.env.PORT || 3579;
    const app = express();
    const { randomUUID } = await import('node:crypto');
    const sessions = new Map();

    app.use((req, res, next) => {
      // logger.info({ method: req.method, url: req.originalUrl, query: req.query, headers: req.headers }, 'Incoming Request');
      next();
    });

    const route = async (req, res) => {
      const sessionId = req.query.sessionId || req.headers['mcp-session-id'] || req.headers['sessionid'];
      
      if (sessionId && sessions.has(sessionId)) {
        const activeTransport = sessions.get(sessionId);
        activeTransport._lastActivity = Date.now();
        await activeTransport.handleRequest(req, res, req.body);
        return;
      }
      
      if (!sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transport._lastActivity = Date.now();
            sessions.set(id, transport);
            logger.info({ sessionId: id }, 'Created new transport session');
          }
        });
        
        transport.onclose = () => {
          if (transport.sessionId) {
            logger.info({ sessionId: transport.sessionId }, 'Client transport closed (HTTP request finished)');
            // Fix: No eliminar aquí, ya que MCP v2 llama a onclose tras CADA request (GET/POST)
            // sessions.delete(transport.sessionId);
          }
        };

        const clientServer = this.createServerInstance();
        await clientServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      logger.warn({ requestedSessionId: sessionId, activeSessions: Array.from(sessions.keys()) }, 'Received POST for unknown session');
      res.status(404).send('Session not found');
    };

    // Cleanup de sesiones inactivas (cada 5 min)
    setInterval(() => {
      const now = Date.now();
      for (const [id, transport] of sessions) {
        if (transport.sessionId && (now - (transport._lastActivity || now)) > 300000) {
          logger.info({ sessionId: id }, 'Removing inactive session');
          sessions.delete(id);
        }
      }
    }, 300000);

    app.get('/sse', route);
    app.post('/sse', route);
    app.delete('/sse', route);
    app.post('/message', route);

    app.listen(port, () => {
      logger.info(`Starting MCP Server (Streamable HTTP) on http://0.0.0.0:${port}`);
      logger.info(`Agents in your LAN can connect to: http://<YOUR_IP>:${port}/sse`);
    });
  }
}
