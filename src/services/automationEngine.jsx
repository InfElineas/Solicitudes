import { base44 } from '@/api/base44Client';

/**
 * Automation Rule Engine
 * Evaluates all active rules against open requests and fires configured actions.
 */

const TRIGGER_LABELS = {
  stale_48h: 'Sin actualización 48h',
  stale_24h: 'Sin actualización 24h',
  due_soon_24h: 'Vence en 24h',
  due_soon_48h: 'Vence en 48h',
  high_priority_unassigned: 'Alta prioridad sin asignar',
  status_change: 'Cambio de estado',
};

const ACTION_LABELS = {
  send_email: 'Enviar email',
  escalate_priority: 'Escalar prioridad',
  send_notification: 'Enviar notificación',
  change_status: 'Cambiar estado',
};

export { TRIGGER_LABELS, ACTION_LABELS };

/**
 * Checks if a request matches a trigger condition.
 */
function matchesTrigger(req, trigger) {
  const now = Date.now();
  const updatedAt = req.updated_date ? new Date(req.updated_date).getTime() : new Date(req.created_date).getTime();
  const dueDateMs = req.estimated_due ? new Date(req.estimated_due).getTime() : null;
  const isOpen = !['Finalizado', 'Rechazado', 'Cancelado'].includes(req.status);

  if (!isOpen) return false;

  switch (trigger) {
    case 'stale_48h':
      return (now - updatedAt) >= 48 * 3600 * 1000;
    case 'stale_24h':
      return (now - updatedAt) >= 24 * 3600 * 1000;
    case 'due_soon_24h':
      return dueDateMs && dueDateMs > now && (dueDateMs - now) <= 24 * 3600 * 1000;
    case 'due_soon_48h':
      return dueDateMs && dueDateMs > now && (dueDateMs - now) <= 48 * 3600 * 1000;
    case 'high_priority_unassigned':
      return (req.priority === 'P1 — Crítica' || req.priority === 'P2 — Alta') && !req.assigned_to_id;
    default:
      return false;
  }
}

/**
 * Checks extra condition filters on a request.
 */
function matchesConditions(req, conditions) {
  if (!conditions) return true;
  if (conditions.status && req.status !== conditions.status) return false;
  if (conditions.priority && req.priority !== conditions.priority) return false;
  if (conditions.type && req.type !== conditions.type) return false;
  return true;
}

/**
 * Executes a single action for a rule + request pair.
 */
async function executeAction(rule, req, user) {
  const cfg = rule.action_config || {};

  switch (rule.action) {
    case 'send_email': {
      const to = cfg.email_to || req.requester_id || user?.email;
      const subject = cfg.subject || `[Solicitud] ${req.title}`;
      const body = cfg.message
        ? cfg.message.replace('{{title}}', req.title).replace('{{status}}', req.status)
        : `La solicitud "<strong>${req.title}</strong>" requiere tu atención.<br><br>Estado actual: <strong>${req.status}</strong><br>Prioridad: <strong>${req.priority}</strong>`;
      await base44.integrations.Core.SendEmail({ to, subject, body });
      return `Email enviado a ${to}`;
    }

    case 'escalate_priority': {
      const priorityOrder = ['P4 — Baja', 'P3 — Media', 'P2 — Alta', 'P1 — Crítica'];
      const currentIdx = priorityOrder.indexOf(req.priority);
      const newPriority = currentIdx >= 0 && currentIdx < 3 ? priorityOrder[currentIdx + 1] : req.priority;
      if (newPriority !== req.priority) {
        await base44.entities.Request.update(req.id, { priority: newPriority });
        return `Prioridad escalada de ${req.priority} a ${newPriority}`;
      }
      return `Ya está en máxima prioridad (${req.priority})`;
    }

    case 'send_notification': {
      const userId = cfg.notify_user === 'assignee' ? req.assigned_to_id
        : cfg.notify_user === 'requester' ? req.requester_id
        : req.assigned_to_id || req.requester_id;
      if (!userId) return 'Sin destinatario de notificación';
      const message = (cfg.message || 'La solicitud "{{title}}" requiere atención.')
        .replace('{{title}}', req.title).replace('{{status}}', req.status);
      await base44.entities.Notification.create({
        user_id: userId,
        type: 'assigned',
        title: `⚙️ Regla: ${rule.name}`,
        message,
        request_id: req.id,
        request_title: req.title,
        is_read: false,
      });
      return `Notificación enviada a ${userId}`;
    }

    case 'change_status': {
      const newStatus = cfg.new_status;
      if (!newStatus || newStatus === req.status) return 'Sin cambio de estado';
      await base44.entities.Request.update(req.id, { status: newStatus });
      await base44.entities.RequestHistory.create({
        request_id: req.id,
        from_status: req.status,
        to_status: newStatus,
        note: `Cambiado automáticamente por regla: ${rule.name}`,
        by_user_id: 'system',
        by_user_name: 'Sistema Automático',
      });
      return `Estado cambiado a ${newStatus}`;
    }

    default:
      return 'Acción desconocida';
  }
}

/**
 * Main engine: runs all active rules against all open requests.
 * Returns a summary { processed, actions, errors }
 */
export async function runAutomationEngine(user) {
  const [rules, requests] = await Promise.all([
    base44.entities.AutomationRule.filter({ is_active: true }),
    base44.entities.Request.filter({ is_deleted: false }, '-updated_date', 500),
  ]);

  const openRequests = requests.filter(r => !['Finalizado', 'Rechazado', 'Cancelado'].includes(r.status));

  let actions = 0;
  let errors = 0;

  for (const rule of rules) {
    const matched = openRequests.filter(req =>
      matchesTrigger(req, rule.trigger) && matchesConditions(req, rule.conditions)
    );

    for (const req of matched) {
      let result = 'success';
      let detail = '';
      try {
        detail = await executeAction(rule, req, user);
        actions++;
      } catch (err) {
        result = 'error';
        detail = err?.message || 'Error desconocido';
        errors++;
      }

      // Log the execution
      await base44.entities.AutomationLog.create({
        rule_id: rule.id,
        rule_name: rule.name,
        request_id: req.id,
        request_title: req.title,
        action: rule.action,
        result,
        detail,
      });
    }

    // Update last_run_at and run_count
    await base44.entities.AutomationRule.update(rule.id, {
      last_run_at: new Date().toISOString(),
      run_count: (rule.run_count || 0) + matched.length,
    });
  }

  return { processed: openRequests.length, rulesRan: rules.length, actions, errors };
}