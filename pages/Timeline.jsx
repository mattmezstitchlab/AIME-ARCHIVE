import React from 'react';
import { useWorld } from '@/hooks/useWorld';
import { toMinutes } from '@/lib/timeUtils';
import TimeBlockCard from '@/components/timeline/TimeBlockCard';

export default function Timeline() {
  const { data, isLoading } = useWorld();
  if (isLoading) return <div className="p-12 text-muted-foreground text-sm">Chronos assemble la timeline…</div>;
  const { entities, blocks, constraints, relations } = data;
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  // Timeline vivante : les visages affichés viennent des relations réelles de l'événement.
  const peopleOf = (entityId) => relations
    .filter((r) => (r.relation_type === 'participates_in' && r.to_entity_id === entityId)
      || (['requires_person', 'requires_vendor', 'requires_service', 'requires_resource'].includes(r.relation_type) && r.from_entity_id === entityId))
    .map((r) => byId[r.relation_type === 'participates_in' ? r.from_entity_id : r.to_entity_id])
    .filter(Boolean);
  const sorted = [...blocks].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  return (
    <div className="px-6 lg:px-12 py-12 max-w-2xl mx-auto">
      <header className="mb-12">
        <span className="aime-tag">Chronos — Time Engine</span>
        <h2 className="text-4xl font-bold text-foreground mt-4">Timeline</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Chaque bloc porte ses dépendances et contraintes. Pour simuler un changement, parlez-en à GAÏA.
        </p>
      </header>
      <section className="aime-timeline">
        <div className="tl-line" />
        {sorted.map((block) => (
          <TimeBlockCard
            key={block.id}
            block={block}
            entity={byId[block.entity_id]}
            people={peopleOf(block.entity_id)}
            constraints={constraints.filter((c) => c.entity_id === block.entity_id)}
          />
        ))}
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">Aucun bloc horaire.</p>}
      </section>
    </div>
  );
}