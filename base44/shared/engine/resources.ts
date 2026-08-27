// RESOURCE GRAPH — dimension ressources du même World Model.
// Aucun moteur parallèle : évaluation des contraintes de ressources (consommée par constraints.ts)
// et détection des collisions de ressources (consommée par conflicts.ts).
import { severityFromConstraint } from './severity.ts';
import { blockInterval, toWorldMinutes } from './time.ts';

export const RESOURCE_ENTITY_TYPES = [
  'vendor', 'venue', 'service', 'equipment', 'material', 'room',
  'vehicle', 'food', 'accommodation', 'staff', 'technical_resource', 'resource', 'place',
];

export const RESOURCE_CONSTRAINT_TYPES = [
  'vendor_available_at', 'capacity_limit', 'resource_required',
  'service_required', 'venue_capacity', 'equipment_required',
];

export const isResourceEntity = (type) => RESOURCE_ENTITY_TYPES.includes(type);
export const isResourceConstraint = (type) => RESOURCE_CONSTRAINT_TYPES.includes(type);

const LINK_TYPES = ['requires', 'requires_resource', 'uses', 'depends_on', 'operates', 'supplies', 'serves', 'provides', 'has_capability'];

// Index dérivé du graphe : rien n'est dupliqué, tout vient des relations réelles.
export function resourceIndex({ entities = [], relations = [], blocks = [] }) {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const attending = (id) => (byId.get(id) || {}).rsvp_status !== 'DECLINED';

  const linked = (fromId, toId) =>
    relations.some((r) => LINK_TYPES.includes(r.relation_type) &&
      ((r.from_entity_id === fromId && r.to_entity_id === toId) || (r.from_entity_id === toId && r.to_entity_id === fromId)));

  const placedIn = new Map(); // entité -> lieu
  const assignedTo = new Map(); // personne -> table
  for (const r of relations) {
    if (r.relation_type === 'located_in' || r.relation_type === 'located_at') placedIn.set(r.from_entity_id, r.to_entity_id);
    if (r.relation_type === 'assigned_to') assignedTo.set(r.from_entity_id, r.to_entity_id);
  }

  // Occupants d'un lieu : rattachement direct, ou chaîne réelle personne -> table -> lieu.
  const occupantsOf = (placeId) => {
    const direct = entities.filter((e) => e.entity_type === 'person' && (placedIn.get(e.id) === placeId || assignedTo.get(e.id) === placeId));
    const viaTable = entities.filter((e) => e.entity_type === 'person' && placedIn.get(assignedTo.get(e.id)) === placeId);
    const ids = new Set([...direct, ...viaTable].map((p) => p.id));
    return [...ids].filter(attending).map((id) => byId.get(id));
  };

  // Personnes réellement servies par une ressource : relations serves / supplies / uses.
  const servedBy = (resourceId) => {
    const ids = new Set();
    for (const r of relations) {
      if (!['serves', 'supplies', 'uses'].includes(r.relation_type)) continue;
      const other = r.from_entity_id === resourceId ? r.to_entity_id : r.to_entity_id === resourceId ? r.from_entity_id : null;
      if (!other) continue;
      const target = byId.get(other);
      if (!target) continue;
      if (target.entity_type === 'person') ids.add(target.id);
      if (target.entity_type === 'group') {
        for (const m of relations.filter((x) => x.relation_type === 'group_member' && x.to_entity_id === target.id)) ids.add(m.from_entity_id);
      }
      if (target.entity_type === 'table' || target.entity_type === 'venue' || target.entity_type === 'room') {
        for (const p of occupantsOf(target.id)) ids.add(p.id);
      }
    }
    return [...ids].filter(attending).map((id) => byId.get(id));
  };

  const blocksOf = (entityId) => blocks.filter((b) => b.entity_id === entityId && b.start_time);

  return { byId, attending, linked, placedIn, assignedTo, occupantsOf, servedBy, blocksOf };
}

