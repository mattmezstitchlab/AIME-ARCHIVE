import { ACTION, logAudit, emitEvent } from './audit.ts';
import { recalculateWorld } from './world.ts';

// EVENT GRAPH de démonstration — uniquement des données.
// Les rattachements ne sont créés que si l'élément existe réellement dans le World :
// aucune ressource, aucune personne n'est inventée ici.
export const EVENT_TEMPLATE = {
  events: [
    { key: 'setup', name: 'Installation', category: 'SETUP', start: '10:00', end: '14:00', block_type: 'setup', buffer: 30 },
    { key: 'ceremony', name: 'Cérémonie', category: 'CEREMONY', start: '16:30', end: '17:15', block_type: 'moment', buffer: 15 },
    { key: 'cocktail', name: 'Cocktail', category: 'COCKTAIL', start: '17:30', end: '19:00', block_type: 'service', buffer: 15 },
    { key: 'dinner', name: 'Dîner', category: 'DINNER', start: '19:30', end: '22:00', block_type: 'service', buffer: 15 },
    { key: 'party', name: 'Soirée dansante', category: 'PARTY', start: '22:30', end: '02:00', block_type: 'moment', buffer: 0 },
  ],
  // to = nom exact d'une entité déjà présente dans le World (ressource, lieu, service…)
  requirements: [
    { from: 'setup', to: 'Domaine des Cèdres', relation_type: 'located_at', strength: 'critical' },
    { from: 'ceremony', to: 'Domaine des Cèdres', relation_type: 'located_at', strength: 'critical' },
    { from: 'ceremony', to: 'Studio Lumière', relation_type: 'requires_vendor', strength: 'critical' },
    { from: 'ceremony', to: 'Photographie', relation_type: 'requires_service', strength: 'critical' },
    { from: 'cocktail', to: 'Maison Verger', relation_type: 'requires_vendor', strength: 'critical' },
    { from: 'cocktail', to: 'DJ Kessler', relation_type: 'requires_vendor', strength: 'important' },
    { from: 'cocktail', to: 'Sonorisation façade', relation_type: 'requires_resource', strength: 'important' },
    { from: 'dinner', to: 'Salle principale', relation_type: 'located_at', strength: 'critical' },
    { from: 'dinner', to: 'Dîner assis', relation_type: 'requires_service', strength: 'critical' },
    { from: 'party', to: 'DJ Kessler', relation_type: 'requires_vendor', strength: 'critical' },
    { from: 'party', to: 'Drone', relation_type: 'requires_service', strength: 'weak' },
  ],
  dependencies: [
    { from: 'setup', to: 'ceremony', relation_type: 'precedes', strength: 'critical' },
    { from: 'ceremony', to: 'cocktail', relation_type: 'precedes', strength: 'important' },
    { from: 'cocktail', to: 'dinner', relation_type: 'precedes', strength: 'important' },
    { from: 'dinner', to: 'party', relation_type: 'precedes', strength: 'weak' },
  ],
  // Les mariés participent à tout ce qui les concerne ; les autres participations restent à déclarer.
  participation: ['ceremony', 'cocktail', 'dinner', 'party'],
};

export async function seedEventGraph(db, worldId, template = EVENT_TEMPLATE) {
  const existing = await db.WorldEntity.filter({ world_id: worldId });
  const byName = new Map(existing.map((e) => [e.name, e]));
  const couple = existing.filter((e) => e.entity_type === 'person' && /marié/i.test(e.role || ''));

  const ids = {};
  for (const e of template.events) {
    const created = await db.WorldEntity.create({
      world_id: worldId, name: e.name, entity_type: 'event', category: e.category,
      status: 'proposed', truth_status: 'proposed', availability: 'UNKNOWN',
    });
    ids[e.key] = created.id;
    await db.TimeBlock.create({
      world_id: worldId, entity_id: created.id, label: e.name,
      start_time: e.start, end_time: e.end, block_type: e.block_type, buffer_minutes: e.buffer, status: 'planned',
    });
    await logAudit(db, worldId, {
      actor: 'Système', action_code: ACTION.EVENT_CREATED, action: 'Événement créé', target: e.name,
      new_value: e.category, source: 'system', justification: `${e.start} → ${e.end}`,
    });
  }

  let skipped = 0;
  for (const r of template.requirements) {
    const target = byName.get(r.to);
    if (!target) { skipped += 1; continue; } // UNKNOWN plutôt qu'une ressource inventée
    await db.WorldRelation.create({
      world_id: worldId, from_entity_id: ids[r.from], to_entity_id: target.id,
      relation_type: r.relation_type, strength: r.strength, description: `${r.from} → ${r.to}`,
    });
    await logAudit(db, worldId, {
      actor: 'Système',
      action_code: target.entity_type === 'vendor' ? ACTION.EVENT_VENDOR_ASSIGNED : ACTION.EVENT_RESOURCE_ASSIGNED,
      action: 'Élément rattaché à un événement', target: `${r.from} → ${target.name}`,
      new_value: r.relation_type, source: 'system', justification: r.relation_type,
    });
  }

  for (const d of template.dependencies) {
    await db.WorldRelation.create({
      world_id: worldId, from_entity_id: ids[d.from], to_entity_id: ids[d.to],
      relation_type: d.relation_type, strength: d.strength, description: `${d.from} précède ${d.to}`,
    });
  }

  for (const person of couple) {
    for (const key of template.participation) {
      await db.WorldRelation.create({
        world_id: worldId, from_entity_id: person.id, to_entity_id: ids[key],
        relation_type: 'participates_in', strength: 'critical', description: `${person.name} participe`,
      });
      await logAudit(db, worldId, {
        actor: 'Système', action_code: ACTION.EVENT_PERSON_ASSIGNED, action: 'Personne rattachée à un événement',
        target: `${person.name} → ${key}`, new_value: 'participates_in', source: 'system', justification: person.role || 'participant',
      });
    }
  }

  await logAudit(db, worldId, {
    actor: 'Système', action_code: ACTION.EVENT_GRAPH_SEEDED, action: 'Graphe des événements créé',
    target: `${template.events.length} événements`, source: 'system',
    justification: skipped ? `${skipped} rattachement(s) ignoré(s) : ressource absente du World` : 'Seed Event Graph reproductible',
  });
  await emitEvent(db, worldId, 'EventGraphSeeded', { events: template.events.length, skipped }, 'system');
  const state = await recalculateWorld(db, worldId, { source: 'system' });
  return { entity_ids: ids, skipped_requirements: skipped, state };
}