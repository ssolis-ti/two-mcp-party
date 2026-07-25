export function getSessionsTools(service) {
  return [
    {
      name: 'bridge_create_session',
      description: 'Create a new working session with a conversation mode. Modes: autopilot (limited turns), moderator (human participates), free (goal-driven with checkpoints).',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the session (e.g. Frontend Debugging)' },
          mode: {
            type: 'string',
            enum: ['autopilot', 'moderator', 'free'],
            description: 'Conversation mode. autopilot=limited turns with cooldown, moderator=human participates (default), free=goal-driven with checkpoints'
          },
          mode_config: {
            type: 'object',
            description: 'Mode-specific config. autopilot: {max_turns: number, cooldown_seconds: number}. free: {goals: string[]}. moderator: {} (no config needed)'
          },
          metadata: { type: 'object', description: 'Extra context like tags or description' }
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
      name: 'bridge_session_status',
      description: 'Get detailed status of a session: mode, turn count, turns remaining, current goal, participants. Use this to check rules before sending messages.',
      schema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'The session ID to check' }
        },
        required: ['session_id']
      },
      handler: async (args) => {
        return service.getSessionStatus(args.session_id);
      }
    },
    {
      name: 'bridge_complete_goal',
      description: 'Mark the current goal as completed (free mode only). The session enters checkpoint status and waits for human approval via bridge_resume_session.',
      schema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'The session ID' },
          agent_name: { type: 'string', description: 'Your agent name' }
        },
        required: ['session_id', 'agent_name']
      },
      handler: async (args) => {
        return service.completeGoal(args.session_id, args.agent_name);
      }
    },
    {
      name: 'bridge_resume_session',
      description: 'Resume a session that is paused or at a checkpoint. Actions: continue (next goal), improve (retry current goal), pause (keep paused). Typically used by the human operator.',
      schema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'The session ID' },
          action: {
            type: 'string',
            enum: ['continue', 'improve', 'pause'],
            description: 'What to do: continue=advance to next goal, improve=retry current goal, pause=keep session paused'
          }
        },
        required: ['session_id', 'action']
      },
      handler: async (args) => {
        return service.resumeSession(args.session_id, args.action);
      }
    },
    {
      name: 'bridge_list_sessions',
      description: 'List all available sessions in the hub with their modes and statuses.',
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
