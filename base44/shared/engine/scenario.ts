import { ACTION, logAudit, emitEvent } from './audit.ts';
import { recalculateWorld, loadWorld } from './world.ts';
import { simulateTimeChange } from './simulate.ts';
import { simulateSocialChange } from './simulateSocial.ts';

// Seuls ces résultats causaux autorisent une mutation du monde.
const APPLICABLE = ['NO_IMPACT', 'IMPACT'];

const keyOf = (c) => `${c.kind || 'time_block'}:${c.block_id || c.target_id}@${c.new_value}`;
const signature = (changes) => changes.map(keyOf).sort().join('|');

// Snapshot polymorphe : temps, champ d'entité, relation. Une seule mécanique de rollback.
export function snapshotOf(changes, { blocks = [], entities = [], relations = [] }) {
  return changes.map((c) => {
    const kind = c.kind || 'time_block';
    if (kind === 'entity_field') {
      const e = entities.find((x) => x.id === c.target_id) || {};
      return { kind, target_id: c.target_id, field: c.field, label: e.name, value: e[c.field] || '' };
    }
    if (kind === 'relation_set') {
      const r = relations.find((x) => x.relation_type === c.relation_type && x.from_entity_id === c.target_id);
      const e = entities.find((x) => x.id === c.target_id) || {};
      return { kind, target_id: c.target_id, relation_type: c.relation_type, label: e.name, value: r ? r.to_entity_id : '' };
    }
    const b = blocks.find((x) => x.id === c.block_id) || {};
    return { kind, block_id: c.block_id, label: b.label, start_time: b.start_time, end_time: b.end_time };
  });
}

async function applyChange(db, change, snap) {
  const kind = change.kind || 'time_block';
  if (kind === 'entity_field') {
    if (!snap || !snap.target_id) throw new Error(`Entité introuvable : ${change.target_id}`);
    await db.WorldEntity.update(change.target_id, { [change.field]: change.new_value });
    return;
  }
  if (kind === 'relation_set') {
    const existing = await db.WorldRelation.filter({ world_id: change.world_id, from_entity_id: change.target_id, relation_type: change.relation_type });
    for (const r of existing) await db.WorldRelation.delete(r.id);
    if (change.new_value) {
      await db.WorldRelation.create({
        world_id: change.world_id, from_entity_id: change.target_id, to_entity_id: change.new_value,
        relation_type: change.relation_type, strength: 'important', description: change.reason,
      });
    }
    return;
  }
  if (!snap || !snap.start_time) throw new Error(`TimeBlock introuvable : ${change.block_id}`);
  await db.TimeBlock.update(change.block_id, { start_time: change.new_value, end_time: change.new_end || snap.end_time });
}

async function restore(db, snap, worldId) {
  if (snap.kind === 'entity_field') {
    await db.WorldEntity.update(snap.target_id, { [snap.field]: snap.value });
    return;
  }
  if (snap.kind === 'relation_set') {
    const existing = await db.WorldRelation.filter({ world_id: worldId, from_entity_id: snap.target_id, relation_type: snap.relation_type });
    for (const r of existing) await db.WorldRelation.delete(r.id);
    if (snap.value) {
      await db.WorldRelation.create({
        world_id: worldId, from_entity_id: snap.target_id, to_entity_id: snap.value,
        relation_type: snap.relation_type, strength: 'important', description: 'Restauration snapshot',
      });
    }
    return;
  }
  await db.TimeBlock.update(snap.block_id, { start_time: snap.start_time, end_time: snap.end_time });
}

function auditFor(change) {
  const kind = change.kind || 'time_block';
  if (kind === 'entity_field') {
    return change.field === 'rsvp_status'
      ? { action_code: ACTION.RSVP_CHANGED, action: 'RSVP modifié' }
      : { action_code: ACTION.PERSON_UPDATED, action: 'Personne mise à jour' };
  }
  if (kind === 'relation_set') return { action_code: ACTION.TABLE_ASSIGNMENT_CHANGED, action: 'Affectation de table modifiée' };
  return { action_code: ACTION.TIME_BLOCK_UPDATED, action: 'Horaire modifié' };
}

