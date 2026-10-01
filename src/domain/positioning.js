// Vocabulary of the demonstrator's framing: agent families, competences and skills, five attributes of
// industrial-grade AI, and the three foundations an industrial AI decision rests on. Generic concepts, written for
// this demonstrator; each attribute is tied to where the demo shows it.

/** Agent families: each specialist agent belongs to one and holds one competence. */
export const COMPANIONS = Object.freeze({
  KNOW: { id: 'KNOW', line: 'Knowledge agents — work with enterprise and public knowledge and know-how', competences: ['Project Manager', 'Compliance Officer', 'Business Analyst', 'Risk Manager', 'Sourcing Manager'] },
  ENG: { id: 'ENG', line: 'Engineering agents — solve technical problems across engineering disciplines', competences: ['Mechanical Engineer', 'Material Engineer', 'System Engineer', 'Requirements Engineer'] },
  SCI: { id: 'SCI', line: 'Science agents — bring scientific knowledge to engineers and researchers', competences: ['Laboratory Analyst', 'Chemist', 'Microbiologist', 'Materials Scientist'] }
});

export const COMPETENCE_DEF = 'A competence is the ability to perform a job or role. It covers a whole domain and relies on more granular skills.';
export const SKILL_DEF = 'A skill is the ability to perform one task.';

/** A tool name such as calculateCoolingHeadroom, read as the skill it implements: "Calculate cooling headroom". */
export const skillName = tool => tool.replace(/([A-Z])/g, ' $1').trim().toLowerCase().replace(/^./, c => c.toUpperCase());

/** Five attributes of industrial-grade AI. `demo` says where this demonstrator shows it. */
export const ATTRIBUTES = Object.freeze([
  { id: 'transformative', claim: 'The value is not doing an existing task a little faster. It is being able to ask questions that were too expensive to ask before — on every decision, not only on the few worth an expert’s day.', word: 'Transformative', against: 'AI sold as productivity alone', demo: 'AI cheap and verifiable enough to run on every capacity decision, not only on the few worth an expert’s day.', page: 'economics' },
  { id: 'scientific', claim: 'Industrial decisions rest on physics, standards and accumulated know-how. Models reason; deterministic calculation and simulation produce the numbers, as a safeguard against approximation.', word: 'Scientific', against: 'generated numbers', demo: 'Every figure behind the decision comes from physics and site rules computed by deterministic tools; the model never does the arithmetic.', page: 'demo' },
  { id: 'actionable', claim: 'The question is not “do you have AI?” but “what does it change?”. The output is a decision with actions and owners, not a report.', word: 'Actionable', against: 'demos that end in a chat answer', demo: 'The run ends in a decision, four actions and one condition, approved by accountable people.', page: 'demo' },
  { id: 'open', claim: 'Use the best model for each task, connect other agents and models through open protocols, and keep everything grounded in the operator’s own data and models.', word: 'Open', against: 'the idea of one best AI for everything', demo: 'Open at the agent layer, and the best model for each task: large reasoning models where judgement is needed, small specialist models elsewhere.', page: 'learn' },
  { id: 'trusted', claim: 'An operator must know what the AI relied on, what it cost and who decided. Data, knowledge and AI stay controlled and traceable.', word: 'Trusted', against: 'black-box AI', demo: 'Every call, token and euro is recorded, every figure traceable to its source, the full trace exportable.', page: 'technical' }
]);

/** Three foundations of an industrial AI decision. */
export const IWM_PILLARS = Object.freeze([
  {
    id: 'knowledge', n: 1, title: 'Knowledge & know-how', tag: 'Industrial ground truth',
    source: 'Engineering standards, product and plant structure, processes and operating practice — the operator’s own know-how — together with real-world data: telemetry, production and quality metrics, maintenance records.',
    items: ['Domain knowledge', 'Operator know-how', 'Real-world data']
  },
  {
    id: 'understanding', n: 2, title: 'Physical understanding', tag: 'Science-grounded',
    source: 'A representation of the system that combines its structure with its physical behaviour: models, simulation, physics solvers and ontologies. Numbers come from these, so results stay physically valid.',
    items: ['System models (MBSE)', 'Physics & simulation', 'Structure + behaviour']
  },
  {
    id: 'reasoning', n: 3, title: 'Reasoning & planning', tag: 'Agentic reasoning',
    source: 'Goals are broken into coordinated tasks — retrieve, calculate, verify, optimise — carried out by specialised agents and checked against the first two foundations.',
    items: ['Knowledge retrieval', 'Multi-step planning', 'Exploration', 'Optimisation']
  }
]);

export const IWM_QUALITIES = Object.freeze(['Multi-modal', 'Semantic', 'Physics-aware', 'Knowledge-guided', 'Science-grounded', 'Traceable']);
