import React from 'react';
import { useWorld } from '@/hooks/useWorld';
import NexusConstellation from '@/components/nexus/NexusConstellation';

export default function Nexus() {
  const { data, isLoading } = useWorld();
  if (isLoading) return <div className="nexus-loading">Chargement du monde…</div>;
  return <NexusConstellation data={data} />;
}
