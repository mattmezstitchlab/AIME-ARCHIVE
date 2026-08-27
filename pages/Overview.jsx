import React, { useState } from 'react';
import { useWorld } from '@/hooks/useWorld';
import { engine } from '@/lib/engineClient';
import HealthPanel from '@/components/overview/HealthPanel';
import Constellation from '@/components/overview/Constellation';
import EventFeed from '@/components/overview/EventFeed';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RefreshCw, Loader2 } from 'lucide-react';

export default function Overview() {
  const { data, isLoading, refresh, activeWorldId } = useWorld();
  const [busy, setBusy] = useState(false);

  const seed = async () => {
    setBusy(true);
    await engine.seedDemoWorld();
    refresh();
    setBusy(false);
  };
  const recalc = async () => {
    setBusy(true);
    await engine.recalculate(activeWorldId);
    refresh();
    setBusy(false);
  };

  if (isLoading) {
    return <div className="p-12 text-muted-foreground text-sm">GAÏA observe l'univers…</div>;
  }
  const { world, entities, events } = data;
  if (!world) {
    return (
      <div className="p-12 max-w-lg">
        <h2 className="text-3xl font-bold text-foreground">Aucun univers</h2>
        <p className="text-sm text-muted-foreground mt-3 mb-6">
          Aucun WeddingWorld n'existe. Le moteur peut générer un univers de démonstration reproductible.
        </p>
        <button className="aime-btn-secondary" onClick={seed} disabled={busy}>
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          Créer un univers de démonstration
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-12 py-12 max-w-6xl mx-auto">
      <header className="mb-12 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="aime-tag">Wedding World</span>
          <h2 className="text-4xl font-bold text-foreground mt-4">{world.name}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {world.wedding_date && format(new Date(world.wedding_date), 'd MMMM yyyy', { locale: fr })}
            {world.location && ` · ${world.location}`}
            {world.guest_count ? ` · ${world.guest_count} invités` : ''}
            {world.budget_total ? ` · ${world.budget_total.toLocaleString('fr-FR')} €` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="aime-btn-primary" onClick={recalc} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Recalculer le monde
          </button>
          <button className="aime-btn-primary" onClick={seed} disabled={busy}>Nouvel univers</button>
        </div>
      </header>
      <div className="grid lg:grid-cols-[1fr_352px] gap-8 items-start">
        <div className="rounded-xl border border-border bg-card p-8">
          <Constellation entities={entities} />
        </div>
        <div className="space-y-8">
          <HealthPanel health={world.health} />
          <EventFeed events={events} />
        </div>
      </div>
    </div>
  );
}