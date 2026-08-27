import { toWorldMinutes, blockInterval, parseTime } from './time.ts';
import { severityFromConstraint } from './severity.ts';
import { isSocialConstraint, evaluateSocialConstraint } from './social.ts';
import { isResourceConstraint, evaluateResourceConstraint } from './resources.ts';

export const CONSTRAINT_STATUS = {
  SATISFIED: 'satisfied',
  VIOLATED: 'violated',
  UNKNOWN: 'unknown',
  BLOCKED: 'blocked',
};

// Bloc de référence d'une entité : le premier bloc de la journée.
export function primaryBlock(entityId, blocks) {
  const own = blocks.filter((b) => b.entity_id === entityId && b.start_time);
  if (!own.length) return null;
  return own.slice().sort((a, b) => toWorldMinutes(a.start_time) - toWorldMinutes(b.start_time))[0];
}

// Évaluation déterministe d'une contrainte contre l'état réel (ou proposé) du monde.
export function evaluateConstraint(constraint, blocks, ctx = {}) {
  const severity = severityFromConstraint(constraint);
  // Contraintes humaines : même moteur, même vocabulaire de statut.
  if (isSocialConstraint(constraint.constraint_type)) {
    return evaluateSocialConstraint(constraint, ctx);
  }
  // Contraintes de ressources : même moteur, même vocabulaire de statut.
  if (isResourceConstraint(constraint.constraint_type)) {
    return evaluateResourceConstraint(constraint, { ...ctx, blocks });
  }
  const block = primaryBlock(constraint.entity_id, blocks);
  if (constraint.constraint_type === 'resource') {
    return { status: CONSTRAINT_STATUS.UNKNOWN, severity, detail: 'Contrainte de ressource non évaluable : information manquante.' };
  }
  if (!block) {
    return { status: CONSTRAINT_STATUS.UNKNOWN, severity, detail: "Aucun bloc horaire rattaché à cette entité." };
  }
  if (!constraint.time_value) {
    return { status: CONSTRAINT_STATUS.UNKNOWN, severity, detail: 'Aucune valeur temporelle définie.' };
  }
  const i = blockInterval(block);
  const t = toWorldMinutes(constraint.time_value);
  const ok = (v) => ({ status: v ? CONSTRAINT_STATUS.SATISFIED : CONSTRAINT_STATUS.VIOLATED, severity, detail: constraint.description, block_id: block.id });

  if (constraint.constraint_type === 'before') return ok(i.start < t);
  if (constraint.constraint_type === 'after') return ok(i.start >= t);
  if (constraint.constraint_type === 'deadline') return ok(i.end <= t);
  if (constraint.constraint_type === 'duration') {
    const max = parseTime(constraint.time_value);
    return ok(i.duration <= max);
  }
  return { status: CONSTRAINT_STATUS.UNKNOWN, severity, detail: `Type de contrainte non supporté : ${constraint.constraint_type}` };
}

export function evaluateAll(constraints, blocks, ctx = {}) {
  return constraints.map((c) => ({ constraint: c, ...evaluateConstraint(c, blocks, ctx) }));
}