import { evaluateAll, CONSTRAINT_STATUS } from './constraints.ts';
import { detectConflicts } from './conflicts.ts';
import { computeHealth } from './health.ts';
import { ACTION, logAudit, emitEvent } from './audit.ts';

export async function loadWorld(db, worldId) {
  const world = await db.WeddingWorld.get(worldId);
  const [entities, blocks, relations, constraints, scenarios] = await Promise.all([
    db.WorldEntity.filter({ world_id: worldId }),
    db.TimeBlock.filter({ world_id: worldId }),
    db.WorldRelation.filter({ world_id: worldId }),
    db.Constraint.filter({ world_id: worldId }),
    db.Scenario.filter({ world_id: worldId }, '-created_date'),
  ]);
  return { world, entities, blocks, relations, constraints, scenarios };
}

// ORCHESTRATEUR DÉTERMINISTE : WORLD_CHANGED -> contraintes -> conflits -> santé.
// Ce n'est pas un bus asynchrone : c'est un pipeline exécuté à chaque mutation du monde.
export async function recalculateWorld(db, worldId, { source = 'system', scenarioId = null } = {}) {
  const { world, entities, blocks, relations, constraints, scenarios } = await loadWorld(db, worldId);
  const evaluations = evaluateAll(constraints, blocks, { entities, relations });
  const conflicts = detectConflicts({ blocks, relations, entities });

  for (const ev of evaluations) {
    if (ev.constraint.status === ev.status) continue;
    await db.Constraint.update(ev.constraint.id, { status: ev.status });
    if (ev.status === CONSTRAINT_STATUS.VIOLATED || ev.constraint.status === CONSTRAINT_STATUS.VIOLATED) {
      await logAudit(db, worldId, {
        actor: 'GAÏA',
        action_code: ev.status === CONSTRAINT_STATUS.VIOLATED ? ACTION.CONSTRAINT_VIOLATED : ACTION.CONSTRAINT_RESOLVED,
        action: ev.status === CONSTRAINT_STATUS.VIOLATED ? 'Contrainte violée' : 'Contrainte résolue',
        target: ev.constraint.description,
        old_value: ev.constraint.status,
        new_value: ev.status,
        source: 'system',
        scenario_id: scenarioId || undefined,
        justification: ev.detail || ev.constraint.description,
      });
    }
  }

  const health = computeHealth({ evaluations, conflicts, entities, scenarios, relations, blocks });

  const eventConflicts = conflicts.filter((c) => String(c.type).startsWith('EVENT_'));
  if (eventConflicts.length) {
    await logAudit(db, worldId, {
      actor: 'GAÏA', action_code: ACTION.EVENT_CONFLICT_DETECTED, action: 'Collision d’événement détectée',
      target: eventConflicts[0].message, new_value: eventConflicts[0].type, source: 'system',
      scenario_id: scenarioId || undefined, impact_count: eventConflicts.length,
      justification: eventConflicts.map((c) => c.message).join(' · '),
    });
  }
  await db.WeddingWorld.update(worldId, { health });
  await emitEvent(db, worldId, 'WorldRecalculated', {
    scenario_id: scenarioId, score: health.score, conflicts: conflicts.length,
    violated: evaluations.filter((e) => e.status === CONSTRAINT_STATUS.VIOLATED).length,
  }, source, health.score < 70 ? 'warning' : 'info');

  return {
    health,
    conflicts,
    constraints: evaluations.map((e) => ({ id: e.constraint.id, description: e.constraint.description, status: e.status, severity: e.severity, detail: e.detail })),
    world_name: world && world.name,
  };
}