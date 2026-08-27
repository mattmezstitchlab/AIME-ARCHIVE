import { useState } from 'react';
import { engine } from '@/lib/engineClient';
import { useWorld } from '@/hooks/useWorld';

// Toute mutation humaine passe par : intention -> moteur -> résultat causal -> scénario -> décision.
export default function useSocialScenario() {
  const { activeWorldId, refresh } = useWorld();
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const propose = async (intent, description) => {
    setBusy(true);
    setMessage(null);
    setPending(null);
    const out = await engine.createSocialScenario(activeWorldId, intent, description);
    if (out.scenario) setPending({ scenario: out.scenario, result: out.result });
    else setMessage(out.result?.reason || out.error || 'Aucun scénario produit.');
    setBusy(false);
  };

  const apply = async (scenario) => {
    setBusy(true);
    const out = await engine.apply(scenario.id);
    if (out.ok) {
      setPending(null);
      setMessage(`Scénario appliqué · santé ${out.state.health.score}/100.`);
    } else {
      setMessage(`Application refusée par le moteur (${out.reason}) : ${out.error}. Aucune modification.`);
    }
    refresh();
    setBusy(false);
  };

  const abandon = async (scenario) => {
    setBusy(true);
    await engine.abandon(scenario.id);
    setPending(null);
    setMessage('Scénario abandonné. Aucun changement.');
    refresh();
    setBusy(false);
  };

  return { pending, message, busy, propose, apply, abandon, clear: () => { setPending(null); setMessage(null); } };
}