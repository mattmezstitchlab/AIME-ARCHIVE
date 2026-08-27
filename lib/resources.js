// Vocabulaire d'affichage du Resource Graph (miroir de base44/shared/engine/resources.ts).
export const RESOURCE_TYPE_LABELS = {
  vendor: 'Prestataire',
  venue: 'Lieu',
  service: 'Service',
  equipment: 'Équipement',
  material: 'Matériel',
  room: 'Salle',
  vehicle: 'Véhicule',
  food: 'Restauration',
  accommodation: 'Hébergement',
  staff: 'Équipe',
  technical_resource: 'Ressource technique',
  resource: 'Ressource',
  place: 'Lieu',
};

export const AVAILABILITY_LABELS = {
  AVAILABLE: 'Disponible',
  UNAVAILABLE: 'Indisponible',
  PARTIALLY_AVAILABLE: 'Partiellement disponible',
  UNKNOWN: 'Disponibilité inconnue',
};

export const RESOURCE_CONSTRAINT_LABELS = {
  vendor_available_at: 'Disponibilité du prestataire',
  capacity_limit: 'Limite de capacité',
  resource_required: 'Ressource requise',
  service_required: 'Service requis',
  venue_capacity: 'Capacité du lieu',
  equipment_required: 'Équipement requis',
};

export const isResourceType = (type) => Object.prototype.hasOwnProperty.call(RESOURCE_TYPE_LABELS, type);
export const isResourceConstraint = (type) => Object.prototype.hasOwnProperty.call(RESOURCE_CONSTRAINT_LABELS, type);

const PROVIDER_LINKS = ['provides', 'has_capability'];
const TEAM_LINKS = ['group_member', 'operates'];

// Toutes les vues dérivent du même World : aucune donnée ressource n'est stockée à part.
export function resourceView({ entities = [], relations = [], blocks = [] }) {
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  const resources = entities.filter((e) => isResourceType(e.entity_type) && e.entity_type !== 'service');
  const services = entities.filter((e) => e.entity_type === 'service');

  const servicesOf = (id) => relations
    .filter((r) => PROVIDER_LINKS.includes(r.relation_type) && r.from_entity_id === id)
    .map((r) => byId[r.to_entity_id]).filter((e) => e && e.entity_type === 'service');

  const teamOf = (id) => relations
    .filter((r) => TEAM_LINKS.includes(r.relation_type) && r.to_entity_id === id)
    .map((r) => byId[r.from_entity_id]).filter((e) => e && (e.entity_type === 'staff' || e.entity_type === 'person'));

  const linksOf = (id) => relations.filter((r) => (r.from_entity_id === id || r.to_entity_id === id));
  const blocksOf = (id) => blocks.filter((b) => b.entity_id === id);
  const providerOf = (serviceId) => relations
    .filter((r) => r.relation_type === 'provides' && r.to_entity_id === serviceId)
    .map((r) => byId[r.from_entity_id]).filter(Boolean)[0];

  return { byId, resources, services, servicesOf, teamOf, linksOf, blocksOf, providerOf };
}