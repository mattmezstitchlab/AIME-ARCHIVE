import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadWorld, recalculateWorld } from '../../shared/engine/world.ts';
import { simulateTimeChange } from '../../shared/engine/simulate.ts';
import { createScenario, applyScenario, abandonScenario, rollbackScenario } from '../../shared/engine/scenario.ts';
import { createDemoWorld } from '../../shared/engine/seed.ts';
import { seedSocialGraph } from '../../shared/engine/seedSocial.ts';
import { seedResourceGraph } from '../../shared/engine/seedResources.ts';
import { seedEventGraph } from '../../shared/engine/seedEvents.ts';
import { simulateSocialChange } from '../../shared/engine/simulateSocial.ts';
import { ACTION, logAudit } from '../../shared/engine/audit.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const db = base44.asServiceRole.entities;
    const body = await req.json();
    const action = body.action;
    const actor = user.full_name || 'Couple';

    if (action === 'worlds') {
      const worlds = await db.WeddingWorld.list('-created_date', 50);
      return Response.json({ worlds });
    }

    if (action === 'seedDemoWorld') {
      const result = await createDemoWorld(db, undefined, body.name);
      return Response.json(result);
    }

    const worldId = body.world_id;
    if (action === 'recalculate') {
      if (!worldId) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist' }, { status: 400 });
      const world = await db.WeddingWorld.get(worldId);
      if (!world) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist' }, { status: 400 });
      const state = await recalculateWorld(db, worldId, { source: body.source || 'user' });
      return Response.json(state);
    }

    if (action === 'simulate' || action === 'createScenario') {
      const world = worldId ? await db.WeddingWorld.get(worldId) : null;
      if (!world) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist', required_information: ['world_id'] });
      const ctx = await loadWorld(db, worldId);
      const result = simulateTimeChange({
        world: ctx.world, blocks: ctx.blocks, entities: ctx.entities,
        relations: ctx.relations, constraints: ctx.constraints,
        blockId: body.block_id, newStart: body.new_start,
      });
      if (action === 'simulate') return Response.json({ result });
      if (result.type === 'UNKNOWN' || result.type === 'NO_IMPACT') return Response.json({ result });

      const resolutionKey = body.resolution || result.recommended;
      const resolution = (result.resolutions || []).find((r) => r.key === resolutionKey) || result.resolutions[0];
      const block = ctx.blocks.find((b) => b.id === body.block_id);
      const scenario = await createScenario(db, worldId, {
        title: `${block.label} : ${block.start_time} → ${body.new_start}`,
        description: body.description || resolution.label,
        changes: resolution.changes,
        impacts: result.impacts || [],
        result_type: result.type,
        source: body.source === 'user' ? 'user' : 'gaia',
        blocks: ctx.blocks,
      });
      return Response.json({ result, scenario });
    }

    // ---- PEOPLE GRAPH : même World Model, mêmes AuditEvents ----
    if (action === 'seedSocialGraph') {
      if (!worldId) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist' }, { status: 400 });
      return Response.json(await seedSocialGraph(db, worldId));
    }

    if (action === 'seedResourceGraph') {
      if (!worldId) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist' }, { status: 400 });
      return Response.json(await seedResourceGraph(db, worldId));
    }

    if (action === 'seedEventGraph') {
      if (!worldId) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist' }, { status: 400 });
      return Response.json(await seedEventGraph(db, worldId));
    }

    if (action === 'createEntity') {
      if (!worldId) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist' }, { status: 400 });
      const payload = body.entity || {};
      if (!payload.name || !payload.entity_type) {
        return Response.json({ type: 'UNKNOWN', reason: 'Missing entity name or type', required_information: ['name', 'entity_type'] }, { status: 400 });
      }
      const entity = await db.WorldEntity.create({ ...payload, world_id: worldId });
      await logAudit(db, worldId, {
        actor, action_code: payload.entity_type === 'person' ? ACTION.PERSON_CREATED : ACTION.WORLD_RECALCULATED,
        action: 'Entité créée', target: entity.name, new_value: payload.entity_type, source: 'user',
        justification: payload.role || payload.entity_type,
      });
      const state = await recalculateWorld(db, worldId, { source: 'user' });
      return Response.json({ entity, state });
    }

    if (action === 'createRelation') {
      const from = await db.WorldEntity.get(body.from_entity_id).catch(() => null);
      const to = await db.WorldEntity.get(body.to_entity_id).catch(() => null);
      if (!from || !to || from.world_id !== worldId || to.world_id !== worldId) {
        return Response.json({ type: 'UNKNOWN', reason: 'Referenced entities do not exist in this world', required_information: ['from_entity_id', 'to_entity_id'] }, { status: 400 });
      }
      const relation = await db.WorldRelation.create({
        world_id: worldId, from_entity_id: from.id, to_entity_id: to.id,
        relation_type: body.relation_type, strength: body.strength || 'important', description: body.description,
      });
      await logAudit(db, worldId, {
        actor, action_code: ACTION.RELATION_CREATED, action: 'Relation créée', target: `${from.name} → ${to.name}`,
        new_value: body.relation_type, source: 'user', justification: body.description || body.relation_type,
      });
      const state = await recalculateWorld(db, worldId, { source: 'user' });
      return Response.json({ relation, state });
    }

    if (action === 'removeRelation') {
      const relation = await db.WorldRelation.get(body.relation_id).catch(() => null);
      if (!relation) return Response.json({ type: 'UNKNOWN', reason: 'Referenced relation does not exist' }, { status: 400 });
      await db.WorldRelation.delete(relation.id);
      await logAudit(db, relation.world_id, {
        actor, action_code: ACTION.RELATION_REMOVED, action: 'Relation supprimée', target: relation.relation_type,
        old_value: relation.relation_type, source: 'user', justification: relation.description || relation.relation_type,
      });
      const state = await recalculateWorld(db, relation.world_id, { source: 'user' });
      return Response.json({ ok: true, state });
    }

    if (action === 'createConstraint') {
      const entity = await db.WorldEntity.get(body.entity_id).catch(() => null);
      if (!entity || entity.world_id !== worldId) {
        return Response.json({ type: 'UNKNOWN', reason: 'Referenced entity does not exist in this world', required_information: ['entity_id'] }, { status: 400 });
      }
      const constraint = await db.Constraint.create({
        world_id: worldId, entity_id: entity.id, target_entity_id: body.target_entity_id || undefined,
        description: body.description, constraint_type: body.constraint_type, time_value: body.time_value,
        value: body.value, severity: body.severity || 'important', status: 'unknown',
      });
      await logAudit(db, worldId, {
        actor, action_code: ACTION.CONSTRAINT_CREATED, action: 'Contrainte créée', target: body.description,
        new_value: body.constraint_type, source: 'user', justification: body.description,
      });
      const state = await recalculateWorld(db, worldId, { source: 'user' });
      return Response.json({ constraint, state });
    }

    if (action === 'simulateSocial' || action === 'createSocialScenario') {
      const world = worldId ? await db.WeddingWorld.get(worldId) : null;
      if (!world) return Response.json({ type: 'UNKNOWN', reason: 'Referenced world does not exist', required_information: ['world_id'] });
      const ctx = await loadWorld(db, worldId);
      const intent = body.intent || {};
      const result = simulateSocialChange({ ...ctx, intent });
      if (result.type === 'CONFLICT') {
        await logAudit(db, worldId, {
          actor, action_code: ACTION.SOCIAL_CONFLICT_DETECTED, action: 'Collision sociale détectée',
          target: (result.conflicts[0] || {}).message, new_value: 'CONFLICT', source: 'system',
          justification: (result.conflicts || []).map((c) => c.message).join(' · '),
        });
      }
      if (action === 'simulateSocial') return Response.json({ result });
      if (result.type === 'UNKNOWN' || result.type === 'NO_IMPACT') return Response.json({ result });
      const resolution = result.resolutions[0];
      const person = ctx.entities.find((e) => e.id === intent.person_id);
      const scenario = await createScenario(db, worldId, {
        title: intent.type === 'rsvp' ? `${person.name} : RSVP → ${intent.rsvp_status}` : `${person.name} → affectation de table`,
        description: body.description || resolution.label,
        kind: 'social',
        intent,
        changes: resolution.changes,
        impacts: result.impacts || [],
        result_type: result.type,
        source: body.source === 'user' ? 'user' : 'gaia',
        blocks: ctx.blocks, entities: ctx.entities, relations: ctx.relations,
      });
      return Response.json({ result, scenario });
    }

    if (action === 'apply') return Response.json(await applyScenario(db, body.scenario_id, actor));
    if (action === 'abandon') return Response.json(await abandonScenario(db, body.scenario_id, actor));
    if (action === 'rollback') return Response.json(await rollbackScenario(db, body.scenario_id, actor));

    return Response.json({ error: `Action inconnue : ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}