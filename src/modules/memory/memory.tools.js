export function getMemoryTools(service) {
  return [
    {
      name: 'bridge_share_memory',
      description: 'Store some data in the shared memory space so other agents can read it.',
      schema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Logical grouping (e.g., project_two_context)', default: 'global' },
          key: { type: 'string', description: 'The identifier for this data' },
          value: { type: 'string', description: 'The data to store (can be JSON stringified)' },
          agent: { type: 'string', description: 'Your agent name (to know who wrote it)' }
        },
        required: ['key', 'value']
      },
      handler: async (args, engine) => {
        return service.shareMemory(args);
      }
    },
    {
      name: 'bridge_get_memory',
      description: 'Read data from the shared memory space.',
      schema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Logical grouping to read from', default: 'global' },
          key: { type: 'string', description: 'Specific key to read. If omitted, returns all keys in namespace.' }
        }
      },
      handler: async (args, engine) => {
        return service.getMemory(args.namespace, args.key);
      }
    }
  ];
}
