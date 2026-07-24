export function getAgentsTools(service) {
  return [
    {
      name: 'bridge_register',
      description: 'Register yourself in the AgentBridge network so other agents can see you.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Your unique agent name (e.g., antigravity, hermes)' },
          type: { type: 'string', description: 'Type of agent (e.g., ide, terminal, gateway)' },
          description: { type: 'string', description: 'Brief description of what you do' },
          capabilities: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of your specific capabilities'
          }
        },
        required: ['name']
      },
      handler: async (args, engine) => {
        return service.registerAgent(args);
      }
    },
    {
      name: 'bridge_list_agents',
      description: 'Get a list of all connected agents in the network and their statuses.',
      schema: {
        type: 'object',
        properties: {}
      },
      handler: async (args, engine) => {
        return service.listAgents();
      }
    },
    {
      name: 'bridge_heartbeat',
      description: 'Ping the server to let it know you are still online. Call this periodically.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Your unique agent name' }
        },
        required: ['name']
      },
      handler: async (args, engine) => {
        return service.heartbeat(args.name);
      }
    }
  ];
}
