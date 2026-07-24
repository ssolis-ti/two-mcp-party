export function getSessionsTools(service) {
  return [
    {
      name: 'bridge_create_session',
      description: 'Create a new working session (room) for a specific task.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the session (e.g. Frontend Debugging)' },
          metadata: { type: 'object', description: 'Extra context like goal or tags' }
        },
        required: ['name']
      },
      handler: async (args) => {
        return service.createSession(args);
      }
    },
    {
      name: 'bridge_join_session',
      description: 'Join an active session. All your subsequent messages/memory will route here.',
      schema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Your agent name' },
          session_id: { type: 'string', description: 'The ID of the session to join' }
        },
        required: ['agent_name', 'session_id']
      },
      handler: async (args) => {
        return service.joinSession(args.agent_name, args.session_id);
      }
    },
    {
      name: 'bridge_leave_session',
      description: 'Leave the current session. You return to the global lobby.',
      schema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Your agent name' }
        },
        required: ['agent_name']
      },
      handler: async (args) => {
        return service.leaveSession(args.agent_name);
      }
    },
    {
      name: 'bridge_list_sessions',
      description: 'List all available sessions in the hub.',
      schema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        return service.listSessions();
      }
    }
  ];
}
