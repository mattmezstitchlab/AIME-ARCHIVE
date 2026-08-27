import React from 'react';
import { useWorld } from '@/hooks/useWorld';
import { socialView, isSocialConstraint } from '@/lib/social';
import SocialHeader from '@/components/people/SocialHeader';
import SocialConstellation from '@/components/people/SocialConstellation';

export default function SocialGraph() {
  const { data } = useWorld();
  const view = socialView(data);
  const constraints = data.constraints.filter((c) => isSocialConstraint(c.constraint_type));

  return (
    <div className="max-w-5xl mx-auto px-6 pb-16">
      <SocialHeader
        title="Constellation sociale"
        subtitle="GAÏA au centre, les groupes en agrégats, les personnes en orbite. Les liens pleins colorés sont des contraintes, les liens pointillés des relations."
      />
      {view.people.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune personne à représenter.</p>
      ) : (
        <SocialConstellation view={view} constraints={constraints} />
      )}
    </div>
  );
}