import { base44 } from '@/api/base44Client';

/**
 * Centralised email notification service.
 * All functions are fire-and-forget (no await needed from callers).
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function requestUrl() {
  return `${window.location.origin}/Requests`;
}

function emailWrapper(body) {
  return `
<div style="font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;max-width:560px;margin:0 auto;">
  <div style="margin-bottom:24px;">
    <span style="font-size:11px;font-weight:600;letter-spacing:2px;color:#475569;text-transform:uppercase;">PLATAFORMA DE SOLICITUDES</span>
  </div>
  ${body}
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1e293b;font-size:11px;color:#475569;">
    Este mensaje fue generado automáticamente. No respondas a este correo.
  </div>
</div>`;
}

function send(to, subject, body) {
  return base44.integrations.Core.SendEmail({ to, subject, body: emailWrapper(body) }).catch(() => {});
}

// ── Email senders ─────────────────────────────────────────────────────────────

/** Solicitud finalizada → solicitante y asignado */
export async function sendFinalizadaEmail(request) {
  const recipients = new Set();
  if (request.requester_id)  recipients.add(request.requester_id);
  if (request.assigned_to_id && request.assigned_to_id !== request.requester_id)
    recipients.add(request.assigned_to_id);

  const body = `
<h2 style="font-size:18px;font-weight:700;color:#4ade80;margin:0 0 8px;">✅ Solicitud finalizada</h2>
<p style="color:#94a3b8;margin:0 0 20px;font-size:14px;">La siguiente solicitud ha sido marcada como <strong style="color:#4ade80;">Finalizada</strong>.</p>
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:20px;">
  <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#f1f5f9;">${request.title}</p>
  <p style="margin:0;font-size:12px;color:#64748b;">Solicitante: ${request.requester_name || request.requester_id || '—'} &nbsp;·&nbsp; Prioridad: ${request.priority || '—'}</p>
</div>
<a href="${requestUrl()}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;">Ver solicitud →</a>`;

  await Promise.all([...recipients].map(email =>
    send(email, `✅ Solicitud finalizada: ${request.title}`, body),
  ));
}

/** Solicitud asignada → técnico asignado (todas las prioridades) */
export async function sendAssignedEmail(request, techEmail, techName) {
  if (!techEmail) return;

  const isCritical = request.priority === 'Alta';
  const accentColor = isCritical ? '#f87171' : '#60a5fa';
  const emoji       = isCritical ? '🚨' : '📋';
  const label       = isCritical ? 'prioridad Alta' : `prioridad ${request.priority || 'Normal'}`;

  const body = `
<h2 style="font-size:18px;font-weight:700;color:${accentColor};margin:0 0 8px;">${emoji} Solicitud asignada a ti</h2>
<p style="color:#94a3b8;margin:0 0 20px;font-size:14px;">Hola <strong style="color:#e2e8f0;">${techName || techEmail}</strong>, se te ha asignado una solicitud de <strong style="color:${accentColor};">${label}</strong>.</p>
<div style="background:#1e293b;border:1px solid ${accentColor};border-left:4px solid ${accentColor};border-radius:8px;padding:16px;margin-bottom:20px;">
  <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#f1f5f9;">${request.title}</p>
  <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">${request.description?.slice(0, 120) || ''}${(request.description?.length || 0) > 120 ? '...' : ''}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Tipo: ${request.request_type || '—'} &nbsp;·&nbsp; Dificultad: ${request.level || '—'}</p>
</div>
${request.estimated_due ? `<p style="font-size:12px;color:#fbbf24;margin:0 0 20px;">⏰ Fecha compromiso: ${new Date(request.estimated_due).toLocaleString('es')}</p>` : ''}
<a href="${requestUrl()}" style="display:inline-block;background:${isCritical ? '#dc2626' : '#2563eb'};color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;">Atender solicitud →</a>`;

  await send(techEmail, `${emoji} Solicitud asignada: ${request.title}`, body);
}

/** Solicitud rechazada → solicitante */
export async function sendRejectedEmail(request, reason) {
  if (!request.requester_id) return;

  const body = `
<h2 style="font-size:18px;font-weight:700;color:#f87171;margin:0 0 8px;">❌ Tu solicitud fue rechazada</h2>
<p style="color:#94a3b8;margin:0 0 20px;font-size:14px;">La siguiente solicitud no pudo ser aprobada en este momento.</p>
<div style="background:#1e293b;border:1px solid #f87171;border-left:4px solid #f87171;border-radius:8px;padding:16px;margin-bottom:20px;">
  <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#f1f5f9;">${request.title}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Solicitante: ${request.requester_name || request.requester_id || '—'}</p>
</div>
${reason ? `
<div style="background:#1e293b;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Motivo del rechazo</p>
  <p style="margin:0;font-size:14px;color:#e2e8f0;">${reason}</p>
</div>` : ''}
<a href="${requestUrl()}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;">Ver solicitud →</a>`;

  await send(request.requester_id, `❌ Solicitud rechazada: ${request.title}`, body);
}

/** Mención @usuario en comentario */
export async function sendMentionEmail({ mentionedEmail, mentionedName, commenterName, commentText, request }) {
  if (!mentionedEmail) return;

  const body = `
<h2 style="font-size:18px;font-weight:700;color:#60a5fa;margin:0 0 8px;">💬 Te mencionaron en un comentario</h2>
<p style="color:#94a3b8;margin:0 0 20px;font-size:14px;">
  <strong style="color:#e2e8f0;">${commenterName || 'Alguien'}</strong> te mencionó en la solicitud
  <strong style="color:#e2e8f0;">"${request?.title || ''}"</strong>.
</p>
<div style="background:#1e293b;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
  <p style="margin:0;font-size:14px;color:#e2e8f0;font-style:italic;">"${commentText?.slice(0, 200) || ''}${(commentText?.length || 0) > 200 ? '...' : ''}"</p>
</div>
<a href="${requestUrl()}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;">Ver comentario →</a>`;

  await send(mentionedEmail, `💬 Te mencionaron en: ${request?.title || 'una solicitud'}`, body);
}

/**
 * Extrae usuarios mencionados con @nombre en un comentario.
 * Coincide @nombre o @nombre.apellido (case insensitive).
 */
export function extractMentions(text, allUsers) {
  if (!text || !allUsers?.length) return [];
  const matches = [...text.matchAll(/@([\w.]+)/g)].map(m => m[1].toLowerCase());
  if (!matches.length) return [];

  return allUsers.filter(u => {
    const name  = (u.full_name || '').toLowerCase().replace(/\s+/g, '.');
    const email = (u.email || '').toLowerCase().split('@')[0];
    return matches.some(m => name.startsWith(m) || email.startsWith(m));
  });
}

// Alias de compatibilidad (usado en RequestModals existentes)
export const sendAssignedCriticalEmail = sendAssignedEmail;
