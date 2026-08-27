import { blockInterval, formatTime, setBlockStart } from './time.ts';
import { primaryBlock } from './constraints.ts';

// Propagation temporelle réelle : un décalage se transmet aux blocs dépendants
// via must_precede et depends_on, en respectant durée et buffer_minutes.
export function propagate({ blocks, relations, seedChanges }) {
  const working = blocks.map((b) => ({ ...b }));
  const byId = Object.fromEntries(working.map((b) => [b.id, b]));
  const propagated = [];

  for (const ch of seedChanges) {
    const b = byId[ch.block_id];
    if (!b) continue;
    const next = setBlockStart(b, ch.new_value);
    if (next) Object.assign(b, next);
  }

  // Arêtes : entité source -> entité qui doit démarrer après.
  const edges = {};
  for (const r of relations) {
    let from = null;
    let to = null;
    if (r.relation_type === 'must_precede') { from = r.from_entity_id; to = r.to_entity_id; }
    if (r.relation_type === 'depends_on') { from = r.to_entity_id; to = r.from_entity_id; }
    if (!from || !to) continue;
    (edges[from] = edges[from] || []).push({ to, strength: r.strength });
  }

  let frontier = seedChanges.map((c) => (byId[c.block_id] || {}).entity_id).filter(Boolean);
  const seen = new Set(frontier);
  let depth = 0;
  while (frontier.length && depth < 8) {
    depth += 1;
    const next = [];
    for (const entityId of frontier) {
      const source = primaryBlock(entityId, working);
      if (!source) continue;
      const is = blockInterval(source);
      for (const edge of edges[entityId] || []) {
        const target = primaryBlock(edge.to, working);
        if (!target) continue;
        const it = blockInterval(target);
        const earliest = is.end + is.buffer;
        if (it.start >= earliest) continue;
        const delta = earliest - it.start;
        const before = { start_time: target.start_time, end_time: target.end_time };
        const moved = setBlockStart(target, formatTime(earliest));
        Object.assign(target, moved);
        propagated.push({
          block_id: target.id,
          block_label: target.label,
          field: 'start_time',
          old_value: before.start_time,
          new_value: moved.start_time,
          old_end: before.end_time,
          new_end: moved.end_time,
          shift_minutes: delta,
          reason: `Décalé de ${delta} min pour suivre « ${source.label} »`,
        });
        if (!seen.has(edge.to)) { seen.add(edge.to); next.push(edge.to); }
        else next.push(edge.to);
      }
    }
    frontier = next;
  }

  return { blocks: working, propagated };
}