// VERROU DUR : le scénario est re-simulé sur l'état ACTUEL du monde avant toute mutation.
export async function revalidateScenario(db, scenario) {
  const changes = scenario.changes || [];
  if (!changes.length) return { valid: false, reason: 'UNKNOWN', detail: 'Scénario sans changement exploitable' };

  const world = await loadWorld(db, scenario.world_id);

  const drift = (scenario.snapshot_before || []).filter((s) => {
    if (s.kind === 'entity_field') {
      const e = world.entities.find((x) => x.id === s.target_id);
      return !e || (e[s.field] || '') !== (s.value || '');
    }
    if (s.kind === 'relation_set') {
      const r = world.relations.find((x) => x.relation_type === s.relation_type && x.from_entity_id === s.target_id);
      return (r ? r.to_entity_id : '') !== (s.value || '');
    }
    const b = world.blocks.find((x) => x.id === s.block_id);
    return !b || b.start_time !== s.start_time || (b.end_time || null) !== (s.end_time || null);
  });
  if (drift.length) {
    return { valid: false, reason: 'STALE_SCENARIO', detail: `Le monde a changé depuis la création du scénario : ${drift.map((d) => d.label).join(', ')}` };
  }

  let result;
  if (scenario.kind === 'social') {
    result = simulateSocialChange({ ...world, intent: scenario.intent || {} });
  } else {
    const seed = changes[0];
    result = simulateTimeChange({ ...world, blockId: seed.block_id, newStart: seed.new_value });
  }
  if (!APPLICABLE.includes(result.type)) {
    return { valid: false, reason: result.type, detail: result.reason, result };
  }
  const resolutions = result.resolutions || [];
  if (resolutions.length && !resolutions.some((r) => signature(r.changes) === signature(changes))) {
    return { valid: false, reason: 'STALE_SCENARIO', detail: 'Les conséquences calculées ne correspondent plus aux changements enregistrés', result };
  }
  return { valid: true, result };
}

export async function createScenario(db, worldId, { title, description, changes, impacts, result_type, source = 'gaia', kind = 'time', intent = null, blocks = [], entities = [], relations = [] }) {
  const scenario = await db.Scenario.create({
    world_id: worldId,
    title,
    description,
    kind,
    intent: intent || undefined,
    changes: changes.map((c) => ({ kind: 'time_block', ...c })),
    impacts,
    impacts_at_creation: impacts,
    result_type,
    status: 'draft',
    source,
    snapshot_before: snapshotOf(changes, { blocks, entities, relations }),
  });
  await emitEvent(db, worldId, 'ScenarioCreated', { scenario_id: scenario.id, title, result_type, kind }, source);
  await logAudit(db, worldId, {
    actor: source === 'gaia' ? 'GAÏA' : 'Couple', action_code: ACTION.SCENARIO_CREATED, action: 'Scénario créé',
    target: title, source, scenario_id: scenario.id, impact_count: (impacts || []).length, justification: description || title,
  });
  return scenario;
}

