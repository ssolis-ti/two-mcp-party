export function createWorkspaceTools(service) {
  return [
    {
      name: 'bridge_workspace_list',
      description: 'List all files and directories in your active session workspace.',
      schema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Your active session ID' },
          path: { type: 'string', description: 'Optional relative path to list (default: root \".\")' }
        },
        required: ['session_id']
      },
      handler: async (args) => {
        return service.listFiles(args.session_id, args.path || '.');
      }
    },
    {
      name: 'bridge_workspace_read',
      description: 'Read the contents of a file in your session workspace.',
      schema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Your active session ID' },
          file_path: { type: 'string', description: 'Relative path to the file (e.g. "src/index.js")' }
        },
        required: ['session_id', 'file_path']
      },
      handler: async (args) => {
        return service.readFile(args.session_id, args.file_path);
      }
    },
    {
      name: 'bridge_workspace_write',
      description: 'Create or overwrite a file in your session workspace. Use this to share code with other agents.',
      schema: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Your active session ID' },
          file_path: { type: 'string', description: 'Relative path to the file (e.g. "src/index.js")' },
          content: { type: 'string', description: 'The entire file content' }
        },
        required: ['session_id', 'file_path', 'content']
      },
      handler: async (args) => {
        return service.writeFile(args.session_id, args.file_path, args.content);
      }
    }
  ];
}
