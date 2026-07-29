import { base44 } from '@/api/base44Client';

/**
 * Log an audit event for an entity change.
 */
export async function logAudit({ entityType, entityId, entityTitle, action, fieldChanged, oldValue, newValue, user, snapshot }) {
  try {
    await base44.entities.AuditLog.create({
      entity_type: entityType,
      entity_id: entityId,
      entity_title: entityTitle || entityId,
      action,
      field_changed: fieldChanged || null,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: newValue != null ? String(newValue) : null,
      by_user_id: user?.email || 'system',
      by_user_name: user?.display_name || user?.display_name || user?.full_name || user?.email || 'system',
      snapshot: snapshot ? JSON.stringify(snapshot) : null,
    });
  } catch (e) {
    // Audit log failures are silent
    console.warn('AuditLog error:', e);
  }
}