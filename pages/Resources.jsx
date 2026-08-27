import React, { useState } from 'react';
import { useWorld } from '@/hooks/useWorld';
import { engine } from '@/lib/engineClient';
import { resourceView, RESOURCE_CONSTRAINT_LABELS, isResourceConstraint } from '@/lib/resources';
import { levelStyle, CONSTRAINT_STATUS_LABELS } from '@/lib/levels';
import SocialHeader from '@/components/people/SocialHeader';
import ResourceCard from '@/components/resources/ResourceCard';
import { Sparkles, Loader2 } from 'lucide-react';

const STATUS_LEVEL = { violated: 'CRITICAL', unknown: 'MEDIUM', blocked: 'HIGH', satisfied: 'INFO' };

export default function Resources() {
  const { data, activeWorldId, refresh, isLoading } = useWorld();
  const view = resourceView(data);
  const [seeding, setSeeding] = useState(false);
  const conflicts = (data.world && data.world.health && data.world.health.conflicts) || [];
  const resourceConstraints = data.constraints.filter((c) => isResourceConstraint(c.constraint_type));

  const seed = async () => {
    setSeeding(true);
    await engine.seedResourceGraph(activeWorldId);
    refresh();
    setSeeding(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 pb-16">
      <SocialHeader
        title="Ressources"
        subtitle="Prestataires, lieux, services, matériel et véhicules sont des entités du même World Model. Leurs capacités et disponibilités ne deviennent des conséquences que si les relations existent réellement."
        actions={view.resources.length === 0 && activeWorldId ? (
          <button className="aime-btn-secondary" onClick={seed} disabled={seeding}>
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Créer le graphe des ressources
          </button>
        ) : null}
      />

      {isLoading && <p className="text-sm text-muted-foreground">Chargement de l'univers…</p>}
      {!isLoading && view.resources.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune ressource dans cet univers.</p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {view.resources.map((r) => (
          <ResourceCard
            key={r.id}
            resource={r}
            services={view.servicesOf(r.id)}
            team={view.teamOf(r.id)}
            blocks={view.blocksOf(r.id)}
            conflicts={conflicts.filter((c) => (c.entities || []).includes(r.id))}
          />
        ))}
      </div>

      {resourceConstraints.length > 0 && (
        <section className="mt-10 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Contraintes de ressources</h3>
          {resourceConstraints.map((c) => {
            const lv = levelStyle(STATUS_LEVEL[c.status] || 'MEDIUM');
            return (
              <div key={c.id} className={`rounded-xl border bg-background p-4 flex items-start justify-between gap-3 ${lv.ring}`}>
                <div>
                  <p className="text-sm text-foreground">{c.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {RESOURCE_CONSTRAINT_LABELS[c.constraint_type]} · {view.byId[c.entity_id]?.name || 'entité inconnue'}
                    {view.byId[c.target_entity_id] ? ` → ${view.byId[c.target_entity_id].name}` : ''}
                  </p>
                </div>
                <span className="flex items-center gap-2 text-xs shrink-0">
                  <span className={`w-2 h-2 rounded-full ${lv.dot}`} />
                  {CONSTRAINT_STATUS_LABELS[c.status] || c.status}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}