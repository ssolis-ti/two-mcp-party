import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
    logger.info('Starting MCP Server (stdio transport)...');
    
    // Por defecto usamos STDIO (standard input/output)
    // Es el más compatible para que agentes locales se conecten
    const transport = new StdioServerTransport();
    
    await this.server.connect(transport);
    logger.info('MCP Server running and ready for agents');
  }
}
