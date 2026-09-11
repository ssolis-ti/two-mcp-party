export function getSwarmTools(service) {
  return [
    {
      name: 'bridge_swarm_plan',
      description:
        'La MENTE COLMENA produce un PLAN MAESTRO a partir de un objetivo: descompone en tareas ' +
        'accionables (con entregable, criterios de aceptación, dependencias y skills requeridos), ' +
        'cataloga skills faltantes y lo deja listo para que OTRAS LLM lo ejecuten. ' +
        'Esta herramienta NO ejecuta tareas: solo planifica, organiza y potencia skills.',
      schema: {
        type: 'object',
        properties: {
          objective: { type: 'string', description: 'El objetivo a descomponer en tareas (requerido).' },
          description: { type: 'string', description: 'Contexto adicional opcional.' },
        },
        required: ['objective'],
      },
      handler: async (args) => service.createPlan(args),
    },
    {
      name: 'bridge_swarm_plan_from_debate',
      description:
        'Crea un PLAN MAESTRO a partir del transcripto de un DEBATE REAL (bridge_spawn_conversation, ' +
        'type=debate). La deliberación ya ocurrió en el debate secuencial (los LLM se leyeron entre sí ' +
        'y puede incluir el aporte de Hermes); esta tool lo pasa al SINTETIZADOR para producir tareas, ' +
        'skills y riesgos, y persiste el plan + los aportes del debate. NO dispara deliberación nueva.',
      schema: {
        type: 'object',
        properties: {
          objective: { type: 'string', description: 'El objetivo del plan (requerido).' },
          description: { type: 'string', description: 'Contexto adicional opcional.' },
          debate_transcript: { type: 'string', description: 'Texto crudo completo del debate, por turno (requerido).' },
          contributions: {
            type: 'array',
            description: 'Aportes por turno del debate: [{model, role?, content}] para persistir en swarm_contributions.',
            items: { type: 'object' },
          },
        },
        required: ['objective', 'debate_transcript'],
      },
      handler: async (args) => service.createPlanFromDebate({
        objective: args.objective,
        description: args.description || '',
        debateTranscript: args.debate_transcript,
        contributions: Array.isArray(args.contributions) ? args.contributions : [],
      }),
    },
    {
      name: 'bridge_swarm_status',
      description: 'Lista los planes maestros creados por la mente colmena, con su estado.',
      schema: { type: 'object', properties: {} },
      handler: async () => service.listPlans(),
    },
    {
      name: 'bridge_swarm_tasks',
      description: 'Obtiene las hojas de tarea de un plan maestro (entregables, criterios, skills, dependencias) listas para ejecutar por otra LLM.',
      schema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'ID del plan maestro' },
        },
        required: ['plan_id'],
      },
      handler: async (args) => service.planStatus(args.plan_id),
    },
    {
      name: 'bridge_swarm_skills',
      description: 'Lista el catálogo de skills/capacidades de la mente colmena (conocidos y propuestos como faltantes).',
      schema: { type: 'object', properties: {} },
      handler: async () => service.listSkills(),
    },
    {
      name: 'bridge_swarm_contributions',
      description: 'Obtiene los APORTES INDIVIDUALES que cada modelo (kimi/glm/grok) aportó durante la deliberación de un plan maestro, retenidos en la tabla swarm_contributions para trazabilidad y auditoría.',
      schema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'ID del plan maestro' },
        },
        required: ['plan_id'],
      },
      handler: async (args) => service.listContributions(args.plan_id),
    },
    {
      name: 'bridge_swarm_disputes',
      description:
        'Lista o resuelve el DISENSO de un plan maestro: objeciones donde un angulo de la colmena ' +
        'invalido o contradijo lo que otro proponia, preservadas en vez de promediarse en la sintesis. ' +
        'Sin dispute_id devuelve las disputas del plan. Con dispute_id + resolution las resuelve ' +
        '(accion humana en el CHECKPOINT). Un "dismissed" exige que el rationale CITE TEXTUALMENTE ' +
        'una frase del claim; si no la cita, la disputa vuelve a "open". Un veto abierto de severidad ' +
        'critical bloquea bridge_materialize_plan.',
      schema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'ID del plan maestro' },
          dispute_id: { type: 'string', description: 'ID de la disputa a resolver (omitir para solo listar)' },
          resolution: { type: 'string', enum: ['open', 'accepted', 'dismissed'], description: 'Nueva resolucion' },
          rationale: { type: 'string', description: 'Justificacion. Obligatoria si resolution es "dismissed", y debe citar el claim.' },
        },
        required: ['plan_id'],
      },
      handler: async (args) =>
        args.dispute_id
          ? service.resolveDispute(args)
          : service.listDisputes(args.plan_id),
    },
    {
      name: 'bridge_swarm_mark_done',
      description: 'Registra que una tarea del plan fue ejecutada por una LLM externa (el hub solo actualiza el estado; no ejecuta la tarea).',
      schema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'ID de la tarea' },
          result_ref: { type: 'string', description: 'Referencia/resumen opcional del resultado' },
        },
        required: ['task_id'],
      },
      handler: async (args) => service.markTaskDone(args.task_id, args.result_ref || null),
    },
    {
      name: 'bridge_swarm_improve',
      description:
        'Automimejora: analiza un plan (idealmente completado) y PROPONE el siguiente plan maestro ' +
        'para mejorar el sistema o el modelo de trabajo. Solo propone; no ejecuta.',
      schema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'ID del plan a analizar' },
        },
        required: ['plan_id'],
      },
      handler: async (args) => service.reflectAndImprove(args),
    },
  ];
}