// APPLICATION ATOMIQUE avec compensation : tout ou rien.
export async function applyScenario(db, scenarioId, actor = 'Couple') {
  const scenario = await db.Scenario.get(scenarioId);
  if (!scenario) return { ok: false, error: 'Scenario introuvable' };
  if (scenario.status !== 'draft') return { ok: false, applied: false, reason: 'NOT_DRAFT', error: `Scénario non applicable (statut ${scenario.status})` };

  const check = await revalidateScenario(db, scenario);
  if (!check.valid) {
    await logAudit(db, scenario.world_id, {
      actor, action_code: ACTION.SCENARIO_REFUSED, action: 'Application refusée par le moteur', target: scenario.title,
      old_value: scenario.result_type, new_value: check.reason, source: 'system',
      scenario_id: scenario.id, justification: check.detail,
    });
    await emitEvent(db, scenario.world_id, 'ScenarioRefused', { scenario_id: scenario.id, reason: check.reason, detail: check.detail }, 'system', 'warning');
    return { ok: false, applied: false, reason: check.reason, error: check.detail, mutations: 0 };
  }

  const ctx = await loadWorld(db, scenario.world_id);
  const changes = (scenario.changes || []).map((c) => ({ ...c, world_id: scenario.world_id }));
  const before = snapshotOf(changes, ctx);
  const done = [];

  try {
    for (const ch of changes) {
      const snap = before[changes.indexOf(ch)];
      await applyChange(db, ch, snap);
      done.push(snap);
    }
  } catch (err) {
    for (const snap of done) await restore(db, snap, scenario.world_id);
    await db.Scenario.update(scenario.id, { status: 'failed', failure_reason: err.message, snapshot_before: before });
    await logAudit(db, scenario.world_id, {
      actor, action_code: ACTION.SCENARIO_FAILED, action: 'Application échouée', target: scenario.title,
      source: 'system', scenario_id: scenario.id, justification: err.message,
    });
    await emitEvent(db, scenario.world_id, 'ScenarioFailed', { scenario_id: scenario.id, error: err.message }, 'system', 'critical');
    return { ok: false, applied: false, reason: 'FAILED', status: 'failed', error: err.message, rolled_back: done.length };
  }

  const after = changes.map((ch) => ({
    kind: ch.kind || 'time_block', block_id: ch.block_id, target_id: ch.target_id, field: ch.field,
    label: ch.block_label || ch.target_label, value: ch.new_value,
    start_time: ch.kind ? undefined : ch.new_value, end_time: ch.kind ? undefined : (ch.new_end || null),
  }));
  await db.Scenario.update(scenario.id, {
    status: 'applied', applied_at: new Date().toISOString(), snapshot_before: before, snapshot_after: after,
  });

  for (const ch of changes) {
    await logAudit(db, scenario.world_id, {
      actor, ...auditFor(ch), target: ch.block_label || ch.target_label,
      old_value: String(ch.old_value ?? ''), new_value: String(ch.new_value ?? ''), source: 'user',
      scenario_id: scenario.id, impact_count: (scenario.impacts || []).length, justification: scenario.title,
    });
  }
  await logAudit(db, scenario.world_id, {
    actor, action_code: ACTION.SCENARIO_APPLIED, action: 'Scénario appliqué', target: scenario.title,
    source: 'user', scenario_id: scenario.id, impact_count: (scenario.impacts || []).length, justification: scenario.title,
  });
  await emitEvent(db, scenario.world_id, 'ScenarioApplied', { scenario_id: scenario.id, changes: changes.length }, 'user', 'warning');

  const state = await recalculateWorld(db, scenario.world_id, { source: 'chronos', scenarioId: scenario.id });
  return { ok: true, applied: true, status: 'applied', changes: changes.length, state };
}

export async function abandonScenario(db, scenarioId, actor = 'Couple') {
  const scenario = await db.Scenario.get(scenarioId);
  if (!scenario) return { ok: false, error: 'Scenario introuvable' };
  if (scenario.status !== 'draft') return { ok: false, error: `Statut ${scenario.status} : abandon impossible` };
  await db.Scenario.update(scenario.id, { status: 'abandoned', abandoned_at: new Date().toISOString() });
  await logAudit(db, scenario.world_id, {
    actor, action_code: ACTION.SCENARIO_ABANDONED, action: 'Scénario abandonné', target: scenario.title,
    source: 'user', scenario_id: scenario.id, justification: scenario.title,
  });
  await emitEvent(db, scenario.world_id, 'ScenarioAbandoned', { scenario_id: scenario.id }, 'user');
  return { ok: true, status: 'abandoned' };
}

// ROLLBACK RÉEL : restauration depuis snapshot_before, puis recalcul complet.
export async function rollbackScenario(db, scenarioId, actor = 'Couple') {
  const scenario = await db.Scenario.get(scenarioId);
  if (!scenario) return { ok: false, error: 'Scenario introuvable' };
  if (scenario.status !== 'applied') return { ok: false, error: `Seul un scénario appliqué peut être annulé (statut ${scenario.status})` };
  const snapshot = scenario.snapshot_before || [];
  if (!snapshot.length) return { ok: false, error: 'Aucun snapshot disponible : rollback impossible' };

  for (const snap of snapshot) await restore(db, snap, scenario.world_id);
  await db.Scenario.update(scenario.id, { status: 'reverted', reverted_at: new Date().toISOString() });
  await logAudit(db, scenario.world_id, {
    actor, action_code: ACTION.SCENARIO_REVERTED, action: 'Scénario annulé', target: scenario.title,
    source: 'user', scenario_id: scenario.id, justification: `Restauration de ${snapshot.length} élément(s)`,
  });
  await emitEvent(db, scenario.world_id, 'ScenarioReverted', { scenario_id: scenario.id, restored: snapshot.length }, 'user', 'warning');
  const state = await recalculateWorld(db, scenario.world_id, { source: 'chronos', scenarioId: scenario.id });
  return { ok: true, status: 'reverted', restored: snapshot.length, state };
}