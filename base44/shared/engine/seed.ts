import { ACTION, logAudit, emitEvent } from './audit.ts';
import { recalculateWorld } from './world.ts';

// Univers de démonstration reproductible. Aucune donnée de démo n'existe dans le moteur :
// tout est décrit ici, en données.
export const DEMO_TEMPLATE = {
  world: { name: 'Léa & Marco', wedding_date: '2026-08-22', location: 'Domaine des Cyprès', guest_count: 120, budget_total: 48000, status: 'planning' },
  entities: [
    { key: 'photo', name: 'Photographe', entity_type: 'vendor', category: 'photographe', status: 'confirmed', truth_status: 'verified' },
    { key: 'video', name: 'Vidéaste', entity_type: 'vendor', category: 'video', status: 'proposed', truth_status: 'proposed' },
    { key: 'traiteur', name: 'Traiteur', entity_type: 'vendor', category: 'traiteur', status: 'confirmed', truth_status: 'verified' },
    { key: 'dj', name: 'DJ', entity_type: 'vendor', category: 'dj', status: 'confirmed', truth_status: 'verified' },
    { key: 'seance', name: 'Séance couple', entity_type: 'moment', category: 'photo', status: 'confirmed', truth_status: 'verified' },
    { key: 'ceremonie', name: 'Cérémonie', entity_type: 'moment', category: 'ceremonie', status: 'confirmed', truth_status: 'verified' },
    { key: 'cocktail', name: 'Cocktail', entity_type: 'moment', category: 'cocktail', status: 'confirmed', truth_status: 'verified' },
    { key: 'diner', name: 'Dîner', entity_type: 'moment', category: 'repas', status: 'confirmed', truth_status: 'verified' },
    { key: 'soiree', name: 'Soirée', entity_type: 'moment', category: 'fete', status: 'confirmed', truth_status: 'verified' },
    { key: 'lieu', name: 'Domaine des Cyprès', entity_type: 'place', category: 'lieu', status: 'confirmed', truth_status: 'verified' },
  ],
  blocks: [
    { key: 'photo', label: 'Arrivée & installation photographe', start_time: '14:00', end_time: '14:30', block_type: 'setup', buffer_minutes: 15, status: 'confirmed' },
    { key: 'seance', label: 'Séance photo couple', start_time: '15:00', end_time: '16:00', block_type: 'moment', buffer_minutes: 10, status: 'planned' },
    { key: 'ceremonie', label: 'Cérémonie', start_time: '16:30', end_time: '17:15', block_type: 'moment', buffer_minutes: 0, status: 'confirmed' },
    { key: 'cocktail', label: 'Cocktail', start_time: '17:15', end_time: '19:00', block_type: 'moment', buffer_minutes: 0, status: 'planned' },
    { key: 'traiteur', label: 'Installation traiteur', start_time: '17:30', end_time: '19:15', block_type: 'setup', buffer_minutes: 15, status: 'confirmed' },
    { key: 'diner', label: 'Dîner', start_time: '19:30', end_time: '21:30', block_type: 'moment', buffer_minutes: 0, status: 'planned' },
    { key: 'dj', label: 'Installation DJ', start_time: '21:00', end_time: '21:45', block_type: 'setup', buffer_minutes: 15, status: 'confirmed' },
    { key: 'soiree', label: 'Soirée dansante', start_time: '22:00', end_time: '02:00', block_type: 'moment', buffer_minutes: 0, status: 'planned' },
  ],
  relations: [
    { from: 'seance', to: 'photo', relation_type: 'depends_on', strength: 'critical', description: 'La séance nécessite le photographe installé' },
    { from: 'seance', to: 'video', relation_type: 'depends_on', strength: 'weak', description: 'Coordination vidéo souhaitée' },
    { from: 'ceremonie', to: 'photo', relation_type: 'depends_on', strength: 'important', description: 'Couverture photo de la cérémonie' },
    { from: 'seance', to: 'ceremonie', relation_type: 'must_precede', strength: 'critical', description: 'La séance doit se terminer avant la cérémonie' },
    { from: 'ceremonie', to: 'cocktail', relation_type: 'must_precede', strength: 'critical', description: 'Le cocktail suit la cérémonie' },
    { from: 'cocktail', to: 'diner', relation_type: 'must_precede', strength: 'important', description: 'Le dîner suit le cocktail' },
    { from: 'diner', to: 'traiteur', relation_type: 'depends_on', strength: 'critical', description: 'Le dîner nécessite le traiteur en place' },
    { from: 'diner', to: 'soiree', relation_type: 'must_precede', strength: 'important', description: 'La soirée suit le dîner' },
    { from: 'soiree', to: 'dj', relation_type: 'depends_on', strength: 'critical', description: 'La soirée nécessite le DJ installé' },
    { from: 'photo', to: 'lieu', relation_type: 'located_at', strength: 'weak', description: 'Accès au lieu requis' },
  ],
  constraints: [
    { key: 'photo', description: 'Le photographe doit être installé avant 15h00', constraint_type: 'before', time_value: '15:00', severity: 'critical' },
    { key: 'seance', description: 'La séance doit se terminer avant 16h15 (préparation cérémonie)', constraint_type: 'deadline', time_value: '16:15', severity: 'critical' },
    { key: 'ceremonie', description: 'Cérémonie en extérieur avant 18h30 (lumière naturelle)', constraint_type: 'before', time_value: '18:30', severity: 'important' },
    { key: 'traiteur', description: 'Accès cuisine à partir de 17h00', constraint_type: 'after', time_value: '17:00', severity: 'important' },
    { key: 'dj', description: 'Installation DJ terminée avant 22h00', constraint_type: 'deadline', time_value: '22:00', severity: 'important' },
  ],
};

export async function createDemoWorld(db, template = DEMO_TEMPLATE, nameOverride) {
  const world = await db.WeddingWorld.create({ ...template.world, name: nameOverride || template.world.name });
  const ids = {};
  for (const e of template.entities) {
    const created = await db.WorldEntity.create({
      world_id: world.id, name: e.name, entity_type: e.entity_type, category: e.category,
      status: e.status, truth_status: e.truth_status,
    });
    ids[e.key] = created.id;
  }
  for (const b of template.blocks) {
    await db.TimeBlock.create({
      world_id: world.id, entity_id: ids[b.key], label: b.label, start_time: b.start_time,
      end_time: b.end_time, block_type: b.block_type, buffer_minutes: b.buffer_minutes, status: b.status,
    });
  }
  for (const r of template.relations) {
    await db.WorldRelation.create({
      world_id: world.id, from_entity_id: ids[r.from], to_entity_id: ids[r.to],
      relation_type: r.relation_type, strength: r.strength, description: r.description,
    });
  }
  for (const c of template.constraints) {
    await db.Constraint.create({
      world_id: world.id, entity_id: ids[c.key], description: c.description,
      constraint_type: c.constraint_type, time_value: c.time_value, severity: c.severity, status: 'unknown',
    });
  }
  await logAudit(db, world.id, { actor: 'Système', action_code: ACTION.WORLD_SEEDED, action: 'Univers créé', target: world.name, source: 'system', justification: 'Seed reproductible' });
  await emitEvent(db, world.id, 'WeddingCreated', { name: world.name }, 'system');
  const state = await recalculateWorld(db, world.id, { source: 'system' });
  return { world, entity_ids: ids, state };
}