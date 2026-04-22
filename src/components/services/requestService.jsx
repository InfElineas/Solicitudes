import { base44 } from '@/api/base44Client';

// Valid status transitions
const VALID_TRANSITIONS = {
  'Pendiente': ['En progreso', 'Rechazada'],
  'En progreso': ['En revisión'],
  'En revisión': ['Finalizada', 'En progreso'],
  'Finalizada': [],
  'Rechazada': [],
};

export function getValidTransitions(currentStatus) {
  return VALID_TRANSITIONS[currentStatus] || [];
}

export function canTransition(fromStatus, toStatus) {
  return getValidTransitions(fromStatus).includes(toStatus);
}

export async function transitionRequestStatus(request, newStatus, note, user) {
  if (!canTransition(request.status, newStatus)) {
    throw new Error(`Transición inválida: ${request.status} → ${newStatus}`);
  }

  const updateData = { status: newStatus, updated_date: new Date().toISOString() };

  if (newStatus === 'Finalizada') {
    updateData.completion_date = new Date().toISOString();
  }

  await base44.entities.Request.update(request.id, updateData);

  await base44.entities.RequestHistory.create({
    request_id: request.id,
    from_status: request.status,
    to_status: newStatus,
    note: note || '',
    by_user_id: user.email,
    by_user_name: user.full_name || user.email,
  });

  return { ...request, ...updateData };
}

export async function moveToTrash(request, user, ttlDays = 30) {
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + ttlDays);

  await base44.entities.RequestTrash.create({
    original_request_id: request.id,
    snapshot: JSON.stringify(request),
    deleted_by_id: user.email,
    deleted_by_name: user.full_name || user.email,
    expire_at: expireAt.toISOString(),
  });

  await base44.entities.Request.update(request.id, { is_deleted: true });
}

export async function restoreFromTrash(trashItem) {
  const snapshot = JSON.parse(trashItem.snapshot) || {};
  await base44.entities.Request.update(snapshot.id, { is_deleted: false });
  await base44.entities.RequestTrash.delete(trashItem.id);
}

export function getUserRole(user) {
  return user?.role || 'employee';
}

export function canUserAccess(user, action) {
  const role = getUserRole(user);
  const permissions = {
    admin: ['view_all', 'create', 'edit', 'delete', 'assign', 'manage_users', 'manage_departments', 'manage_config', 'view_trash', 'restore_trash'],
    support: ['view_all', 'create', 'edit', 'assign'],
    employee: ['view_own', 'create'],
  };
  return (permissions[role] || []).includes(action);
}