/**
 * Utilidades de SLA — Protocolo Operativo v1.0
 * Horas de resolución por prioridad (calendario, aproximación para UI)
 * El cálculo exacto en horas hábiles vive en la vista sla_status_view de Supabase.
 */

const SLA_HOURS = {
  'P1 — Crítica': 9,
  'P2 — Alta':    9,
  'P3 — Media':   48,
  'P4 — Baja':    null, // sin límite definido
};

const TERMINAL = ['Finalizado', 'Cancelado', 'Rechazado'];

/**
 * Devuelve información de SLA para una solicitud.
 * @returns {{ pct: number|null, semaphore: 'green'|'yellow'|'red'|'breached'|'closed'|'unknown', label: string }}
 */
export function getSLAInfo(request) {
  if (!request) return { pct: null, semaphore: 'unknown', label: '' };

  if (TERMINAL.includes(request.status)) {
    return { pct: null, semaphore: 'closed', label: '' };
  }

  const now = Date.now();
  const created = request.created_date ? new Date(request.created_date).getTime() : null;

  // Si hay fecha compromiso explícita, usarla como referencia principal
  if (request.estimated_due) {
    const due = new Date(request.estimated_due).getTime();
    const total = due - (created || due - 1);
    const elapsed = now - (created || now);
    const remaining = due - now;

    if (remaining <= 0) {
      const overMs = now - due;
      return { pct: 100, semaphore: 'breached', label: formatOverdue(overMs) };
    }

    const pct = total > 0 ? Math.min(Math.round((elapsed / total) * 100), 99) : 0;
    return { pct, semaphore: pctToSemaphore(pct), label: formatRemaining(remaining) };
  }

  // Sin fecha compromiso: usar horas del sla_config por prioridad
  const slaHours = SLA_HOURS[request.priority];
  if (!slaHours || !created) return { pct: null, semaphore: 'unknown', label: 'Sin fecha límite' };

  const slaMs = slaHours * 3600 * 1000;
  const elapsed = now - created;
  const remaining = slaMs - elapsed;

  if (remaining <= 0) {
    return { pct: 100, semaphore: 'breached', label: formatOverdue(-remaining) };
  }

  const pct = Math.min(Math.round((elapsed / slaMs) * 100), 99);
  return { pct, semaphore: pctToSemaphore(pct), label: formatRemaining(remaining) };
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

/** Color CSS para cada semáforo */
export const SEMAPHORE_COLOR = {
  green:   '#22c55e',
  yellow:  '#fbbf24',
  red:     '#f87171',
  breached:'#f87171',
  closed:  '#6b7280',
  unknown: '#4b5563',
};

export const SEMAPHORE_BG = {
  green:   'hsl(142,60%,15%)',
  yellow:  'hsl(38,80%,15%)',
  red:     'hsl(0,60%,18%)',
  breached:'hsl(0,60%,18%)',
  closed:  'hsl(220,15%,15%)',
  unknown: 'hsl(220,15%,15%)',
};
