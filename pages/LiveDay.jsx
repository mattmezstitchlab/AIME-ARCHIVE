import React, { useState, useEffect } from 'react';
import { useWorld } from '@/hooks/useWorld';
import { toMinutes } from '@/lib/timeUtils';
import LiveSection from '@/components/live/LiveSection';
import { Clock, ArrowRight, TriangleAlert, ShieldAlert, GitBranch } from 'lucide-react';

export default function LiveDay() {
  const { data, isLoading } = useWorld();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  if (isLoading) return <div className="p-12 text-muted-foreground text-sm">Passage en mode opérationnel…</div>;

  const { entities, blocks, constraints, scenarios } = data;
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const line = (b) => ({ id: b.id, text: `${b.start_time} — ${b.label} · ${byId[b.entity_id]?.name || ''}` });
  const current = blocks.filter((b) => toMinutes(b.start_time) <= nowMin && (!b.end_time || toMinutes(b.end_time) > nowMin)).map(line);
  const upcoming = blocks.filter((b) => toMinutes(b.start_time) > nowMin).sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time)).slice(0, 3).map(line);
  const delayed = blocks.filter((b) => b.status === 'delayed').map(line);
  const risks = constraints.filter((c) => c.status !== 'satisfied').map((c) => ({ id: c.id, text: `${c.description} · ${byId[c.entity_id]?.name || ''} · ${c.status === 'unknown' ? 'information manquante' : 'violée'}` }));
  const decisions = scenarios.filter((s) => s.status === 'draft').map((s) => ({ id: s.id, text: s.title }));

  return (
    <div className="px-6 lg:px-12 py-12 max-w-4xl mx-auto">
      <header className="mb-12 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="aime-tag-live">Live Day</span>
          <h2 className="text-4xl font-bold text-foreground mt-4">Jour J</h2>
        </div>
        <p className="text-3xl font-bold text-foreground tracking-[-0.04em]">
          {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
        </p>
      </header>
      <div className="grid sm:grid-cols-2 gap-6">
        <LiveSection title="Maintenant" icon={Clock} dot="aime-green" items={current} empty="Aucune opération en cours." />
        <LiveSection title="Prochainement" icon={ArrowRight} dot="aime-blue" items={upcoming} empty="Plus rien de prévu." />
        <LiveSection title="Retard" icon={TriangleAlert} dot="aime-yellow" items={delayed} empty="Aucun retard signalé." />
        <LiveSection title="Risque" icon={ShieldAlert} dot="aime-red" items={risks} empty="Aucun risque actif." />
        <LiveSection title="Décision requise" icon={GitBranch} dot="aime-blue" items={decisions} empty="Aucune décision en attente." />
      </div>
    </div>
  );
}