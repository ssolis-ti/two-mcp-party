/**
 * Orchestrator: decides *who* speaks next, *with what system prompt*, and
 * *when a conversation is done*. Pure logic — no I/O. Kept separate from the
 * service so the scheduling rules are easy to test and extend.
 *
 * Conversation types:
 *   - debate      : topic-driven, each agent argues from its role, chair closes.
 *   - panel       : each agent gives its take, then they react to each other.
 *   - review      : "producer" submits work, "critics" review, producer refines.
 *   - chain       : each agent sees the previous output and adds a layer.
 *
 * A conversation is driven by a fixed turn plan (array of {agent, stage}).
 * We do NOT let the LLM decide who speaks next (that would hang on free-form
 * tool calls); we schedule deterministically and only let the LLM produce text.
 */

const SYSTEM_PROMPTS = {
  analyst: (topic) =>
    `You are ANALYST, a rigorous analyst. Your job is to provide a precise, evidence-driven analysis on the topic: "${topic}". Structure your response with clear sections and concrete judgment. Keep it under 250 words. Do not greet others. Deliver only your analysis.`,

  critic: (topic) =>
    `You are CRITIC, a tough, constructive reviewer. Look for gaps, weak assumptions, and risks in what your colleagues say about: "${topic}". Your criticism must be specific and actionable. Under 200 words. Do not repeat what was already said.`,

  author: (topic) =>
    `You are AUTHOR, a creative and accurate writer. Produce a strong, well-organized piece on: "${topic}". Be original and precise. Under 250 words.`,

  solver: (topic) =>
    `You are SOLVER, a practical problem-solver. Give the most effective, implementable solution for: "${topic}". Under 200 words.`,

  moderator: (topic) =>
    `You are MODERATOR. You have listened to the panel discussing: "${topic}". Synthesize the strongest points, reconcile disagreements, and give a concise final verdict with next steps. Under 200 words.`,

  reviewer: (topic) =>
    `You are REVIEWER. Review the output your colleague just produced on: "${topic}". Check correctness, clarity, completeness and reproducibility. List concrete improvements as numbered points. Under 250 words.`,

  refiner: (topic) =>
    `You are REFINER. Your colleague's draft on "${topic}" has been critiqued by a reviewer. Produce the improved final version incorporating that feedback. Under 300 words.`,

  builder: (topic) =>
    `You are BUILDER. Continue building on the previous contribution about "${topic}". Add genuine value: new insight, a concrete implementation, or a worked example. Do not restate. Under 250 words.`,
};

function defaultRolesFor(type, agentNames) {
  // agentNames: the registered model-agents participating, in order.
  switch (type) {
    case 'debate':
      // agent[0] = analyst-ish speaker, ..., last agent = moderator
      if (agentNames.length === 1) return [['moderator', { closes: true }]];
      if (agentNames.length <= 3) {
        const roles = agentNames.slice(0, -1).map(() => 'analyst');
        return [...roles.map((r, i) => [agentNames[i], { role: r, closes: false }]),
                [agentNames[agentNames.length - 1], { role: 'moderator', closes: true }]];
      }
      return [
        ...agentNames.slice(0, -1).map((name, i) => {
          const role = i === 0 ? 'author' : i % 2 === 1 ? 'critic' : 'solver';
          return [name, { role, closes: false }];
        }),
        [agentNames[agentNames.length - 1], { role: 'moderator', closes: true }],
      ];
    default:
      return agentNames.map((name) => [name, { role: 'analyst', closes: false }]);
  }
}

/** Default participant model-role seed per conversation type. */
export function defaultParticipants() {
  return [
    { name: 'producer', role: 'author',  model: 'qwen3-coder' },
    { name: 'peer1',    role: 'reviewer', model: 'deepseek-v4-pro' },
    { name: 'peer2',    role: 'critic',   model: 'glm-5.1' },
    { name: 'chair',    role: 'moderator', model: 'nemotron-3-super' },
  ];
}

export class Orchestrator {
  constructor() {
    this.systemPromptFor = (role, topic) =>
      SYSTEM_PROMPTS[role]?.(topic) || SYSTEM_PROMPTS.analyst(topic);
  }

  /**
   * Build a deterministic turn plan for a conversation.
   * @param {string} type - debate | review | panel | chain
   * @param {string[]} agentNames - the model-agents, in order of participation.
   * @returns {Array<{agent:string, role:string, closes?:boolean}>}
   */
  buildPlan(type, agentNames) {
    if (!type || !agentNames?.length) throw new Error('buildPlan requires type and at least one agent name');
    const lower = String(type).toLowerCase();

    switch (lower) {
      case 'review': {
        // producer -> reviewer(s) -> producer(refine)
        if (agentNames.length < 2) throw new Error('review type needs at least 2 agents (producer + reviewer)');
        const [producer, ...reviewers] = agentNames;
        const plan = [[producer, { role: 'author', closes: false }]];
        reviewers.forEach((r) => plan.push([r, { role: 'reviewer', closes: false }]));
        plan.push([producer, { role: 'refiner', closes: true }]);
        return plan;
      }
      case 'chain': {
        return agentNames.map((name, i) => [
          name,
          { role: i === 0 ? 'author' : 'builder', closes: i === agentNames.length - 1 },
        ]);
      }
      case 'panel': {
        const plan = agentNames.map((name, i) => [
          name,
          { role: 'analyst', closes: false },
        ]);
        plan.push([agentNames[0], { role: 'moderator', closes: true }]);
        return plan;
      }
      case 'debate':
      default:
        return defaultRolesFor('debate', agentNames);
    }
  }

  /**
   * Build the full message array sent to LiteLLM for one agent's turn.
   * System = role prompt + meta-rules. History = prior turns (trimmed).
   * @param {object} o { plan, planIndex, history, topic }
   * @returns {{agent, role, closes, messages}}
   */
  buildTurnMessage({ plan, planIndex, history, topic }) {
    const step = plan[planIndex];
    const role = step.role;
    const system = this.systemPromptFor(role, topic);

    const messages = [{ role: 'system', content: system }];

    // Inject the transcript of prior turns so the agent has context.
    const prior = history.slice(0, planIndex);
    for (const h of prior) {
      messages.push({ role: 'user', content: `[${h.agent}] ${h.content}` });
    }
    if (prior.length === 0) {
      messages.push({ role: 'user', content: `Topic: ${topic}\nBegin your ${role} view.` });
    } else {
      messages.push({ role: 'user', content: `Now respond as ${role}.` });
    }

    return { agent: step.agent, role, closes: !!step.closes, messages };
  }
}
