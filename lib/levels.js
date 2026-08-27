// Vocabulaire canonique unique (miroir de base44/shared/engine/severity.ts) pour l'affichage.
export const SEVERITY_ORDER = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const LEGACY = { critical: 'CRITICAL', important: 'HIGH', minor: 'MEDIUM', none: 'INFO', weak: 'LOW', warning: 'MEDIUM', info: 'INFO' };

export function normalizeSeverity(value) {
  if (!value) return 'INFO';
  const up = String(value).toUpperCase();
  if (SEVERITY_ORDER.includes(up)) return up;
  return LEGACY[String(value).toLowerCase()] || 'INFO';
}

export const LEVELS = {
  CRITICAL: { label: 'Critique', dot: 'bg-[#F87171]', text: 'text-red-600', ring: 'border-red-200' },
  HIGH: { label: 'Élevé', dot: 'bg-[#FB923C]', text: 'text-orange-600', ring: 'border-orange-200' },
  MEDIUM: { label: 'Moyen', dot: 'bg-[#FACC15]', text: 'text-yellow-600', ring: 'border-yellow-200' },
  LOW: { label: 'Faible', dot: 'bg-[#60A5FA]', text: 'text-blue-600', ring: 'border-blue-200' },
  INFO: { label: 'Aucun impact', dot: 'bg-[#4ADE80]', text: 'text-green-600', ring: 'border-green-200' },
};

export function levelStyle(value) {
  return LEVELS[normalizeSeverity(value)];
}

export const RESULT_LABELS = {
  NO_IMPACT: 'Aucun impact',
  IMPACT: 'Impact',
  UNKNOWN: 'Information manquante',
  CONFLICT: 'Conflit',
  BLOCKED: 'Bloqué',
};

export const CONSTRAINT_STATUS_LABELS = {
  satisfied: 'Respectée',
  violated: 'Violée',
  unknown: 'Inconnue',
  blocked: 'Bloquée',
};

export const SCENARIO_STATUS_LABELS = {
  draft: 'En attente de décision',
  applied: 'Appliqué',
  abandoned: 'Abandonné',
  failed: 'Échec — aucun changement appliqué',
  reverted: 'Annulé (état restauré)',
};

export const TRUTH_LABELS = {
  verified: 'Vérifié',
  inferred: 'Déduit',
  proposed: 'Proposé',
  unknown: 'Inconnu',
};