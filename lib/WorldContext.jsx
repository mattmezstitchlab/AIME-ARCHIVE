import React, { createContext, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const EMPTY = { world: null, entities: [], blocks: [], relations: [], constraints: [], scenarios: [], events: [] };
const Ctx = createContext(null);
const STORAGE_KEY = 'gaia.activeWorldId';

export function WorldProvider({ children }) {
  const qc = useQueryClient();
  const [activeWorldId, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) || null);

  const worldsQuery = useQuery({
    queryKey: ['worlds'],
    queryFn: () => base44.entities.WeddingWorld.list('-created_date', 50),
  });
  const worlds = worldsQuery.data || [];
  const resolvedId = (activeWorldId && worlds.some((w) => w.id === activeWorldId) ? activeWorldId : worlds[0]?.id) || null;

  const worldQuery = useQuery({
    enabled: !!resolvedId,
    queryKey: ['world', resolvedId],
    queryFn: async () => {
      const world = worlds.find((w) => w.id === resolvedId);
      const [entities, blocks, relations, constraints, scenarios, events] = await Promise.all([
        base44.entities.WorldEntity.filter({ world_id: resolvedId }),
        base44.entities.TimeBlock.filter({ world_id: resolvedId }),
        base44.entities.WorldRelation.filter({ world_id: resolvedId }),
        base44.entities.Constraint.filter({ world_id: resolvedId }),
        base44.entities.Scenario.filter({ world_id: resolvedId }, '-created_date'),
        base44.entities.SystemEvent.filter({ world_id: resolvedId }, '-created_date', 20),
      ]);
      return { world, entities, blocks, relations, constraints, scenarios, events };
    },
  });

  const setActiveWorldId = (id) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActive(id);
  };

  const value = {
    worlds,
    activeWorldId: resolvedId,
    setActiveWorldId,
    data: worldQuery.data || EMPTY,
    isLoading: worldsQuery.isLoading || (!!resolvedId && worldQuery.isLoading),
    refresh: () => {
      qc.invalidateQueries({ queryKey: ['worlds'] });
      qc.invalidateQueries({ queryKey: ['world'] });
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorld() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorld doit être utilisé dans WorldProvider');
  return ctx;
}