// SIMULATION SOCIALE — même pipeline que Chronos : COMPRENDRE -> PROJETER -> ÉVALUER -> RÉSOUDRE.
// Le LLM ne produit qu'une intention ; ce module seul décide du résultat causal.
import { evaluateAll, CONSTRAINT_STATUS } from './constraints.ts';
import { detectConflicts } from './conflicts.ts';
import { maxSeverity } from './severity.ts';
import { noImpact, impact, unknown, conflict, blocked } from './result.ts';

const RSVP = ['INVITED', 'PENDING', 'CONFIRMED', 'DECLINED', 'MAYBE'];

export function simulateSocialChange({ blocks = [], entities = [], relations = [], constraints = [], intent = {} }) {
  const person = entities.find((e) => e.id === intent.person_id && e.entity_type === 'person');
  if (!person) {
    return unknown('Referenced person does not exist', ['person_id valide parmi les personnes de cet univers']);
  }

  let proposedEntities = entities;
  let proposedRelations = relations;
  let changes = [];

  if (intent.type === 'rsvp') {
    if (!RSVP.includes(intent.rsvp_status)) {
      return unknown('Invalid RSVP status', [`rsvp_status parmi ${RSVP.join(', ')}`]);
    }
    if (person.rsvp_status === intent.rsvp_status) {
      return noImpact(`${person.name} est déjà au statut ${intent.rsvp_status}.`);
    }
    proposedEntities = entities.map((e) => (e.id === person.id ? { ...e, rsvp_status: intent.rsvp_status } : e));
    changes = [{
      kind: 'entity_field', target_id: person.id, target_label: person.name, field: 'rsvp_status',
      old_value: person.rsvp_status || 'INVITED', new_value: intent.rsvp_status,
      reason: `RSVP de ${person.name}`,
    }];
  } else if (intent.type === 'assign_table') {
    const table = entities.find((e) => e.id === intent.table_id && e.entity_type === 'table');
    if (!table) return unknown('Referenced table does not exist', ['table_id valide parmi les tables de cet univers']);
    const current = relations.find((r) => r.relation_type === 'assigned_to' && r.from_entity_id === person.id);
    if (current && current.to_entity_id === table.id) {
      return noImpact(`${person.name} est déjà affecté à « ${table.name} ».`);
    }
    proposedRelations = relations
      .filter((r) => !(r.relation_type === 'assigned_to' && r.from_entity_id === person.id))
      .concat([{ id: '__proposed__', world_id: person.world_id, from_entity_id: person.id, to_entity_id: table.id, relation_type: 'assigned_to', strength: 'important' }]);
    changes = [{
      kind: 'relation_set', target_id: person.id, target_label: person.name, relation_type: 'assigned_to',
      old_value: current ? current.to_entity_id : '', new_value: table.id,
      reason: `${person.name} → « ${table.name} »`,
    }];
  } else {
    return unknown('Unsupported social intent', ['type parmi rsvp, assign_table']);
  }

  const baseCtx = { entities, relations };
  const nextCtx = { entities: proposedEntities, relations: proposedRelations };
  const baseEvals = evaluateAll(constraints, blocks, baseCtx);
  const nextEvals = evaluateAll(constraints, blocks, nextCtx);
  const baseConflicts = detectConflicts({ blocks, ...baseCtx });
  const nextConflicts = detectConflicts({ blocks, ...nextCtx });

  const newlyViolated = nextEvals.filter((e, i) =>
    e.status === CONSTRAINT_STATUS.VIOLATED && baseEvals[i].status !== CONSTRAINT_STATUS.VIOLATED);
  const newConflicts = nextConflicts.filter((c) => !baseConflicts.some((b) => b.message === c.message));
  const unknowns = nextEvals.filter((e) => e.status === CONSTRAINT_STATUS.UNKNOWN);

  const impacts = changes.map((c) => ({ entity_name: c.target_label, level: 'MEDIUM', reason: c.reason }));
  for (const e of newlyViolated) impacts.push({ entity_name: e.constraint.description, level: e.severity, reason: `Contrainte violée : ${e.detail || e.constraint.description}` });
  for (const c of newConflicts) impacts.push({ entity_name: 'Collision sociale', level: c.severity, reason: c.message });
  impacts.push({ entity_name: 'Conséquences dérivées', level: 'INFO', reason: 'Repas, budget et transport ne sont pas encore modélisés dans cet univers : conséquences inconnues.' });

  const payload = {
    intent,
    direct_change: changes[0],
    impacts,
    severity: maxSeverity(impacts.map((i) => i.level)),
    conflicts: newConflicts,
    new_violations: newlyViolated.map((e) => ({ constraint_id: e.constraint.id, description: e.constraint.description, severity: e.severity, detail: e.detail })),
    unknowns: unknowns.map((e) => ({ constraint_id: e.constraint.id, description: e.constraint.description, detail: e.detail })),
    resolutions: [{ key: 'direct', label: changes[0].reason, changes, remaining_conflicts: nextConflicts.length, new_violations: newlyViolated.length }],
    recommended: 'direct',
  };

  const criticalBlockers = newlyViolated.filter((e) => e.severity === 'CRITICAL');
  if (criticalBlockers.length) {
    return blocked('Ce changement viole une contrainte humaine critique.', criticalBlockers.map((e) => e.constraint.description), payload);
  }
  if (newConflicts.length) return conflict(payload);
  return impact(payload);
}