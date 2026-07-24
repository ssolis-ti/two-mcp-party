export function getMessagingTools(service) {
  return [
    {
      name: 'bridge_send_message',
      description: 'Send a message or finding to a specific agent.',
      schema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Your agent name' },
          to: { type: 'string', description: 'The target agent name' },
          content: { type: 'string', description: 'The message content (Markdown supported)' },
          type: { 
            type: 'string', 
            description: 'Type of message (message, finding, question, answer)',
            default: 'message'
          },
          metadata: { type: 'object', description: 'Optional extra data' }
        },
        required: ['from', 'to', 'content']
      },
      handler: async (args, engine) => {
        return service.sendMessage(args);
      }
    },
    {
      name: 'bridge_broadcast',
      description: 'Send a message to ALL connected agents simultaneously.',
      schema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Your agent name' },
          content: { type: 'string', description: 'The message content' },
          type: { type: 'string', default: 'message' }
        },
        required: ['from', 'content']
      },
      handler: async (args, engine) => {
        // En broadcast, to es null
        return service.sendMessage({ ...args, to: null });
      }
    },
    {
      name: 'bridge_get_messages',
      description: 'Read the latest messages sent to you or broadcasted to everyone.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Your agent name' },
          limit: { type: 'number', description: 'Max number of messages to retrieve', default: 50 }
        },
        required: ['name']
      },
      handler: async (args, engine) => {
        return service.getMessages(args.name, args.limit);
      }
    }
  ];
}
