import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useWorld } from '@/hooks/useWorld';
import { engine } from '@/lib/engineClient';
import { eventView } from '@/lib/events';
import EventCard from '@/components/events/EventCard';
import EventGraph from '@/components/events/EventGraph';

export default function Events() {
  const { data, activeWorldId, refresh, isLoading } = useWorld();
  const [seeding, setSeeding] = useState(false);
  const view = eventView(data);

  const seed = async () => {
    setSeeding(true);
    await engine.seedEventGraph(activeWorldId);
    refresh();
    setSeeding(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      <header className="space-y-3">
        <span className="aime-tag">Event Graph — Service Orchestration</span>
        <h2 className="text-4xl font-bold text-foreground">Événements</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Un événement est une entité du même World : il relie le temps, les personnes et les ressources autour de ce
          qui doit réellement se produire. Son état n'est jamais supposé — il reste inconnu tant que le World ne le dit pas.
        </p>
        {activeWorldId && view.events.length === 0 && (
          <button className="aime-btn-secondary" onClick={seed} disabled={seeding}>
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Créer le graphe des événements
          </button>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement de l'univers…</p>}
      {!isLoading && view.events.length === 0 && <p className="text-sm text-muted-foreground">Aucun événement dans cet univers.</p>}

      {view.events.length > 0 && (
        <>
          <EventGraph view={view} />
          <div className="grid md:grid-cols-2 gap-4">
            {view.events.map((e) => {
              const ev = view.evalOf(e.id);
              return (
                <EventCard
                  key={e.id}
                  event={e}
                  evaluation={ev}
                  participants={view.participantsOf(e.id)}
                  venue={ev && ev.venue_id ? view.byId[ev.venue_id] : null}
                  conflicts={view.conflictsOf(e.id)}
                  dependencies={view.dependenciesOf(e.id)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}