// Vocabulaire canonique et ordonné des sévérités. Aucun module ne doit en créer un autre.
export const SEVERITY = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
export const SEVERITY_ORDER = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function severityRank(level) {
  const v = SEVERITY[String(level || '').toUpperCase()];
  return typeof v === 'number' ? v : 0;
}

export function compareSeverity(a, b) {
  return severityRank(a) - severityRank(b);
}

export function maxSeverity(levels) {
  let best = 'INFO';
  for (const l of levels || []) if (compareSeverity(l, best) > 0) best = SEVERITY_ORDER[severityRank(l)];
  return best;
}

export function aggregateSeverity(levels) {
  const counts = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const l of levels || []) counts[SEVERITY_ORDER[severityRank(l)]] += 1;
  return { level: maxSeverity(levels), counts, total: (levels || []).length };
}

export function isCritical(level) {
  return severityRank(level) >= SEVERITY.CRITICAL;
}

export function downgrade(level, steps = 1) {
  return SEVERITY_ORDER[Math.max(0, severityRank(level) - steps)];
}

// Migration : anciens vocabulaires -> vocabulaire canonique.
const LEGACY = {
  critical: 'CRITICAL', important: 'HIGH', minor: 'MEDIUM', none: 'INFO',
  weak: 'LOW', warning: 'MEDIUM', info: 'INFO',
};

export function normalizeSeverity(value) {
  if (!value) return 'INFO';
  const up = String(value).toUpperCase();
  if (SEVERITY_ORDER.includes(up)) return up;
  return LEGACY[String(value).toLowerCase()] || 'INFO';
}

// Sévérité d'une contrainte (Constraint.severity : critical | important | minor)
export function severityFromConstraint(constraint) {
  return normalizeSeverity(constraint && constraint.severity);
}

// Sévérité d'une relation (WorldRelation.strength : critical | important | weak)
export function severityFromStrength(strength) {
  if (strength === 'critical') return 'HIGH';
  if (strength === 'weak') return 'LOW';
  return 'MEDIUM';
}