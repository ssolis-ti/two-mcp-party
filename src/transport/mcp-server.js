import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
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
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
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

    // 2. List Resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const docsPath = path.join(process.cwd(), 'agent-manual');
        const files = await fs.readdir(docsPath);
        
        const resources = files
          .filter(file => file.endsWith('.md'))
          .map(file => ({
            uri: `file:///agent-manual/${file}`,
            name: file,
            mimeType: 'text/markdown',
            description: `AgentBridge Documentation: ${file}`
          }));

        return { resources };
      } catch (err) {
        logger.error({ err }, 'Failed to list docs resources');
        return { resources: [] };
      }
    });

    // 3. Read Resource
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      if (!uri.startsWith('file:///agent-manual/')) {
        throw new Error(`Invalid resource URI: ${uri}`);
      }

      const filename = uri.replace('file:///agent-manual/', '');
      const docsPath = path.join(process.cwd(), 'agent-manual');
      const absolutePath = path.resolve(docsPath, filename);

      // Path traversal check
      if (!absolutePath.startsWith(docsPath)) {
        throw new Error('Access denied: Invalid resource path');
      }

      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: content
            }
          ]
        };
      } catch (err) {
        throw new Error(`Failed to read resource ${filename}: ${err.message}`);
      }
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
    app.use(express.json());
    const { randomUUID } = await import('node:crypto');
    const transportSessions = new Map();

    // === PUSH NOTIFICATIONS (SSE) ===
    const sseClients = new Map(); // Store Map of res -> agentName
    app.get('/api/events', (req, res) => {
      const agentName = req.query.agent || 'unknown';
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({ type: 'connected', agent: agentName })}\n\n`);
      sseClients.set(res, agentName);
      req.on('close', () => sseClients.delete(res));
    });

    this.engine.eventBus.on('message:new', (msg) => {
      const payload = JSON.stringify({ type: 'message', data: msg });
      
      try {
        const sessionAgents = this.engine.db.prepare('SELECT name FROM agents WHERE current_session_id = ?').all(msg.session_id).map(r => r.name);
        sseClients.forEach((agentName, client) => {
          // Broadcast to unknown clients (legacy), OR to clients in the session EXCEPT the sender
          if (agentName === 'unknown' || (sessionAgents.includes(agentName) && agentName !== msg.from)) {
            client.write(`data: ${payload}\n\n`);
          }
        });
      } catch (err) {
        // Fallback blind broadcast if something fails
        sseClients.forEach((_, client) => client.write(`data: ${payload}\n\n`));
      }
    });
    // ================================

    // === IP RATE LIMITING ===
    const ipRequests = new Map();
    setInterval(() => ipRequests.clear(), 60000); // Clear map every 60 seconds

    app.use((req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const count = ipRequests.get(ip) || 0;
      if (count > 200) {
        logger.warn({ ip }, 'Rate limit exceeded');
        return res.status(429).send('Too Many Requests');
      }
      ipRequests.set(ip, count + 1);
      next();
    });

    const route = async (req, res) => {
      const sessionId = req.query.sessionId || req.headers['mcp-session-id'] || req.headers['sessionid'];
      
      if (sessionId && transportSessions.has(sessionId)) {
        const activeTransport = transportSessions.get(sessionId);
        activeTransport._lastActivity = Date.now();
        await activeTransport.handleRequest(req, res, req.body);
        return;
      }
      
      if (!sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transport._lastActivity = Date.now();
            transportSessions.set(id, transport);
            logger.info({ sessionId: id }, 'Created new transport session');
          }
        });
        
        transport.onclose = () => {
          if (transport.sessionId) {
            logger.info({ sessionId: transport.sessionId }, 'Client transport closed (HTTP request finished)');
            // Fix: No eliminar aquí, ya que MCP v2 llama a onclose tras CADA request (GET/POST)
            // transportSessions.delete(transport.sessionId);
          }
        };

        const clientServer = this.createServerInstance();
        await clientServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      logger.warn({ requestedSessionId: sessionId, activeSessions: Array.from(transportSessions.keys()) }, 'Received POST for unknown session');
      res.status(404).send('Session not found');
    };

    // DPD Proactivo (cada 30s)
    setInterval(() => {
      try {
        const activeSessions = this.engine.db.prepare("SELECT id, current_turn FROM sessions WHERE status = 'active' AND current_turn IS NOT NULL").all();
        for (const session of activeSessions) {
          const owner = this.engine.db.prepare('SELECT status FROM agents WHERE name = ?').get(session.current_turn);
          if (!owner || owner.status === 'offline') {
            logger.info({ sessionId: session.id, agent: session.current_turn }, 'Proactive DPD: Reclaiming token from offline agent');
            this.engine.db.prepare('UPDATE sessions SET current_turn = NULL WHERE id = ?').run(session.id);
          }
        }
      } catch (e) {
        logger.error({ err: e.message }, 'Proactive DPD failed');
      }
    }, 30000);

    // Cleanup de sesiones inactivas de transporte HTTP (cada 2 min)
    setInterval(() => {
      const now = Date.now();
      for (const [id, transport] of transportSessions) {
        if (transport.sessionId && (now - (transport._lastActivity || now)) > 120000) {
          logger.info({ sessionId: id }, 'Removing inactive HTTP transport session');
          transportSessions.delete(id);
        }
      }
    }, 120000);

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
