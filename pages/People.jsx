import React, { useState } from 'react';
import { useWorld } from '@/hooks/useWorld';
import { engine } from '@/lib/engineClient';
import { socialView } from '@/lib/social';
import SocialHeader from '@/components/people/SocialHeader';
import ScenarioPanel from '@/components/people/ScenarioPanel';
import PersonCard from '@/components/people/PersonCard';
import AddPersonForm from '@/components/people/AddPersonForm';
import useSocialScenario from '@/hooks/useSocialScenario';
import { Sparkles, Loader2 } from 'lucide-react';

export default function People() {
  const { data, activeWorldId, refresh, isLoading } = useWorld();
  const view = socialView(data);
  const { pending, message, busy, propose, apply, abandon } = useSocialScenario();
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    setSeeding(true);
    await engine.seedSocialGraph(activeWorldId);
    refresh();
    setSeeding(false);
  };

  const onRsvp = (person, status) =>
    propose({ type: 'rsvp', person_id: person.id, rsvp_status: status }, `RSVP de ${person.name} → ${status}`);

  return (
    <div className="max-w-5xl mx-auto px-6 pb-16">
      <SocialHeader
        title="Personnes"
        subtitle="Chaque personne est une entité du même univers. Un changement de RSVP est un changement du monde : il passe par une simulation avant toute écriture."
        actions={view.people.length === 0 && activeWorldId ? (
          <button className="aime-btn-secondary" onClick={seed} disabled={seeding}>
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Créer le graphe humain
          </button>
        ) : null}
      />

      <ScenarioPanel pending={pending} message={message} busy={busy} onApply={apply} onAbandon={abandon} />
      {activeWorldId && <AddPersonForm />}

      {isLoading && <p className="text-sm text-muted-foreground">Chargement de l'univers…</p>}
      {!isLoading && view.people.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune personne dans cet univers pour le moment.</p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {view.people.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            table={view.tableOf(p.id)}
            relations={view.relationsOf(p.id)}
            byId={view.byId}
            onRsvp={onRsvp}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}