// Évaluation déterministe. UNKNOWN dès qu'une information réelle manque — jamais de déduction.
export function evaluateResourceConstraint(constraint, ctx) {
  const idx = resourceIndex(ctx || {});
  const severity = severityFromConstraint(constraint);
  const U = (detail) => ({ status: 'unknown', severity, detail });
  const R = (ok, detail) => ({ status: ok ? 'satisfied' : 'violated', severity, detail });

  const a = idx.byId.get(constraint.entity_id);
  if (!a) return U("La ressource concernée n'existe pas dans cet univers.");

  if (constraint.constraint_type === 'vendor_available_at') {
    if (!a.availability || a.availability === 'UNKNOWN') return U(`Disponibilité inconnue pour « ${a.name} ».`);
    if (a.availability === 'UNAVAILABLE') return R(false, `« ${a.name} » est déclaré indisponible.`);
    const blocks = idx.blocksOf(a.id);
    if (!blocks.length) return U(`Aucun bloc horaire rattaché à « ${a.name} ».`);
    if (!a.available_from || !a.available_to) return U(`Fenêtre de disponibilité non déclarée pour « ${a.name} ».`);
    const from = toWorldMinutes(a.available_from);
    const to = toWorldMinutes(a.available_to);
    const out = blocks.filter((b) => {
      const i = blockInterval(b);
      return i.start < from || i.end > to;
    });
    return R(out.length === 0, `« ${a.name} » disponible ${a.available_from}–${a.available_to}${out.length ? ` · hors fenêtre : ${out.map((b) => b.label).join(', ')}` : ''}.`);
  }

  if (constraint.constraint_type === 'venue_capacity' || constraint.constraint_type === 'capacity_limit') {
    const max = typeof a.capacity === 'number' ? a.capacity : a.capability_capacity;
    if (typeof max !== 'number') return U(`Capacité inconnue pour « ${a.name} ».`);
    const people = constraint.constraint_type === 'venue_capacity' ? idx.occupantsOf(a.id) : idx.servedBy(a.id);
    if (!people.length) return U(`Aucune affectation connue vers « ${a.name} » : charge réelle inconnue.`);
    return R(people.length <= max, `${people.length} personne(s) pour ${max} ${a.capability_unit || 'place(s)'} — ${a.name}.`);
  }

  // resource_required / service_required / equipment_required
  const b = idx.byId.get(constraint.target_entity_id);
  if (!b) return U(`La ressource requise par « ${a.name} » n'est pas identifiée dans le World.`);
  if (!idx.linked(a.id, b.id)) return R(false, `« ${b.name} » est requis par « ${a.name} » mais aucune relation ne les rattache.`);
  if (!b.availability || b.availability === 'UNKNOWN') return U(`Disponibilité inconnue pour « ${b.name} ».`);
  return R(b.availability !== 'UNAVAILABLE', `« ${a.name} » requiert « ${b.name} » · ${b.availability}.`);
}

// Collisions de ressources — même vocabulaire que les collisions temporelles et sociales.
export function detectResourceConflicts({ entities = [], relations = [], blocks = [] }) {
  const idx = resourceIndex({ entities, relations, blocks });
  const conflicts = [];

  for (const place of entities.filter((e) => ['venue', 'room', 'place', 'accommodation'].includes(e.entity_type))) {
    if (typeof place.capacity !== 'number') continue;
    const occupants = idx.occupantsOf(place.id);
    if (occupants.length > place.capacity) {
      conflicts.push({
        type: 'VENUE_CAPACITY', severity: 'HIGH', entities: [place.id], people: occupants.map((p) => p.id),
        message: `« ${place.name} » : ${occupants.length} personne(s) pour ${place.capacity} place(s).`,
      });
    }
  }

  for (const res of entities.filter((e) => typeof e.capability_capacity === 'number')) {
    const served = idx.servedBy(res.id);
    if (served.length > res.capability_capacity) {
      conflicts.push({
        type: 'CAPABILITY_CAPACITY', severity: 'HIGH', entities: [res.id], people: served.map((p) => p.id),
        message: `« ${res.name} » (${res.capability || 'capacité'}) : ${served.length} pour ${res.capability_capacity} ${res.capability_unit || ''}.`.trim(),
      });
    }
    if (res.availability === 'UNAVAILABLE' && idx.blocksOf(res.id).length) {
      conflicts.push({
        type: 'RESOURCE_UNAVAILABLE', severity: 'CRITICAL', entities: [res.id],
        message: `« ${res.name} » est déclaré indisponible alors qu'un bloc horaire lui est rattaché.`,
      });
    }
  }

  return conflicts;
}