import { ACTION, logAudit, emitEvent } from './audit.ts';
import { recalculateWorld } from './world.ts';

// Graphe des ressources de démonstration — uniquement des données, jamais de logique.
export const RESOURCE_TEMPLATE = {
  entities: [
    { key: 'venue', name: 'Domaine des Cèdres', entity_type: 'venue', category: 'lieu', capacity: 120, location: 'Provence', availability: 'AVAILABLE', available_from: '10:00', available_to: '02:00', truth_status: 'verified' },
    { key: 'studio', name: 'Studio Lumière', entity_type: 'vendor', category: 'photographe', role: 'Photographe', capability: 'photographie', capability_capacity: 1, capability_unit: 'événement simultané', availability: 'AVAILABLE', available_from: '13:00', available_to: '23:00', truth_status: 'verified' },
    { key: 'thomas', name: 'Thomas Nardi', entity_type: 'staff', category: 'photographe', role: 'Photographe principal', capability: 'photographie', availability: 'AVAILABLE', truth_status: 'verified' },
    { key: 's_photo', name: 'Photographie', entity_type: 'service', category: 'photo', availability: 'AVAILABLE', truth_status: 'verified' },
    { key: 's_video', name: 'Vidéo', entity_type: 'service', category: 'video', availability: 'PARTIALLY_AVAILABLE', truth_status: 'proposed' },
    { key: 's_drone', name: 'Drone', entity_type: 'service', category: 'video', availability: 'UNKNOWN', truth_status: 'proposed' },
    { key: 'traiteur', name: 'Maison Verger', entity_type: 'vendor', category: 'traiteur', role: 'Traiteur', capability: 'catering', capability_capacity: 150, capability_unit: 'couverts', availability: 'AVAILABLE', available_from: '16:00', available_to: '01:00', truth_status: 'verified' },
    { key: 's_diner', name: 'Dîner assis', entity_type: 'service', category: 'catering', availability: 'AVAILABLE', truth_status: 'verified' },
    { key: 'dj', name: 'DJ Kessler', entity_type: 'vendor', category: 'dj', role: 'DJ', capability: 'animation musicale', capability_capacity: 1, capability_unit: 'événement simultané', availability: 'UNKNOWN', truth_status: 'proposed' },
    { key: 'sono', name: 'Sonorisation façade', entity_type: 'technical_resource', category: 'son', availability: 'AVAILABLE', truth_status: 'verified' },
    { key: 'navette', name: 'Navette invités', entity_type: 'vehicle', category: 'transport', capability: 'transport', capability_capacity: 50, capability_unit: 'passagers', availability: 'AVAILABLE', available_from: '15:00', available_to: '02:00', truth_status: 'verified' },
    { key: 'salle', name: 'Salle principale', entity_type: 'room', category: 'salle', capacity: 100, location: 'Aile est', availability: 'AVAILABLE', truth_status: 'verified' },
  ],
  relations: [
    { from: 'studio', to: 's_photo', relation_type: 'provides', strength: 'critical', description: 'Studio Lumière fournit la photographie' },
    { from: 'studio', to: 's_video', relation_type: 'provides', strength: 'important' },
    { from: 'studio', to: 's_drone', relation_type: 'provides', strength: 'weak' },
    { from: 'studio', to: 's_photo', relation_type: 'has_capability', strength: 'critical', description: 'Capacité réelle : photographie' },
    { from: 'thomas', to: 'studio', relation_type: 'group_member', strength: 'important', description: 'Membre de l’équipe Studio Lumière' },
    { from: 'traiteur', to: 's_diner', relation_type: 'provides', strength: 'critical' },
    { from: 'dj', to: 'sono', relation_type: 'requires_resource', strength: 'critical', description: 'Le DJ requiert la sonorisation façade' },
    { from: 'salle', to: 'venue', relation_type: 'located_in', strength: 'important' },
    { from: 'studio', to: 'venue', relation_type: 'located_in', strength: 'weak' },
  ],
  constraints: [
    { key: 'studio', description: 'Studio Lumière doit être disponible sur ses blocs horaires', constraint_type: 'vendor_available_at', severity: 'critical' },
    { key: 'dj', description: 'DJ Kessler doit être disponible sur ses blocs horaires', constraint_type: 'vendor_available_at', severity: 'important' },
    { key: 'venue', description: 'Capacité du Domaine des Cèdres', constraint_type: 'venue_capacity', severity: 'critical' },
    { key: 'salle', description: 'Capacité de la Salle principale', constraint_type: 'venue_capacity', severity: 'important' },
    { key: 'traiteur', description: 'Couverts servis par Maison Verger', constraint_type: 'capacity_limit', severity: 'important' },
    { key: 'dj', target: 'sono', description: 'Le DJ requiert la sonorisation façade', constraint_type: 'equipment_required', severity: 'critical' },
  ],
};

export async function seedResourceGraph(db, worldId, template = RESOURCE_TEMPLATE) {
  const ids = {};
  for (const e of template.entities) {
    const { key, ...payload } = e;
    const created = await db.WorldEntity.create({ world_id: worldId, status: 'confirmed', ...payload });
    ids[key] = created.id;
  }
  for (const r of template.relations) {
    await db.WorldRelation.create({
      world_id: worldId, from_entity_id: ids[r.from], to_entity_id: ids[r.to],
      relation_type: r.relation_type, strength: r.strength, description: r.description,
    });
  }
  for (const c of template.constraints) {
    await db.Constraint.create({
      world_id: worldId, entity_id: ids[c.key], target_entity_id: c.target ? ids[c.target] : undefined,
      description: c.description, constraint_type: c.constraint_type, value: c.value,
      severity: c.severity, status: 'unknown',
    });
  }
  await logAudit(db, worldId, {
    actor: 'Système', action_code: ACTION.RESOURCE_GRAPH_SEEDED, action: 'Graphe des ressources créé',
    target: `${template.entities.length} ressources`, source: 'system', justification: 'Seed Resource Graph reproductible',
  });
  await emitEvent(db, worldId, 'ResourceGraphSeeded', { resources: template.entities.length }, 'system');
  const state = await recalculateWorld(db, worldId, { source: 'system' });
  return { entity_ids: ids, state };
}