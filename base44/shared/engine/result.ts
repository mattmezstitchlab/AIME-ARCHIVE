// Types de résultat causal — structurels, jamais textuels. Le LLM ne peut pas les produire.
export const RESULT = {
  NO_IMPACT: 'NO_IMPACT',
  IMPACT: 'IMPACT',
  UNKNOWN: 'UNKNOWN',
  CONFLICT: 'CONFLICT',
  BLOCKED: 'BLOCKED',
};

export function noImpact(reason) {
  return { type: RESULT.NO_IMPACT, reason: reason || 'Aucune conséquence détectée.' };
}

export function impact(payload) {
  return { type: RESULT.IMPACT, ...payload };
}

export function unknown(reason, requiredInformation = []) {
  return { type: RESULT.UNKNOWN, reason, required_information: requiredInformation };
}

export function conflict(payload) {
  return { type: RESULT.CONFLICT, ...payload };
}

export function blocked(reason, blockers = [], payload = {}) {
  return { type: RESULT.BLOCKED, reason, blockers, ...payload };
}