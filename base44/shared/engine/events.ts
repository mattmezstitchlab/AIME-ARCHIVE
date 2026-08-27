// EVENT GRAPH — un événement est une WorldEntity (entity_type = 'event') du même World Model.
// Aucun moteur parallèle : ce module ne fait que dériver des faits du graphe existant
// (relations, TimeBlocks, disponibilités, RSVP) et les rend consommables par
// constraints.ts / conflicts.ts / health.ts. Rien n'est déduit : UNKNOWN si l'information manque.
import { blockInterval, overlaps, formatTime } from './time.ts';

export const EVENT_ENTITY_TYPE = 'event';

// Relation -> nature de l'exigence. La relation reste la seule source de vérité.
export const EVENT_REQUIREMENT_RELATIONS = {
  requires_person: 'person',
  requires_vendor: 'vendor',
  requires_service: 'service',
  requires_resource: 'resource',
  requires: 'resource',
  uses: 'resource',
  located_at: 'venue',
};

export const EVENT_DEPENDENCY_RELATIONS = ['precedes', 'follows', 'must_precede', 'depends_on'];
export const EVENT_STATUS = { READY: 'EVENT_READY', AT_RISK: 'EVENT_AT_RISK', BLOCKED: 'EVENT_BLOCKED', UNKNOWN: 'EVENT_UNKNOWN' };
// La sévérité reste celle du système global GAÏA — aucune échelle parallèle.
export const EVENT_STATUS_SEVERITY = {
  EVENT_READY: 'INFO', EVENT_AT_RISK: 'MEDIUM', EVENT_UNKNOWN: 'MEDIUM', EVENT_BLOCKED: 'CRITICAL',
};

export const isEventEntity = (type) => type === EVENT_ENTITY_TYPE;

// État réel d'un élément requis : OK / UNKNOWN / MISSING. Jamais d'invention.
function requirementState(entity) {
  if (!entity) return 'MISSING';
  if (entity.entity_type === 'person' || entity.entity_type === 'staff') {
    if (entity.rsvp_status === 'CONFIRMED') return 'OK';
    if (entity.rsvp_status === 'DECLINED') return 'MISSING';
    if (!entity.rsvp_status) return entity.availability === 'AVAILABLE' ? 'OK' : 'UNKNOWN';
    return 'UNKNOWN';
  }
  if (entity.availability === 'AVAILABLE' || entity.availability === 'PARTIALLY_AVAILABLE') return 'OK';
  if (entity.availability === 'UNAVAILABLE') return 'MISSING';
  return 'UNKNOWN';
}

export function eventIndex({ entities = [], relations = [], blocks = [] }) {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const events = entities.filter((e) => isEventEntity(e.entity_type));

  const blocksOf = (eventId) => blocks.filter((b) => b.entity_id === eventId && b.start_time);

  const intervalOf = (eventId) => {
    const own = blocksOf(eventId).map(blockInterval).filter(Boolean);
    if (!own.length) return null;
    return { start: Math.min(...own.map((i) => i.start)), end: Math.max(...own.map((i) => i.end)), buffer: 0 };
  };

  const requirementsOf = (eventId) => relations
    .filter((r) => r.from_entity_id === eventId && EVENT_REQUIREMENT_RELATIONS[r.relation_type])
    .map((r) => {
      const target = byId.get(r.to_entity_id);
      return {
        relation_id: r.id,
        relation_type: r.relation_type,
        kind: EVENT_REQUIREMENT_RELATIONS[r.relation_type],
        entity: target || null,
        label: target ? target.name : 'Élément requis introuvable',
        state: requirementState(target),
        strength: r.strength || 'important',
      };
    });

  const participantsOf = (eventId) => {
    const ids = new Set();
    for (const r of relations.filter((x) => x.relation_type === 'participates_in' && x.to_entity_id === eventId)) {
      const from = byId.get(r.from_entity_id);
      if (!from) continue;
      if (from.entity_type === 'group') {
        for (const m of relations.filter((x) => x.relation_type === 'group_member' && x.to_entity_id === from.id)) ids.add(m.from_entity_id);
      } else ids.add(from.id);
    }
    return [...ids].map((id) => byId.get(id)).filter((p) => p && p.rsvp_status !== 'DECLINED');
  };

  const venueOf = (eventId) => {
    const r = relations.find((x) => x.relation_type === 'located_at' && x.from_entity_id === eventId);
    return r ? byId.get(r.to_entity_id) : null;
  };

  const dependenciesOf = (eventId) => relations
    .filter((r) => EVENT_DEPENDENCY_RELATIONS.includes(r.relation_type) && (r.from_entity_id === eventId || r.to_entity_id === eventId));

  // Fournisseur réel d'un service : relation provides existante, jamais supposée.
  const providerOf = (serviceId) => {
    const r = relations.find((x) => (x.relation_type === 'provides' || x.relation_type === 'has_capability') && x.to_entity_id === serviceId);
    return r ? byId.get(r.from_entity_id) : null;
  };

  return { byId, events, blocksOf, intervalOf, requirementsOf, participantsOf, venueOf, dependenciesOf, providerOf };
}

