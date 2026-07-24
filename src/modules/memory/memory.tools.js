export function getMemoryTools(service) {
  return [
    {
      name: 'bridge_share_memory',
      description: 'Store some data in the shared memory space of your current session.',
      schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The identifier for this data' },
          value: { type: 'string', description: 'The data to store (can be JSON stringified)' },
          agent: { type: 'string', description: 'Your agent name' }
        },
        required: ['key', 'value', 'agent']
      },
      handler: async (args, engine) => {
        return service.shareMemory(args);
      }
    },
    {
      name: 'bridge_get_memory',
      description: 'Read data from the shared memory space of your current session.',
      schema: {
        type: 'object',
        properties: {
          agent: { type: 'string', description: 'Your agent name' },
          key: { type: 'string', description: 'Specific key to read. If omitted, returns all keys in the session.' }
        },
        required: ['agent']
      },
      handler: async (args, engine) => {
        return service.getMemory(args.agent, args.key);
      }
    }
  ];
}
