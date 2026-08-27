import { base44 } from '@/api/base44Client';

// Event Bus : toute modification importante produit un événement interne.
export async function emitEvent(worldId, eventType, payload = {}, source = 'user', severity = 'info') {
  return base44.entities.SystemEvent.create({
    world_id: worldId,
    event_type: eventType,
    payload,
    source,
    severity,
  });
}

// Audit Log : chaque changement important est traçable.
export async function logAudit(worldId, entry) {
  return base44.entities.AuditEvent.create({ world_id: worldId, ...entry });
}