// EVENT HEALTH — dérivé uniquement de ce que le World contient réellement.
export function evaluateEvent(event, idx) {
  const requirements = idx.requirementsOf(event.id);
  const interval = idx.intervalOf(event.id);
  const participants = idx.participantsOf(event.id);
  const venue = idx.venueOf(event.id);

  let status = EVENT_STATUS.READY;
  if (!requirements.length && !interval) status = EVENT_STATUS.UNKNOWN;
  else if (requirements.some((r) => r.state === 'MISSING')) status = EVENT_STATUS.BLOCKED;
  else if (requirements.some((r) => r.state === 'UNKNOWN') || !interval) status = EVENT_STATUS.AT_RISK;

  return {
    event_id: event.id,
    name: event.name,
    category: event.category || null,
    status,
    severity: EVENT_STATUS_SEVERITY[status],
    interval,
    time: interval ? `${formatTime(interval.start)} — ${formatTime(interval.end)}` : null,
    venue_id: venue ? venue.id : null,
    requirements,
    participant_ids: participants.map((p) => p.id),
  };
}

export function evaluateEvents(ctx) {
  const idx = eventIndex(ctx);
  return idx.events.map((e) => evaluateEvent(e, idx));
}

// COLLISIONS — mêmes types/sévérités que le reste du moteur.
export function detectEventConflicts({ entities = [], relations = [], blocks = [] }) {
  const idx = eventIndex({ entities, relations, blocks });
  const conflicts = [];
  const evals = idx.events.map((e) => evaluateEvent(e, idx));

  // 1. Double réservation : une même ressource requise par deux événements qui se chevauchent.
  for (let i = 0; i < evals.length; i += 1) {
    for (let j = i + 1; j < evals.length; j += 1) {
      const a = evals[i];
      const b = evals[j];
      if (!a.interval || !b.interval || !overlaps(a.interval, b.interval)) continue;
      const bIds = new Set(b.requirements.filter((r) => r.entity).map((r) => r.entity.id));
      for (const r of a.requirements) {
        if (!r.entity || !bIds.has(r.entity.id)) continue;
        if (r.entity.entity_type === 'venue' || r.entity.entity_type === 'room' || r.entity.entity_type === 'place') continue;
        conflicts.push({
          type: r.entity.entity_type === 'vendor' ? 'EVENT_VENDOR_COLLISION' : 'EVENT_RESOURCE_COLLISION',
          severity: 'CRITICAL',
          entities: [a.event_id, b.event_id, r.entity.id],
          message: `« ${r.entity.name} » est requis simultanément par « ${a.name} » (${a.time}) et « ${b.name} » (${b.time}).`,
        });
      }
    }
  }

  // 2. Capacité : uniquement si la capacité est exprimée en personnes ET que les participants sont connus.
  // Une capacité en « événements simultanés » ne dit rien du nombre d'invités : on n'invente pas la comparaison.
  const PEOPLE_UNITS = ['couvert', 'personne', 'passager', 'place', 'invité'];
  const isPeopleUnit = (unit) => !!unit && PEOPLE_UNITS.some((u) => String(unit).toLowerCase().includes(u));
  const seen = new Set();
  for (const ev of evals) {
    if (!ev.participant_ids.length) continue;
    for (const r of ev.requirements) {
      if (!r.entity) continue;
      const provider = r.entity.entity_type === 'service' ? idx.providerOf(r.entity.id) : r.entity;
      if (!provider || typeof provider.capability_capacity !== 'number') continue;
      if (!isPeopleUnit(provider.capability_unit)) continue;
      const key = `${ev.event_id}|${provider.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (ev.participant_ids.length > provider.capability_capacity) {
        conflicts.push({
          type: 'EVENT_CAPACITY',
          severity: 'HIGH',
          entities: [ev.event_id, provider.id],
          people: ev.participant_ids,
          message: `« ${ev.name} » : ${ev.participant_ids.length} participant(s) pour ${provider.capability_capacity} ${provider.capability_unit || ''} — ${provider.name}.`.replace('  ', ' '),
        });
      }
    }
    const venue = ev.venue_id ? idx.byId.get(ev.venue_id) : null;
    if (venue && typeof venue.capacity === 'number' && ev.participant_ids.length > venue.capacity) {
      conflicts.push({
        type: 'EVENT_CAPACITY', severity: 'HIGH', entities: [ev.event_id, venue.id], people: ev.participant_ids,
        message: `« ${ev.name} » : ${ev.participant_ids.length} participant(s) pour ${venue.capacity} place(s) — ${venue.name}.`,
      });
    }
  }

  // 3. Ressource requise manquante ou indisponible.
  for (const ev of evals) {
    for (const r of ev.requirements.filter((x) => x.state === 'MISSING')) {
      conflicts.push({
        type: 'EVENT_REQUIREMENT_MISSING',
        severity: r.strength === 'weak' ? 'MEDIUM' : 'CRITICAL',
        entities: [ev.event_id, ...(r.entity ? [r.entity.id] : [])],
        message: `« ${ev.name} » requiert « ${r.label} » : indisponible ou absent du World.`,
      });
    }
  }

  return conflicts;
}