import { CONSTRAINT_STATUS } from './constraints.ts';
import { severityRank, maxSeverity } from './severity.ts';
import { evaluateEvents, EVENT_STATUS } from './events.ts';

// HEALTH ENGINE — règles documentées et déterministes.
// Score = 100 − pénalités, borné à [0,100]. Deux calculs sur le même monde donnent le même résultat.
export const HEALTH_RULES = [
  { key: 'critical_violations', label: 'Contrainte critique violée', weight: 20 },
  { key: 'high_issues', label: 'Contrainte/conflit de niveau HIGH', weight: 10 },
  { key: 'medium_issues', label: 'Conflit de niveau MEDIUM', weight: 5 },
  { key: 'unknowns', label: 'Information manquante (UNKNOWN)', weight: 3 },
  { key: 'unconfirmed_vendors', label: 'Prestataire non confirmé', weight: 4 },
  { key: 'pending_scenarios', label: 'Décision en attente', weight: 2 },
];

export function computeHealth({ evaluations = [], conflicts = [], entities = [], scenarios = [], relations = [], blocks = [] }) {
  // Event Health : dérivé du même World, jamais d'un statut stocké à part.
  const events = evaluateEvents({ entities, relations, blocks });
  const violated = evaluations.filter((e) => e.status === CONSTRAINT_STATUS.VIOLATED);
  const counts = {
    critical_violations: violated.filter((e) => severityRank(e.severity) >= 4).length +
      conflicts.filter((c) => severityRank(c.severity) >= 4).length,
    high_issues: violated.filter((e) => severityRank(e.severity) === 3).length +
      conflicts.filter((c) => severityRank(c.severity) === 3).length,
    medium_issues: violated.filter((e) => severityRank(e.severity) <= 2).length +
      conflicts.filter((c) => severityRank(c.severity) <= 2).length,
    unknowns: evaluations.filter((e) => e.status === CONSTRAINT_STATUS.UNKNOWN).length,
    unconfirmed_vendors: entities.filter((e) => e.entity_type === 'vendor' && e.status !== 'confirmed').length,
    pending_scenarios: scenarios.filter((s) => s.status === 'draft').length,
  };

  const penalty = HEALTH_RULES.reduce((sum, r) => sum + counts[r.key] * r.weight, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const levelOf = (n, sev) => (n > 0 ? sev : 'INFO');
  const dims = [
    { label: 'Contraintes', level: maxSeverity([levelOf(counts.critical_violations, 'CRITICAL'), levelOf(counts.high_issues, 'HIGH')]), count: counts.critical_violations + counts.high_issues },
    { label: 'Collisions temporelles', level: levelOf(conflicts.length, maxSeverity(conflicts.map((c) => c.severity))), count: conflicts.length },
    { label: 'Informations manquantes', level: levelOf(counts.unknowns, 'MEDIUM'), count: counts.unknowns },
    { label: 'Prestataires', level: levelOf(counts.unconfirmed_vendors, 'LOW'), count: counts.unconfirmed_vendors },
    { label: 'Décisions en attente', level: levelOf(counts.pending_scenarios, 'LOW'), count: counts.pending_scenarios },
  ];
  const eventIssues = events.filter((e) => e.status !== EVENT_STATUS.READY);
  if (events.length) {
    dims.push({
      label: 'Événements',
      level: levelOf(eventIssues.length, maxSeverity(eventIssues.map((e) => e.severity))),
      count: eventIssues.length,
    });
  }

  return {
    score,
    penalty,
    counts,
    dims,
    events,
    conflicts,
    attention: counts.critical_violations + counts.high_issues + counts.medium_issues + counts.unknowns + counts.unconfirmed_vendors + counts.pending_scenarios,
    computed_at: new Date().toISOString(),
  };
}