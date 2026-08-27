import { blockInterval, overlaps, formatTime } from './time.ts';
import { severityFromStrength, maxSeverity } from './severity.ts';
import { primaryBlock } from './constraints.ts';
import { detectSocialConflicts } from './social.ts';
import { detectResourceConflicts } from './resources.ts';
import { detectEventConflicts } from './events.ts';

// Détection de collisions temporelles réelles.
// Un chevauchement n'est un conflit que si les blocs partagent une ressource (même entité)
// ou si les entités sont liées par une relation d'incompatibilité (depends_on / must_precede).
export function detectConflicts({ blocks = [], relations = [], entities = [] }) {
  const nameOf = (id) => (entities.find((e) => e.id === id) || {}).name || 'Élément';
  const conflicts = [];

  const linked = new Set();
  for (const r of relations) {
    if (r.relation_type === 'depends_on' || r.relation_type === 'must_precede' || r.relation_type === 'precedes') {
      linked.add(`${r.from_entity_id}|${r.to_entity_id}`);
      linked.add(`${r.to_entity_id}|${r.from_entity_id}`);
    }
  }

  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i];
      const b = blocks[j];
      const ia = blockInterval(a);
      const ib = blockInterval(b);
      if (!ia || !ib || !overlaps(ia, ib)) continue;
      const sameResource = a.entity_id === b.entity_id;
      const related = linked.has(`${a.entity_id}|${b.entity_id}`);
      if (!sameResource && !related) continue; // pas de faux conflit
      conflicts.push({
        type: 'OVERLAP',
        severity: sameResource ? 'CRITICAL' : 'HIGH',
        blocks: [a.id, b.id],
        entities: [a.entity_id, b.entity_id],
        message: sameResource
          ? `${nameOf(a.entity_id)} est requis simultanément : « ${a.label} » et « ${b.label} » se chevauchent.`
          : `« ${a.label} » et « ${b.label} » se chevauchent alors que ${nameOf(a.entity_id)} et ${nameOf(b.entity_id)} sont liés.`,
      });
    }
  }

  for (const r of relations) {
    const strength = severityFromStrength(r.strength);
    if (r.relation_type === 'must_precede' || r.relation_type === 'precedes') {
      const before = primaryBlock(r.from_entity_id, blocks);
      const after = primaryBlock(r.to_entity_id, blocks);
      if (!before || !after) continue;
      const ib = blockInterval(before);
      const ia = blockInterval(after);
      if (ib.end > ia.start) {
        conflicts.push({
          type: 'PRECEDENCE',
          severity: maxSeverity([strength, 'HIGH']),
          blocks: [before.id, after.id],
          entities: [r.from_entity_id, r.to_entity_id],
          message: `« ${before.label} » (fin ${formatTime(ib.end)}) doit précéder « ${after.label} » (début ${formatTime(ia.start)}).`,
        });
      } else if (ia.start - ib.end < ib.buffer) {
        conflicts.push({
          type: 'BUFFER',
          severity: 'MEDIUM',
          blocks: [before.id, after.id],
          entities: [r.from_entity_id, r.to_entity_id],
          message: `Marge insuffisante entre « ${before.label} » et « ${after.label} » : ${ia.start - ib.end} min pour ${ib.buffer} min requises.`,
        });
      }
    }
    if (r.relation_type === 'depends_on') {
      // from dépend de to : la ressource `to` doit être en place avant le début de `from`.
      const dependent = primaryBlock(r.from_entity_id, blocks);
      const provider = primaryBlock(r.to_entity_id, blocks);
      if (!dependent || !provider) continue;
      const ip = blockInterval(provider);
      const id = blockInterval(dependent);
      if (ip.end > id.start) {
        conflicts.push({
          type: 'DEPENDENCY',
          severity: maxSeverity([strength, r.strength === 'critical' ? 'CRITICAL' : 'MEDIUM']),
          blocks: [provider.id, dependent.id],
          entities: [r.to_entity_id, r.from_entity_id],
          message: `« ${dependent.label} » commence à ${formatTime(id.start)} alors que « ${provider.label} » n'est prêt qu'à ${formatTime(ip.end)}.`,
        });
      }
    }
  }
  // Dimension humaine : mêmes conflits structurels dans le même flux.
  conflicts.push(...detectSocialConflicts({ entities, relations }));
  // Dimension ressources : mêmes conflits structurels dans le même flux.
  conflicts.push(...detectResourceConflicts({ entities, relations, blocks }));
  // Event Graph : mêmes conflits structurels dans le même flux.
  conflicts.push(...detectEventConflicts({ entities, relations, blocks }));
  return conflicts;
}