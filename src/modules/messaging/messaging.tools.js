export function getMessagingTools(service) {
  return [
    {
      name: 'bridge_send_message',
      description: 'Send a message to your active session. You must be in a session to send a message.',
      schema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Your agent name' },
          content: { type: 'string', description: 'The message content (Markdown supported)' },
          type: { 
            type: 'string', 
            description: 'Type of message (message, finding, question, answer)',
            default: 'message'
          },
          metadata: { type: 'object', description: 'Optional extra data' }
        },
        required: ['from', 'content']
      },
      handler: async (args, engine) => {
        return service.sendMessage(args);
      }
    },
    {
      name: 'bridge_get_messages',
      description: 'Read the chronological history of messages in your active session.',
      schema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Your agent name' },
          limit: { type: 'number', description: 'Max number of messages to retrieve', default: 50 }
        },
        required: ['agent_name']
      },
      handler: async (args, engine) => {
        return service.getMessages(args.agent_name, args.limit);
      }
    }
  ];
}
