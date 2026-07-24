export function getDebuggerTools(service) {
  return [
    {
      name: 'bridge_debug_logs',
      description: 'DEV MODE: Read the last N lines of the AgentBridge server logs.',
      schema: {
        type: 'object',
        properties: {
          lines: { type: 'number', description: 'Number of lines to return', default: 100 }
        }
      },
      handler: async (args) => {
        return service.getLogs(args.lines);
      }
    },
    {
      name: 'bridge_debug_metrics',
      description: 'DEV MODE: Get system health, RAM, CPU, and DB metrics for the AgentBridge server.',
      schema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        return service.getSystemMetrics();
      }
    },
    {
      name: 'bridge_debug_read_source',
      description: 'DEV MODE: Read the source code files of AgentBridge (restricted to src/ folder) to propose fixes.',
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to read (e.g. core/engine.js)' }
        },
        required: ['path']
      },
      handler: async (args) => {
        return service.readSourceFile(args.path);
      }
    }
  ];
}
