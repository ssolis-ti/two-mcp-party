export function getTasksTools(service, db) {
  return [
    {
      name: 'bridge_publish_task',
      description: 'Publish a new task to the marketplace for other agents to claim.',
      schema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Name of the agent publishing the task' },
          description: { type: 'string', description: 'Description of the task to be done' }
        },
        required: ['agent_name', 'description']
      },
      handler: async (args, engine) => {
        const agent = db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(args.agent_name);
        if (!agent || !agent.current_session_id) {
          throw new Error('You must join a session to publish a task.');
        }
        return service.publishTask(args.agent_name, agent.current_session_id, args.description);
      }
    },
    {
      name: 'bridge_list_tasks',
      description: 'List all open tasks in the current session.',
      schema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Name of your agent' }
        },
        required: ['agent_name']
      },
      handler: async (args, engine) => {
        const agent = db.prepare('SELECT current_session_id FROM agents WHERE name = ?').get(args.agent_name);
        if (!agent || !agent.current_session_id) {
          throw new Error('You must join a session to list tasks.');
        }
        return service.listTasks(agent.current_session_id);
      }
    },
    {
      name: 'bridge_claim_task',
      description: 'Claim an open task to work on it.',
      schema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Name of your agent' },
          task_id: { type: 'string', description: 'ID of the task to claim' }
        },
        required: ['agent_name', 'task_id']
      },
      handler: async (args, engine) => {
        return service.claimTask(args.agent_name, args.task_id);
      }
    }
  ];
}
