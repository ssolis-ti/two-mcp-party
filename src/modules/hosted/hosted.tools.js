export function getHostedTools(service) {
  return [
    {
      name: 'bridge_spawn_conversation',
      description:
        'Launch an autonomous conversation between the hosted LiteLLM model-agents on the hub. ' +
        'Types: debate (each agent argues, last one moderates), review (producer -> reviewer -> producer refines), ' +
        'panel (each gives a take, first agent moderates), chain (each builds on the last). ' +
        'Consumes model credits on the LiteLLM router, so only run when explicitly requested.',
      schema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The subject the agents will discuss or produce.',
          },
          type: {
            type: 'string',
            enum: ['debate', 'review', 'panel', 'chain'],
            description: 'Conversation format. Default: debate.',
          },
          max_turns: {
            type: 'number',
            description: 'Hard cap on the number of model turn-calls. Default: 12.',
          },
          session_name: {
            type: 'string',
            description: 'Optional readable session name.',
          },
        },
        required: ['topic'],
      },
      handler: async (args) => {
        return service.spawnConversation(args);
      },
    },
    {
      name: 'bridge_list_models',
      description: 'List the hosted model-agents configured in this hub and the LiteLLM model backing each.',
      schema: { type: 'object', properties: {} },
      handler: async () => {
        return service.listModels();
      },
    },
    {
      name: 'bridge_hosted_status',
      description: 'Get the live status of all hosted conversations (which turn, state, participants).',
      schema: { type: 'object', properties: {} },
      handler: async () => {
        return service.status();
      },
    },
  ];
}
