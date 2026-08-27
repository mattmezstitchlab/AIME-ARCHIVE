// PEOPLE GRAPH — dimension humaine du même World Model.
// Aucun moteur parallèle : ce module fournit l'évaluation des contraintes sociales
// (consommée par constraints.ts) et la détection des collisions sociales (consommée par conflicts.ts).
import { severityFromConstraint } from './severity.ts';

export const SOCIAL_CONSTRAINT_TYPES = [
  'must_be_near', 'must_be_separated', 'same_table', 'different_table',
  'same_group', 'accessibility_required', 'child_with_guardian', 'elder_near_exit', 'capacity',
];

export const isSocialConstraint = (type) => SOCIAL_CONSTRAINT_TYPES.includes(type);

// Index dérivé du graphe : aucune donnée dupliquée, tout vient des relations.
export function socialIndex({ entities = [], relations = [] }) {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const tableOf = new Map();
  const groupsOf = new Map();
  const guardiansOf = new Map();
  for (const r of relations) {
    if (r.relation_type === 'assigned_to') tableOf.set(r.from_entity_id, r.to_entity_id);
    if (r.relation_type === 'group_member') {
      if (!groupsOf.has(r.from_entity_id)) groupsOf.set(r.from_entity_id, []);
      groupsOf.get(r.from_entity_id).push(r.to_entity_id);
    }
    if (r.relation_type === 'guardian_of' || r.relation_type === 'parent_of') {
      if (!guardiansOf.has(r.to_entity_id)) guardiansOf.set(r.to_entity_id, []);
      guardiansOf.get(r.to_entity_id).push(r.from_entity_id);
    }
    if (r.relation_type === 'child_of') {
      if (!guardiansOf.has(r.from_entity_id)) guardiansOf.set(r.from_entity_id, []);
      guardiansOf.get(r.from_entity_id).push(r.to_entity_id);
    }
  }
  const attending = (id) => (byId.get(id) || {}).rsvp_status !== 'DECLINED';
  const seatedAt = (tableId) =>
    [...tableOf.entries()].filter(([pid, tid]) => tid === tableId && attending(pid)).map(([pid]) => pid);
  return { byId, tableOf, groupsOf, guardiansOf, seatedAt, attending };
}

const nameOf = (idx, id) => (idx.byId.get(id) || {}).name || 'Personne inconnue';

// Évaluation déterministe d'une contrainte sociale. UNKNOWN dès qu'une information manque.
export function evaluateSocialConstraint(constraint, ctx) {
  const idx = socialIndex(ctx || {});
  const severity = severityFromConstraint(constraint);
  const U = (detail) => ({ status: 'unknown', severity, detail });
  const R = (ok, detail) => ({ status: ok ? 'satisfied' : 'violated', severity, detail });

  const a = idx.byId.get(constraint.entity_id);
  if (!a) return U("L'entité concernée n'existe pas dans cet univers.");

  if (constraint.constraint_type === 'capacity') {
    if (typeof a.capacity !== 'number') return U(`Capacité inconnue pour « ${a.name} ».`);
    const seated = idx.seatedAt(a.id);
    return R(seated.length <= a.capacity, `${seated.length} personne(s) affectée(s) pour ${a.capacity} place(s) — ${a.name}.`);
  }

  if (constraint.constraint_type === 'accessibility_required' || constraint.constraint_type === 'elder_near_exit') {
    const need = constraint.value || (a.accessibility || [])[0];
    if (!need) return U(`Aucun besoin d'accessibilité structuré pour ${a.name}.`);
    const tableId = idx.tableOf.get(a.id);
    if (!tableId) return U(`${a.name} n'est affecté à aucune table.`);
    const table = idx.byId.get(tableId);
    if (!table || !table.location) return U(`Emplacement inconnu pour « ${table ? table.name : 'la table'} ».`);
    const loc = table.location.toLowerCase();
    const match = { NEEDS_NEAR_EXIT: ['sortie', 'exit'], NEEDS_STEP_FREE_ACCESS: ['plain-pied', 'accès direct'], NEEDS_SEATED_POSITION: [], NEEDS_ASSISTANCE: [] }[need];
    if (!match || !match.length) return U(`Besoin « ${need} » non évaluable sur les données de lieu disponibles.`);
    return R(match.some((k) => loc.includes(k)), `${a.name} · ${need} · table « ${table.name} » (${table.location}).`);
  }

  if (constraint.constraint_type === 'child_with_guardian') {
    const ta0 = idx.tableOf.get(a.id);
    const guardians = idx.guardiansOf.get(a.id) || [];
    if (!guardians.length) return U(`Aucun parent/responsable déclaré pour ${a.name}.`);
    if (!ta0) return U(`${a.name} n'est affecté à aucune table.`);
    const seatedGuardians = guardians.filter((g) => idx.tableOf.get(g));
    if (!seatedGuardians.length) return U(`Aucun responsable de ${a.name} n'est affecté à une table.`);
    return R(seatedGuardians.some((g) => idx.tableOf.get(g) === ta0), `${a.name} doit être à la table de ${nameOf(idx, seatedGuardians[0])}.`);
  }

  const b = idx.byId.get(constraint.target_entity_id);
  if (!b) return U("La seconde personne de la contrainte n'est pas identifiée.");

  if (constraint.constraint_type === 'same_group') {
    const ga = idx.groupsOf.get(a.id) || [];
    const gb = idx.groupsOf.get(b.id) || [];
    if (!ga.length || !gb.length) return U(`Appartenance de groupe inconnue pour ${!ga.length ? a.name : b.name}.`);
    return R(ga.some((g) => gb.includes(g)), `${a.name} et ${b.name} — groupes comparés.`);
  }

  // must_be_near / same_table / must_be_separated / different_table
  const ta = idx.tableOf.get(a.id);
  const tb = idx.tableOf.get(b.id);
  if (!ta || !tb) return U(`Affectation de table inconnue pour ${!ta ? a.name : b.name}.`);
  const together = ta === tb;
  const detail = `${a.name} · ${b.name} · ${together ? 'même table' : 'tables différentes'} (${nameOf(idx, ta)} / ${nameOf(idx, tb)}).`;
  if (constraint.constraint_type === 'must_be_near' || constraint.constraint_type === 'same_table') return R(together, detail);
  return R(!together, detail);
}

// Collisions sociales structurelles — même vocabulaire que les collisions temporelles.
export function detectSocialConflicts({ entities = [], relations = [] }) {
  const idx = socialIndex({ entities, relations });
  const conflicts = [];
  for (const table of entities.filter((e) => e.entity_type === 'table')) {
    if (typeof table.capacity !== 'number') continue;
    const seated = idx.seatedAt(table.id);
    if (seated.length > table.capacity) {
      conflicts.push({
        type: 'CAPACITY',
        severity: 'HIGH',
        entities: [table.id],
        people: seated,
        message: `« ${table.name} » : ${seated.length} personne(s) affectée(s) pour ${table.capacity} place(s).`,
      });
    }
  }
  return conflicts;
}