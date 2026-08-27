import { propagate } from './propagation.ts';
import { detectConflicts } from './conflicts.ts';
import { evaluateAll, CONSTRAINT_STATUS } from './constraints.ts';
import { setBlockStart, parseTime } from './time.ts';
import { maxSeverity, severityFromConstraint } from './severity.ts';
import { noImpact, impact, unknown, conflict, blocked } from './result.ts';

// COMPRENDRE -> PROPAGER -> ÉVALUER -> RÉSOUDRE.
// Le moteur déterministe décide ; le LLM n'a fait qu'interpréter la demande.
export function simulateTimeChange({ world, blocks, entities, relations, constraints, blockId, newStart }) {
  const block = blocks.find((b) => b.id === blockId);
  if (!block) {
    return unknown('Referenced time block does not exist', ['block_id valide parmi les TimeBlocks de ce monde']);
  }
  if (parseTime(newStart) === null) {
    return unknown('Invalid time value', ['Heure au format HH:mm']);
  }
  const direct = setBlockStart(block, newStart);
  if (!direct) return unknown('Block has no usable start time', ['start_time du bloc']);
  if (direct.start_time === block.start_time) {
    return noImpact('Le bloc est déjà positionné à cet horaire.');
  }

  const seedChanges = [{
    block_id: block.id, block_label: block.label, field: 'start_time',
    old_value: block.start_time, new_value: direct.start_time,
    old_end: block.end_time, new_end: direct.end_time,
  }];

  // État de référence
  const ctx = { entities, relations };
  const baseEvals = evaluateAll(constraints, blocks, ctx);
  const baseConflicts = detectConflicts({ blocks, relations, entities });

  // Option 1 — changement seul, sans propagation
  const isolated = blocks.map((b) => (b.id === block.id ? { ...b, ...direct } : b));
  const isolatedEvals = evaluateAll(constraints, isolated, ctx);
  const isolatedConflicts = detectConflicts({ blocks: isolated, relations, entities });

  // Option 2 — propagation temporelle réelle
  const { blocks: propagatedBlocks, propagated } = propagate({ blocks, relations, seedChanges });
  const propEvals = evaluateAll(constraints, propagatedBlocks, ctx);
  const propConflicts = detectConflicts({ blocks: propagatedBlocks, relations, entities });

  const newlyViolated = (evals) => evals.filter((e, i) =>
    e.status === CONSTRAINT_STATUS.VIOLATED && baseEvals[i].status !== CONSTRAINT_STATUS.VIOLATED);
  const unknowns = propEvals.filter((e) => e.status === CONSTRAINT_STATUS.UNKNOWN);

  const impacts = [];
  const nameOf = (id) => (entities.find((e) => e.id === id) || {}).name || 'Élément';
  for (const p of propagated) {
    impacts.push({ entity_name: p.block_label, level: 'MEDIUM', reason: p.reason });
  }
  for (const e of newlyViolated(propEvals)) {
    impacts.push({ entity_name: nameOf(e.constraint.entity_id), level: severityFromConstraint(e.constraint), reason: `Contrainte violée : ${e.constraint.description}` });
  }
  for (const c of propConflicts.filter((c) => !baseConflicts.some((b) => b.message === c.message))) {
    impacts.push({ entity_name: nameOf(c.entities[0]), level: c.severity, reason: c.message });
  }

  const resolutions = [
    {
      key: 'isolated',
      label: 'Appliquer uniquement ce changement',
      changes: seedChanges,
      remaining_conflicts: isolatedConflicts.length,
      new_violations: newlyViolated(isolatedEvals).length,
    },
    {
      key: 'propagate',
      label: propagated.length ? `Décaler aussi ${propagated.length} bloc(s) dépendant(s)` : 'Aucune propagation nécessaire',
      changes: seedChanges.concat(propagated),
      remaining_conflicts: propConflicts.length,
      new_violations: newlyViolated(propEvals).length,
    },
  ];
  const recommended = resolutions
    .slice()
    .sort((a, b) => (a.new_violations - b.new_violations) || (a.remaining_conflicts - b.remaining_conflicts) || (a.changes.length - b.changes.length))[0];

  const payload = {
    block_id: block.id,
    direct_change: seedChanges[0],
    propagated,
    impacts,
    severity: maxSeverity(impacts.map((i) => i.level)),
    conflicts: propConflicts,
    new_violations: newlyViolated(propEvals).map((e) => ({ constraint_id: e.constraint.id, description: e.constraint.description, severity: e.severity })),
    unknowns: unknowns.map((e) => ({ constraint_id: e.constraint.id, description: e.constraint.description, detail: e.detail })),
    resolutions,
    recommended: recommended.key,
  };

  const criticalBlockers = newlyViolated(propEvals).filter((e) => e.severity === 'CRITICAL');
  if (criticalBlockers.length && recommended.new_violations > 0) {
    return blocked('Ce changement viole une contrainte critique quelle que soit la résolution testée.', criticalBlockers.map((e) => e.constraint.description), payload);
  }
  if (propConflicts.length > baseConflicts.length) {
    return conflict(payload);
  }
  if (!propagated.length && !impacts.length) {
    return impact({ ...payload, reason: 'Changement isolé, aucune conséquence détectée sur le reste du monde.' });
  }
  return impact(payload);
}