import { base44 } from '@/api/base44Client';

// Toute décision passe par le moteur déterministe côté serveur.
async function call(payload) {
  const res = await base44.functions.invoke('worldEngine', payload);
  return res.data;
}

export const engine = {
  listWorlds: () => call({ action: 'worlds' }),
  seedDemoWorld: (name) => call({ action: 'seedDemoWorld', name }),
  recalculate: (worldId) => call({ action: 'recalculate', world_id: worldId, source: 'user' }),
  simulate: (worldId, blockId, newStart) => call({ action: 'simulate', world_id: worldId, block_id: blockId, new_start: newStart }),
  createScenario: (worldId, blockId, newStart, { resolution, description } = {}) =>
    call({ action: 'createScenario', world_id: worldId, block_id: blockId, new_start: newStart, resolution, description }),
  // People Graph — même moteur, mêmes actions.
  seedSocialGraph: (worldId) => call({ action: 'seedSocialGraph', world_id: worldId }),
  // Resource Graph — même moteur, mêmes actions.
  seedResourceGraph: (worldId) => call({ action: 'seedResourceGraph', world_id: worldId }),
  // Event Graph — même moteur, mêmes actions.
  seedEventGraph: (worldId) => call({ action: 'seedEventGraph', world_id: worldId }),
  createEntity: (worldId, entity) => call({ action: 'createEntity', world_id: worldId, entity }),
  createRelation: (worldId, payload) => call({ action: 'createRelation', world_id: worldId, ...payload }),
  removeRelation: (relationId) => call({ action: 'removeRelation', relation_id: relationId }),
  createConstraint: (worldId, payload) => call({ action: 'createConstraint', world_id: worldId, ...payload }),
  simulateSocial: (worldId, intent) => call({ action: 'simulateSocial', world_id: worldId, intent }),
  createSocialScenario: (worldId, intent, description) =>
    call({ action: 'createSocialScenario', world_id: worldId, intent, description, source: 'user' }),
  apply: (scenarioId) => call({ action: 'apply', scenario_id: scenarioId }),
  abandon: (scenarioId) => call({ action: 'abandon', scenario_id: scenarioId }),
  rollback: (scenarioId) => call({ action: 'rollback', scenario_id: scenarioId }),
};