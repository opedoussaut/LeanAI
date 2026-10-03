// Governance — explicit decision states. Agents can only PROPOSE; deterministic validation decides whether a plan may
// go to a person; only an engineer can clear an engineering review; only a person can approve. Execution is simulated.
export const STATES = ['PROPOSED', 'AWAITING_HUMAN_APPROVAL', 'ENGINEERING_REVIEW_REQUIRED', 'ENGINEERING_VALIDATED', 'APPROVED', 'REJECTED', 'EXECUTED_SIMULATED'];
export const LABEL = { PROPOSED: 'PROPOSED', AWAITING_HUMAN_APPROVAL: 'AWAITING HUMAN APPROVAL', ENGINEERING_REVIEW_REQUIRED: 'ENGINEERING REVIEW REQUIRED', ENGINEERING_VALIDATED: 'ENGINEERING VALIDATED', APPROVED: 'APPROVED', REJECTED: 'REJECTED', EXECUTED_SIMULATED: 'EXECUTED (SIMULATED)' };
export const ACTORS = { agent: 'AI (agents)', validator: 'Deterministic validation', engineer: 'Engineering (person)', approver: 'Operations manager (person)', system: 'Enterprise systems (simulated)' };

/** Allowed transitions: [from, event] → { to, actor }. Anything else throws. */
const T = {
  'PROPOSED:validated_ok': { to: 'AWAITING_HUMAN_APPROVAL', actor: 'validator' },
  'PROPOSED:validated_engineering': { to: 'ENGINEERING_REVIEW_REQUIRED', actor: 'validator' },
  'PROPOSED:validated_invalid': { to: 'REJECTED', actor: 'validator' },
  'ENGINEERING_REVIEW_REQUIRED:engineering_validate': { to: 'ENGINEERING_VALIDATED', actor: 'engineer' },
  'ENGINEERING_REVIEW_REQUIRED:engineering_reject': { to: 'PROPOSED', actor: 'engineer' },
  'ENGINEERING_VALIDATED:submit': { to: 'AWAITING_HUMAN_APPROVAL', actor: 'validator' },
  'AWAITING_HUMAN_APPROVAL:approve': { to: 'APPROVED', actor: 'approver' },
  'AWAITING_HUMAN_APPROVAL:reject': { to: 'REJECTED', actor: 'approver' },
  'APPROVED:execute': { to: 'EXECUTED_SIMULATED', actor: 'system' }
};

export function createDecision() {
  const d = { state: 'PROPOSED', history: [{ state: 'PROPOSED', actor: 'agent', at: 0, note: 'Recovery plan proposed by the specialists' }], validation: null, engineering: null, approval: null };
  d.apply = (event, { actor, note = '', validation = null, engineering = null } = {}) => {
    const rule = T[`${d.state}:${event}`];
    if (!rule) throw new Error(`Transition not allowed: ${d.state} → ${event}`);
    if (rule.actor !== actor) throw new Error(`${ACTORS[actor] ?? actor} cannot perform "${event}" (requires ${ACTORS[rule.actor]})`);
    if (event === 'validated_ok' && validation?.verdict !== 'VALID') throw new Error('Validation verdict is not VALID');
    if (event === 'validated_engineering' && validation?.verdict !== 'ENGINEERING_REVIEW') throw new Error('Validation verdict is not ENGINEERING_REVIEW');
    if (event === 'validated_invalid' && validation?.verdict !== 'INVALID') throw new Error('Validation verdict is not INVALID');
    if (validation) d.validation = validation;
    if (engineering) d.engineering = engineering;
    if (event === 'approve') d.approval = { actor, note };
    d.state = rule.to;
    d.history.push({ state: rule.to, event, actor, note });
    return d;
  };
  /** Feed a validation result: the verdict alone decides the next state. */
  d.validate = validation => d.apply(validation.verdict === 'VALID' ? 'validated_ok' : validation.verdict === 'ENGINEERING_REVIEW' ? 'validated_engineering' : 'validated_invalid', { actor: 'validator', validation, note: `${validation.checks.filter(c => c.ok).length}/${validation.checks.length} checks passed` });
  return d;
}
