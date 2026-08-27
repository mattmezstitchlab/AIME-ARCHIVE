import React from 'react';
import { useWorld } from '@/hooks/useWorld';
import { socialView, RSVP_LABELS } from '@/lib/social';
import SocialHeader from '@/components/people/SocialHeader';

export default function Groups() {
  const { data } = useWorld();
  const view = socialView(data);

  return (
    <div className="max-w-5xl mx-auto px-6 pb-16">
      <SocialHeader
        title="Groupes"
        subtitle="Un groupe est une entité du monde ; l'appartenance est une relation. Une personne peut appartenir à plusieurs groupes sans être dupliquée."
      />
      {view.groups.length === 0 && <p className="text-sm text-muted-foreground">Aucun groupe dans cet univers.</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {view.groups.map((g) => {
          const members = view.membersOf(g.id);
          return (
            <div key={g.id} className="rounded-xl border border-border bg-background p-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{g.name}</p>
                <span className="aime-tag">{members.length} membre(s)</span>
              </div>
              {members.length === 0 && <p className="text-xs text-muted-foreground">Aucun membre déclaré.</p>}
              {members.map((m) => (
                <p key={m.id} className="text-xs text-foreground">
                  {m.name} <span className="text-muted-foreground">· {RSVP_LABELS[m.rsvp_status] || 'RSVP inconnu'}{view.tableOf(m.id) ? ` · ${view.tableOf(m.id).name}` : ''}</span>
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}