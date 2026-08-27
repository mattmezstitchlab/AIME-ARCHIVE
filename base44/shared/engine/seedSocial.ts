import { ACTION, logAudit, emitEvent } from './audit.ts';
import { recalculateWorld } from './world.ts';

// Graphe humain de démonstration — décrit uniquement en données, jamais en logique.
export const SOCIAL_TEMPLATE = {
  people: [
    { key: 'lea', name: 'Léa Fontaine', first_name: 'Léa', last_name: 'Fontaine', role: 'mariée', rsvp_status: 'CONFIRMED', truth_status: 'verified' },
    { key: 'marco', name: 'Marco Bellini', first_name: 'Marco', last_name: 'Bellini', role: 'marié', rsvp_status: 'CONFIRMED', truth_status: 'verified' },
    { key: 'julie', name: 'Julie Roux', first_name: 'Julie', last_name: 'Roux', role: 'témoin', rsvp_status: 'PENDING', truth_status: 'verified' },
    { key: 'marc', name: 'Marc Roux', first_name: 'Marc', last_name: 'Roux', role: 'invité', rsvp_status: 'CONFIRMED', truth_status: 'verified' },
    { key: 'paul', name: 'Paul Verger', first_name: 'Paul', last_name: 'Verger', role: 'invité', rsvp_status: 'CONFIRMED', truth_status: 'verified' },
    { key: 'sophie', name: 'Sophie Roux', first_name: 'Sophie', last_name: 'Roux', role: 'mère de Julie', rsvp_status: 'CONFIRMED', truth_status: 'verified' },
    { key: 'robert', name: 'Robert Roux', first_name: 'Robert', last_name: 'Roux', role: 'père de Julie', rsvp_status: 'CONFIRMED', truth_status: 'verified', accessibility: ['NEEDS_NEAR_EXIT'] },
    { key: 'tom', name: 'Tom Roux', first_name: 'Tom', last_name: 'Roux', role: 'enfant', rsvp_status: 'CONFIRMED', truth_status: 'verified' },
    { key: 'nina', name: 'Nina Costa', first_name: 'Nina', last_name: 'Costa', role: '+1 de Marc', rsvp_status: 'MAYBE', truth_status: 'proposed' },
  ],
  groups: [
    { key: 'g_lea', name: 'Famille de Léa', category: 'famille' },
    { key: 'g_marco', name: 'Famille de Marco', category: 'famille' },
    { key: 'g_amis', name: "Amis d'enfance", category: 'amis' },
    { key: 'g_temoins', name: 'Équipe des témoins', category: 'temoins' },
    { key: 'g_enfants', name: 'Enfants', category: 'enfants' },
  ],
  tables: [
    { key: 't1', name: 'Table 1 — Honneur', capacity: 8, location: 'Salle principale, centre' },
    { key: 't2', name: 'Table 2 — Famille Roux', capacity: 6, location: 'Salle principale, près de la sortie' },
    { key: 't3', name: 'Table 3 — Amis', capacity: 2, location: 'Terrasse, plain-pied' },
  ],
  relations: [
    { from: 'lea', to: 'marco', relation_type: 'partner_of', strength: 'critical', description: 'Les mariés' },
    { from: 'julie', to: 'marc', relation_type: 'family', strength: 'important', description: 'Marc est le frère de Julie' },
    { from: 'sophie', to: 'julie', relation_type: 'parent_of', strength: 'important', description: 'Sophie est la mère de Julie' },
    { from: 'robert', to: 'julie', relation_type: 'parent_of', strength: 'important', description: 'Robert est le père de Julie' },
    { from: 'tom', to: 'sophie', relation_type: 'child_of', strength: 'critical', description: 'Tom est sous la responsabilité de Sophie' },
    { from: 'julie', to: 'lea', relation_type: 'witness_of', strength: 'critical', description: 'Julie est témoin de Léa' },
    { from: 'nina', to: 'marc', relation_type: 'plus_one_of', strength: 'important', description: 'Nina est le +1 de Marc' },
    { from: 'julie', to: 'g_temoins', relation_type: 'group_member', strength: 'important' },
    { from: 'julie', to: 'g_lea', relation_type: 'group_member', strength: 'important' },
    { from: 'marc', to: 'g_lea', relation_type: 'group_member', strength: 'important' },
    { from: 'sophie', to: 'g_lea', relation_type: 'group_member', strength: 'important' },
    { from: 'robert', to: 'g_lea', relation_type: 'group_member', strength: 'important' },
    { from: 'tom', to: 'g_enfants', relation_type: 'group_member', strength: 'important' },
    { from: 'paul', to: 'g_amis', relation_type: 'group_member', strength: 'important' },
    { from: 'nina', to: 'g_amis', relation_type: 'group_member', strength: 'important' },
    { from: 'marco', to: 'g_marco', relation_type: 'group_member', strength: 'important' },
    { from: 'lea', to: 't1', relation_type: 'assigned_to', strength: 'important' },
    { from: 'marco', to: 't1', relation_type: 'assigned_to', strength: 'important' },
    { from: 'julie', to: 't1', relation_type: 'assigned_to', strength: 'important' },
    { from: 'sophie', to: 't2', relation_type: 'assigned_to', strength: 'important' },
    { from: 'robert', to: 't2', relation_type: 'assigned_to', strength: 'important' },
    { from: 'tom', to: 't2', relation_type: 'assigned_to', strength: 'important' },
    { from: 'marc', to: 't2', relation_type: 'assigned_to', strength: 'important' },
    { from: 'paul', to: 't3', relation_type: 'assigned_to', strength: 'important' },
  ],
  constraints: [
    { key: 'marc', target: 'paul', description: 'Marc et Paul ne doivent pas être à la même table', constraint_type: 'must_be_separated', severity: 'critical' },
    { key: 'julie', target: 'sophie', description: 'Julie doit être proche de sa mère Sophie', constraint_type: 'must_be_near', severity: 'important' },
    { key: 'tom', description: 'Tom doit être à la table de son responsable', constraint_type: 'child_with_guardian', severity: 'critical' },
    { key: 'robert', description: 'Robert doit être placé près d\'une sortie', constraint_type: 'elder_near_exit', value: 'NEEDS_NEAR_EXIT', severity: 'important' },
    { key: 't1', description: 'Capacité de la Table 1', constraint_type: 'capacity', severity: 'important' },
    { key: 't2', description: 'Capacité de la Table 2', constraint_type: 'capacity', severity: 'important' },
    { key: 't3', description: 'Capacité de la Table 3', constraint_type: 'capacity', severity: 'important' },
  ],
};

