import React, { useState } from 'react';
import { useWorld } from '@/hooks/useWorld';
import { engine } from '@/lib/engineClient';
import ScenarioCard from '@/components/scenarios/ScenarioCard';

export default function Scenarios() {
  const { data, isLoading, refresh } = useWorld();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  if (isLoading) return <div className="p-12 text-muted-foreground text-sm">Chargement des scénarios…</div>;

  const run = async (scenario, fn) => {
    setBusyId(scenario.id);
    setError(null);
    const out = await fn(scenario.id);
    if (out && out.ok === false) setError(out.error);
    refresh();
    setBusyId(null);
  };

  return (
    <div className="px-6 lg:px-12 py-12 max-w-2xl mx-auto">
      <header className="mb-12">
        <span className="aime-tag">Scenario Engine</span>
        <h2 className="text-4xl font-bold text-foreground mt-4">Scénarios</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Chaque scénario est une transaction : snapshot avant application, application atomique, annulation possible.
        </p>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </header>
      <div className="space-y-6">
        {data.scenarios.map((sc) => (
          <ScenarioCard
            key={sc.id}
            scenario={sc}
            onApply={(s) => run(s, engine.apply)}
            onAbandon={(s) => run(s, engine.abandon)}
            onRollback={(s) => run(s, engine.rollback)}
            busy={busyId === sc.id}
          />
        ))}
        {data.scenarios.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun scénario. Demandez à GAÏA « Et si… ? » pour en créer un.</p>
        )}
      </div>
    </div>
  );
}