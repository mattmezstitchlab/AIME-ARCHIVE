import React from 'react';
import { useWorld } from '@/hooks/useWorld';
import { socialView, isSocialConstraint, SOCIAL_CONSTRAINT_LABELS } from '@/lib/social';
import { levelStyle, CONSTRAINT_STATUS_LABELS } from '@/lib/levels';
import SocialHeader from '@/components/people/SocialHeader';

const STATUS_LEVEL = { violated: 'CRITICAL', unknown: 'MEDIUM', blocked: 'HIGH', satisfied: 'INFO' };

export default function SocialConstraints() {
  const { data } = useWorld();
  const view = socialView(data);
  const constraints = data.constraints.filter((c) => isSocialConstraint(c.constraint_type));

  return (
    <div className="max-w-5xl mx-auto px-6 pb-16">
      <SocialHeader
        title="Contraintes humaines"
        subtitle="Évaluées par le même moteur que les contraintes temporelles, avec le même vocabulaire de statut. Une relation décrit le monde ; une contrainte le contraint."
      />
      {constraints.length === 0 && <p className="text-sm text-muted-foreground">Aucune contrainte humaine dans cet univers.</p>}
      <div className="space-y-3">
        {constraints.map((c) => {
          const lv = levelStyle(STATUS_LEVEL[c.status] || 'MEDIUM');
          const a = view.byId[c.entity_id];
          const b = view.byId[c.target_entity_id];
          return (
            <div key={c.id} className={`rounded-xl border bg-background p-5 ${lv.ring}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {SOCIAL_CONSTRAINT_LABELS[c.constraint_type]} · {a?.name || 'entité inconnue'}
                    {b ? ` ↔ ${b.name}` : ''} · sévérité {c.severity}
                  </p>
                </div>
                <span className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${lv.dot}`} />
                  {CONSTRAINT_STATUS_LABELS[c.status] || c.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}