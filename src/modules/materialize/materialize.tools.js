export function getMaterializeTools(service) {
  return [
    {
      name: 'bridge_materialize_plan',
      description:
        'Materializa un plan maestro de la mente colmena (puente swarm -> sesión MCP real): ' +
        'registra al orquestador, crea una sesión free con los goals del plan, comparte memoria ' +
        'de contexto rico (skills faltantes + decisiones), publica cada tarea como ticket y ' +
        'emite un mensaje de handoff. Así el plan deja de ser una isla SQLite y entra al canal ' +
        'colaborativo nativo del harness (messaging/memory/tasks) listo para que el orquestador lo ejecute.',
      schema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'ID del plan maestro de la mente colmena (de bridge_swarm_status).' },
          orchestrator_name: {
            type: 'string',
            description: 'Nombre del agente orquestador que registra/materializa. Default: hermes-orchestrator.',
          },
        },
        required: ['plan_id'],
      },
      handler: async (args) => service.materializePlan(args),
    },
    {
      name: 'bridge_materialize_status',
      description: 'Lista los planes maestros disponibles en la mente colmena y su estado (para saber cuál materializar).',
      schema: { type: 'object', properties: {} },
      handler: async () => {
        const rows = service.db.prepare('SELECT id, objective, status FROM swarm_plans ORDER BY created_at DESC').all();
        return rows.map((r) => ({
          id: r.id,
          objective: r.objective ? r.objective.slice(0, 160) : '',
          status: r.status,
        }));
      },
    },
  ];
}
