import React from 'react';
import { useWorld } from '@/hooks/useWorld';
import { socialView } from '@/lib/social';
import SocialHeader from '@/components/people/SocialHeader';
import ScenarioPanel from '@/components/people/ScenarioPanel';
import TableCard from '@/components/people/TableCard';
import useSocialScenario from '@/hooks/useSocialScenario';

export default function Tables() {
  const { data } = useWorld();
  const view = socialView(data);
  const { pending, message, busy, propose, apply, abandon } = useSocialScenario();

  const capacityOf = (tableId) => {
    const c = data.constraints.find((x) => x.constraint_type === 'capacity' && x.entity_id === tableId);
    return c ? `${c.description} · ${c.status}` : null;
  };

  const onAssign = (personId, table) => {
    const person = view.byId[personId];
    propose({ type: 'assign_table', person_id: personId, table_id: table.id }, `${person?.name} → ${table.name}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 pb-16">
      <SocialHeader
        title="Tables"
        subtitle="Une affectation est une relation du monde. Le moteur détecte les dépassements de capacité et les contraintes de placement avant toute écriture."
      />
      <ScenarioPanel pending={pending} message={message} busy={busy} onApply={apply} onAbandon={abandon} />
      {view.tables.length === 0 && <p className="text-sm text-muted-foreground">Aucune table dans cet univers.</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {view.tables.map((t) => (
          <TableCard
            key={t.id}
            table={t}
            seated={view.seatedAt(t.id)}
            people={view.people}
            constraintStatus={capacityOf(t.id)}
            onAssign={onAssign}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}