// LIVING IDENTITY SYSTEM — représentation visuelle d'une entité du World.
// Ce module ne crée aucune donnée : il ne fait que lire le World Model.
export const IDENTITY_STATE = {
  CONFIRMED: 'confirmed', DECLINED: 'declined', PENDING: 'pending',
  WARNING: 'warning', CONFLICT: 'conflict', SELECTED: 'selected', DEFAULT: 'default',
};

const RSVP_TO_STATE = {
  CONFIRMED: 'confirmed', DECLINED: 'declined', PENDING: 'pending', MAYBE: 'warning', INVITED: 'default',
};

const AVAILABILITY_TO_STATE = {
  AVAILABLE: 'confirmed', UNAVAILABLE: 'declined', PARTIALLY_AVAILABLE: 'warning', UNKNOWN: 'default',
};

export function initialsOf(entity) {
  if (!entity) return '?';
  const source = [entity.first_name, entity.last_name].filter(Boolean).join(' ') || entity.display_name || entity.name || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export function displayNameOf(entity) {
  if (!entity) return 'Entité inconnue';
  return entity.display_name || entity.name || 'Entité inconnue';
}

export function shortNameOf(entity) {
  if (!entity) return '—';
  return entity.first_name || entity.display_name || entity.name || '—';
}

// Le rôle vient du World, jamais d'une liste figée dans un composant.
export function roleOf(entity) {
  if (!entity) return '';
  return entity.role || entity.category || entity.entity_type || '';
}

export function stateOf(entity) {
  if (!entity) return 'default';
  if (entity.entity_type === 'person') return RSVP_TO_STATE[entity.rsvp_status] || 'default';
  return AVAILABILITY_TO_STATE[entity.availability] || 'default';
}

export function identityOf(entity) {
  return {
    id: entity && entity.id,
    photo: (entity && entity.avatar_url) || null,
    name: displayNameOf(entity),
    short: shortNameOf(entity),
    initials: initialsOf(entity),
    role: roleOf(entity),
    state: stateOf(entity),
  };
}