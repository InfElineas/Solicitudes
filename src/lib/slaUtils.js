/**
 * Utilidades de SLA — Protocolo Operativo v1.0
 * Horas de resolución por prioridad (calendario, aproximación para UI)
 * El cálculo exacto en horas hábiles vive en la vista sla_status_view de Supabase.
 */

const SLA_HOURS = {
  'P1 — Crítica': 9,
  'P2 — Alta':    9,
  'P3 — Media':   48,
  'P4 — Baja':    null,
};

const TERMINAL = ['Finalizado', 'Cancelado', 'Rechazado'];

// Estados donde el SLA se pausa (el técnico no puede avanzar)
export const SLA_PAUSE_STATES = new Set(['En Validación', 'En Espera', 'Requiere Información']);

/** Calcula los ms totales pausados para una solicitud. */
function getPausedMs(request, now) {
  let paused = request.sla_paused_ms || 0;
  if (SLA_PAUSE_STATES.has(request.status) && request.sla_pause_started_at) {
    paused += now - new Date(request.sla_pause_started_at).getTime();
  }
  return Math.max(0, paused);
}

/**
 * Devuelve información de SLA para una solicitud.
 * Descuenta automáticamente el tiempo en estados que no dependen del técnico
 * (En Validación, En Espera, Requiere Información).
 * @returns {{ pct: number|null, semaphore: 'green'|'yellow'|'red'|'breached'|'closed'|'unknown', label: string, paused: boolean }}
 */
export function getSLAInfo(request) {
  if (!request) return { pct: null, semaphore: 'unknown', label: '', paused: false };

  if (TERMINAL.includes(request.status)) {
    return { pct: null, semaphore: 'closed', label: '', paused: false };
  }

  const now = Date.now();
  const created = request.created_date ? new Date(request.created_date).getTime() : null;
  const paused = SLA_PAUSE_STATES.has(request.status);
  const pausedMs = getPausedMs(request, now);

  // Si hay fecha compromiso explícita — extender deadline por el tiempo pausado
  if (request.estimated_due) {
    const due = new Date(request.estimated_due).getTime();
    const effectiveDue = due + pausedMs;
    const total = effectiveDue - (created || effectiveDue - 1);
    const elapsed = Math.max(0, now - (created || now) - pausedMs);
    const remaining = effectiveDue - now;

    if (remaining <= 0) {
      return { pct: 100, semaphore: 'breached', label: formatOverdue(now - effectiveDue), paused };
    }

    const pct = total > 0 ? Math.min(Math.round((elapsed / total) * 100), 99) : 0;
    return { pct, semaphore: paused ? 'paused' : pctToSemaphore(pct), label: paused ? 'SLA pausado' : formatRemaining(remaining), paused };
  }

  // Sin fecha compromiso: usar horas por prioridad
  const slaHours = SLA_HOURS[request.priority];
  if (!slaHours || !created) return { pct: null, semaphore: 'unknown', label: 'Sin fecha límite', paused };

  const slaMs = slaHours * 3600 * 1000;
  const elapsed = Math.max(0, now - created - pausedMs);
  const remaining = slaMs - elapsed;

  if (remaining <= 0) {
    return { pct: 100, semaphore: 'breached', label: formatOverdue(-remaining), paused };
  }

  const pct = Math.min(Math.round((elapsed / slaMs) * 100), 99);
  return { pct, semaphore: paused ? 'paused' : pctToSemaphore(pct), label: paused ? 'SLA pausado' : formatRemaining(remaining), paused };
}

function pctToSemaphore(pct) {
  if (pct >= 80) return 'red';
  if (pct >= 50) return 'yellow';
  return 'green';
}

function formatRemaining(ms) {
  const h = Math.floor(ms / 3600000);
  if (h < 1) return '< 1h restante';
  if (h < 24) return `${h}h restante`;
  const d = Math.floor(h / 24);
  const hRem = h % 24;
  return hRem > 0 ? `${d}d ${hRem}h` : `${d}d restante`;
}

function formatOverdue(ms) {
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'Vencida hace < 1h';
  if (h < 24) return `Vencida hace ${h}h`;
  const d = Math.floor(h / 24);
  return `Vencida hace ${d}d`;
}

/**
 * Returns true when the current moment is outside business hours (Mon–Fri 08:00–18:00).
 * Used to annotate SLA breaches that happen during weekends or outside working hours.
 */
export function isOutsideBusinessHours() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const h = now.getHours();
  if (day === 0 || day === 6) return true;
  return h < 8 || h >= 18;
}

/** Color CSS para cada semáforo */
export const SEMAPHORE_COLOR = {
  green:   '#22c55e',
  yellow:  '#fbbf24',
  red:     '#f87171',
  breached:'#f87171',
  closed:  '#6b7280',
  unknown: '#4b5563',
  paused:  '#818cf8',
};

export const SEMAPHORE_BG = {
  green:   'hsl(142,60%,15%)',
  yellow:  'hsl(38,80%,15%)',
  red:     'hsl(0,60%,18%)',
  breached:'hsl(0,60%,18%)',
  closed:  'hsl(220,15%,15%)',
  unknown: 'hsl(220,15%,15%)',
  paused:  'hsl(245,60%,18%)',
};
