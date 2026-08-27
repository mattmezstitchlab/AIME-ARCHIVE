import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWorld } from '@/hooks/useWorld';
import { engine } from '@/lib/engineClient';
import ChatMessage from '@/components/chat/ChatMessage';
import { Send, Loader2 } from 'lucide-react';

const WELCOME = "Je suis GAÏA. Je comprends votre mariage comme un système vivant.\nDemandez-moi par exemple : « Et si le photographe arrivait à 15h ? » ou « Quelles sont les contraintes critiques ? »";

export default function Chat() {
  const { data, refresh, activeWorldId } = useWorld();
  const [messages, setMessages] = useState([{ role: 'gaia', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const patchScenario = (id, patch) =>
    setMessages((m) => m.map((msg) => (msg.scenario?.id === id ? { ...msg, scenario: { ...msg.scenario, ...patch } } : msg)));

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !data.world) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);

    // 1. Le LLM interprète uniquement la demande.
    const res = await base44.functions.invoke('gaiaChat', {
      message: text,
      world: { name: data.world.name, wedding_date: data.world.wedding_date, location: data.world.location, guest_count: data.world.guest_count, budget_total: data.world.budget_total },
      blocks: data.blocks.map((b) => ({ id: b.id, label: b.label, entity_id: b.entity_id, start_time: b.start_time, end_time: b.end_time, block_type: b.block_type, status: b.status })),
      entities: data.entities.map((e) => ({ id: e.id, name: e.name, entity_type: e.entity_type, category: e.category, status: e.status })),
      constraints: data.constraints.map((c) => ({ entity_id: c.entity_id, description: c.description, constraint_type: c.constraint_type, time_value: c.time_value, severity: c.severity, status: c.status })),
      people: data.entities.filter((e) => e.entity_type === 'person').map((p) => ({ id: p.id, name: p.name, role: p.role, rsvp_status: p.rsvp_status })),
      tables: data.entities.filter((e) => e.entity_type === 'table').map((t) => ({ id: t.id, name: t.name, capacity: t.capacity, location: t.location })),
    });
    const { reply, intent, block_id, new_start, person_id, rsvp_status, table_id } = res.data;

    if (!['simulate_time_change', 'simulate_rsvp', 'simulate_table_assignment'].includes(intent)) {
      setMessages((m) => [...m, { role: 'gaia', text: reply }]);
      setBusy(false);
      return;
    }

    // 2. Le moteur déterministe valide et décide.
    const out = intent === 'simulate_time_change'
      ? await engine.createScenario(activeWorldId, block_id, new_start, { description: reply })
      : await engine.createSocialScenario(
        activeWorldId,
        intent === 'simulate_rsvp'
          ? { type: 'rsvp', person_id, rsvp_status }
          : { type: 'assign_table', person_id, table_id },
        reply,
      );
    const result = out.result;
    if (result.type === 'UNKNOWN') {
      setMessages((m) => [...m, {
        role: 'gaia',
        text: `Je ne possède pas cette information : ${result.reason}.\nInformation requise : ${(result.required_information || []).join(', ') || 'non déterminée'}. Je ne décide pas à votre place.`,
      }]);
      setBusy(false);
      return;
    }
    if (result.type === 'NO_IMPACT') {
      setMessages((m) => [...m, { role: 'gaia', text: `${reply}\n\nRésultat déterministe : aucun impact. ${result.reason}` }]);
      setBusy(false);
      return;
    }
    setMessages((m) => [...m, { role: 'gaia', text: reply, scenario: out.scenario, result }]);
    refresh();
    setBusy(false);
  };

  const handleApply = async (scenario) => {
    setBusy(true);
    const out = await engine.apply(scenario.id);
    if (!out.ok) {
      patchScenario(scenario.id, { status: out.status || 'draft' });
      setMessages((m) => [...m, { role: 'gaia', text: `Application impossible : ${out.error}. Aucun changement partiel n'a été conservé.` }]);
    } else {
      patchScenario(scenario.id, { status: 'applied' });
      setMessages((m) => [...m, {
        role: 'gaia',
        text: `Scénario appliqué (${out.changes} bloc(s)). Recalcul complet effectué : santé ${out.state.health.score}/100, ${out.state.conflicts.length} conflit(s), ${out.state.constraints.filter((c) => c.status === 'violated').length} contrainte(s) violée(s).`,
      }]);
    }
    refresh();
    setBusy(false);
  };

  const handleAbandon = async (scenario) => {
    setBusy(true);
    await engine.abandon(scenario.id);
    patchScenario(scenario.id, { status: 'abandoned' });
    refresh();
    setBusy(false);
  };

  const handleRollback = async (scenario) => {
    setBusy(true);
    const out = await engine.rollback(scenario.id);
    if (out.ok) {
      patchScenario(scenario.id, { status: 'reverted' });
      setMessages((m) => [...m, { role: 'gaia', text: `Scénario annulé : ${out.restored} bloc(s) restauré(s) à leur état initial. Santé recalculée : ${out.state.health.score}/100.` }]);
    } else {
      setMessages((m) => [...m, { role: 'gaia', text: `Annulation impossible : ${out.error}` }]);
    }
    refresh();
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] max-w-3xl mx-auto px-6">
      <header className="pt-12 pb-4">
        <span className="aime-tag">Interface conversationnelle</span>
        <h2 className="text-3xl font-bold text-foreground mt-3">Chat GAÏA</h2>
        <p className="text-xs text-muted-foreground mt-2">Le langage est interprété ; les conséquences sont calculées par le moteur déterministe.</p>
      </header>
      <div className="flex-1 overflow-y-auto py-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} onApply={handleApply} onAbandon={handleAbandon} onRollback={handleRollback} busy={busy} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-11">
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> GAÏA analyse l'univers…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="pb-8 pt-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-background p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] focus-within:border-ring transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Et si… ? Demandez à GAÏA."
            className="flex-1 bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="aime-btn-secondary"
            style={{ width: 40, height: 40, padding: 0, justifyContent: 'center', opacity: busy || !input.trim() ? 0.3 : 1 }}
            aria-label="Envoyer"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}