export async function seedSocialGraph(db, worldId, template = SOCIAL_TEMPLATE) {
  const ids = {};
  for (const p of template.people) {
    const created = await db.WorldEntity.create({
      world_id: worldId, name: p.name, entity_type: 'person', category: 'invite',
      first_name: p.first_name, last_name: p.last_name, role: p.role,
      rsvp_status: p.rsvp_status, truth_status: p.truth_status, status: 'proposed',
      accessibility: p.accessibility || [],
    });
    ids[p.key] = created.id;
  }
  for (const g of template.groups) {
    const created = await db.WorldEntity.create({ world_id: worldId, name: g.name, entity_type: 'group', category: g.category, truth_status: 'verified', status: 'confirmed' });
    ids[g.key] = created.id;
  }
  for (const t of template.tables) {
    const created = await db.WorldEntity.create({ world_id: worldId, name: t.name, entity_type: 'table', category: 'table', capacity: t.capacity, location: t.location, truth_status: 'verified', status: 'confirmed' });
    ids[t.key] = created.id;
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
  await logAudit(db, worldId, { actor: 'Système', action_code: ACTION.SOCIAL_GRAPH_SEEDED, action: 'Graphe humain créé', target: `${template.people.length} personnes`, source: 'system', justification: 'Seed People Graph reproductible' });
  await emitEvent(db, worldId, 'SocialGraphSeeded', { people: template.people.length, groups: template.groups.length, tables: template.tables.length }, 'system');
  const state = await recalculateWorld(db, worldId, { source: 'system' });
  return { entity_ids: ids, state };
}