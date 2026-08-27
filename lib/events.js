// Vocabulaire d'affichage de l'Event Graph.
// Les statuts viennent du moteur (world.health.events) : l'interface ne recalcule rien.
export const EVENT_STATUS_LABELS = {
  EVENT_READY: 'Prêt',
  EVENT_AT_RISK: 'À risque',
  EVENT_BLOCKED: 'Bloqué',
  EVENT_UNKNOWN: 'Inconnu',
};

export const EVENT_STATUS_LEVEL = {
  EVENT_READY: 'INFO',
  EVENT_AT_RISK: 'MEDIUM',
  EVENT_UNKNOWN: 'MEDIUM',
  EVENT_BLOCKED: 'CRITICAL',
};

export const EVENT_CATEGORY_LABELS = {
  CEREMONY: 'Cérémonie', COCKTAIL: 'Cocktail', DINNER: 'Dîner', FIRST_DANCE: 'Ouverture de bal',
  PARTY: 'Soirée', PHOTOS: 'Photos', PREPARATION: 'Préparatifs', BRUNCH: 'Brunch',
  TRANSPORT: 'Transport', SETUP: 'Installation', TEARDOWN: 'Démontage',
};

export const REQUIREMENT_LABELS = {
  requires_person: 'Personne requise',
  requires_vendor: 'Prestataire requis',
  requires_service: 'Service requis',
  requires_resource: 'Ressource requise',
  requires: 'Ressource requise',
  uses: 'Ressource utilisée',
  located_at: 'Lieu',
};

export const REQUIREMENT_STATE_LABELS = { OK: 'Confirmé', UNKNOWN: 'Inconnu', MISSING: 'Indisponible' };

export function eventView({ entities = [], relations = [], blocks = [], world = null }) {
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  const health = (world && world.health) || {};
  const evaluations = health.events || [];
  const conflicts = health.conflicts || [];
  const events = entities.filter((e) => e.entity_type === 'event');

  const evalOf = (id) => evaluations.find((e) => e.event_id === id) || null;
  const participantsOf = (id) => (evalOf(id)?.participant_ids || []).map((p) => byId[p]).filter(Boolean);
  const blocksOf = (id) => blocks.filter((b) => b.entity_id === id);
  const conflictsOf = (id) => conflicts.filter((c) => (c.entities || []).includes(id));
  const dependenciesOf = (id) => relations.filter(
    (r) => ['precedes', 'follows', 'must_precede', 'depends_on'].includes(r.relation_type) && (r.from_entity_id === id || r.to_entity_id === id),
  );

  return { byId, events, evaluations, evalOf, participantsOf, blocksOf, conflictsOf, dependenciesOf };
}