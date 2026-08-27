// Vocabulaire d'affichage du People Graph (miroir de base44/shared/engine/social.ts).
export const RSVP_LABELS = {
  INVITED: 'Invité',
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  DECLINED: 'Absent',
  MAYBE: 'Peut-être',
};

export const RSVP_ORDER = ['INVITED', 'PENDING', 'CONFIRMED', 'MAYBE', 'DECLINED'];

export const RELATION_LABELS = {
  family: 'famille de',
  parent_of: 'parent de',
  child_of: 'enfant de',
  partner_of: 'en couple avec',
  friend_of: 'ami de',
  colleague_of: 'collègue de',
  witness_of: 'témoin de',
  guardian_of: 'responsable de',
  caregiver_of: 'aidant de',
  plus_one_of: '+1 de',
  group_member: 'membre de',
  assigned_to: 'placé à',
};

export const SOCIAL_CONSTRAINT_LABELS = {
  must_be_near: 'Doit être proche de',
  must_be_separated: 'Doit être séparé de',
  same_table: 'Même table',
  different_table: 'Tables différentes',
  same_group: 'Même groupe',
  accessibility_required: 'Accessibilité requise',
  child_with_guardian: 'Enfant avec son responsable',
  elder_near_exit: 'Placement près d’une sortie',
  capacity: 'Capacité',
};

export const isSocialConstraint = (type) => Object.prototype.hasOwnProperty.call(SOCIAL_CONSTRAINT_LABELS, type);

// Toutes les vues dérivent du même World : aucune donnée sociale n'est stockée à part.
export function socialView({ entities = [], relations = [] }) {
  const people = entities.filter((e) => e.entity_type === 'person');
  const groups = entities.filter((e) => e.entity_type === 'group');
  const tables = entities.filter((e) => e.entity_type === 'table');
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  const assignments = relations.filter((r) => r.relation_type === 'assigned_to');
  const memberships = relations.filter((r) => r.relation_type === 'group_member');
  const social = relations.filter((r) => !['assigned_to', 'group_member', 'depends_on', 'must_precede', 'provides', 'located_at', 'impacts'].includes(r.relation_type));

  const tableOf = (personId) => byId[(assignments.find((r) => r.from_entity_id === personId) || {}).to_entity_id];
  const membersOf = (groupId) => memberships.filter((r) => r.to_entity_id === groupId).map((r) => byId[r.from_entity_id]).filter(Boolean);
  const seatedAt = (tableId) => assignments.filter((r) => r.to_entity_id === tableId).map((r) => byId[r.from_entity_id]).filter(Boolean);
  const relationsOf = (personId) => social.filter((r) => r.from_entity_id === personId || r.to_entity_id === personId);

  return { people, groups, tables, byId, assignments, memberships, social, tableOf, membersOf, seatedAt, relationsOf };
}