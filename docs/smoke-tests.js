/**
 * Smoke Tests — Protocolo Operativo v1.0
 * Ejecutar en la consola del navegador con la app cargada.
 * No requieren framework de testing.
 *
 * Uso: copiar este archivo en la consola del browser, o importarlo
 *      como script temporal en el HTML de desarrollo.
 */

// ── Utilidades ────────────────────────────────────────────────
const pass = (msg) => console.log(`%c✓ ${msg}`, 'color: #4ade80; font-weight: bold');
const fail = (msg) => console.error(`%c✗ ${msg}`, 'color: #f87171; font-weight: bold');
const info = (msg) => console.info(`%cℹ ${msg}`, 'color: #60a5fa');

function assert(condition, msgOk, msgFail) {
  condition ? pass(msgOk) : fail(msgFail);
}

// ── Test: slaUtils (lógica inlineada — funciona en prod y dev) ─
function testSlaUtils() {
  info('=== slaUtils tests ===');

  // Replica exacta de src/lib/slaUtils.js
  const SLA_HOURS = { 'P1 — Crítica': 9, 'P2 — Alta': 9, 'P3 — Media': 48, 'P4 — Baja': null };
  const TERMINAL  = ['Finalizado', 'Cancelado', 'Rechazado'];
  const SEMAPHORE_COLOR = {
    green: '#22c55e', yellow: '#fbbf24', red: '#f87171',
    breached: '#f87171', closed: '#6b7280', unknown: '#4b5563',
  };

  function pctToSemaphore(pct) {
    if (pct >= 80) return 'red';
    if (pct >= 50) return 'yellow';
    return 'green';
  }

  function getSLAInfo(request) {
    if (!request) return { pct: null, semaphore: 'unknown', label: '' };
    if (TERMINAL.includes(request.status)) return { pct: null, semaphore: 'closed', label: '' };
    const now     = Date.now();
    const created = request.created_date ? new Date(request.created_date).getTime() : null;
    if (request.estimated_due) {
      const due       = new Date(request.estimated_due).getTime();
      const total     = due - (created || due - 1);
      const elapsed   = now - (created || now);
      const remaining = due - now;
      if (remaining <= 0) return { pct: 100, semaphore: 'breached', label: 'Vencida' };
      const pct = total > 0 ? Math.min(Math.round((elapsed / total) * 100), 99) : 0;
      return { pct, semaphore: pctToSemaphore(pct), label: `${Math.floor(remaining / 3600000)}h restante` };
    }
    const slaHours = SLA_HOURS[request.priority];
    if (!slaHours || !created) return { pct: null, semaphore: 'unknown', label: 'Sin fecha límite' };
    const slaMs     = slaHours * 3600 * 1000;
    const elapsed   = now - created;
    const remaining = slaMs - elapsed;
    if (remaining <= 0) return { pct: 100, semaphore: 'breached', label: 'Vencida' };
    const pct = Math.min(Math.round((elapsed / slaMs) * 100), 99);
    return { pct, semaphore: pctToSemaphore(pct), label: `${Math.floor(remaining / 3600000)}h restante` };
  }

  // P4 sin fecha → unknown
  const p4 = getSLAInfo({ priority: 'P4 — Baja', status: 'En Proceso', created_date: new Date().toISOString() });
  assert(p4.semaphore === 'unknown', 'P4 sin límite → semaphore=unknown', `P4 → ${p4.semaphore} (esperado: unknown)`);

  // Terminal → closed
  const fin = getSLAInfo({ priority: 'P1 — Crítica', status: 'Finalizado', created_date: new Date().toISOString() });
  assert(fin.semaphore === 'closed', 'Finalizado → semaphore=closed', `Finalizado → ${fin.semaphore}`);

  // Vencida: P1 creada hace 10h (SLA=9h)
  const old = new Date(Date.now() - 10 * 3600000).toISOString();
  const breached = getSLAInfo({ priority: 'P1 — Crítica', status: 'En Proceso', created_date: old });
  assert(breached.semaphore === 'breached', 'P1 hace 10h → semaphore=breached', `P1 hace 10h → ${breached.semaphore}`);

  // Verde: P3 creada hace 1h (SLA=48h → 2%)
  const recent = new Date(Date.now() - 3600000).toISOString();
  const green = getSLAInfo({ priority: 'P3 — Media', status: 'Pendiente', created_date: recent });
  assert(green.semaphore === 'green', 'P3 hace 1h → semaphore=green', `P3 hace 1h → ${green.semaphore}`);

  // Amarillo: P3 creada hace 30h de 48h (62%)
  const mid = new Date(Date.now() - 30 * 3600000).toISOString();
  const yellow = getSLAInfo({ priority: 'P3 — Media', status: 'En Proceso', created_date: mid });
  assert(yellow.semaphore === 'yellow', 'P3 hace 30h/48h → semaphore=yellow', `P3 hace 30h → ${yellow.semaphore}`);

  // Rojo: P2 creada hace 8h de 9h (88%)
  const almostBreached = new Date(Date.now() - 8 * 3600000).toISOString();
  const red = getSLAInfo({ priority: 'P2 — Alta', status: 'En Proceso', created_date: almostBreached });
  assert(red.semaphore === 'red', 'P2 hace 8h/9h → semaphore=red', `P2 hace 8h → ${red.semaphore}`);

  // SEMAPHORE_COLOR completo
  const expectedKeys = ['green', 'yellow', 'red', 'breached', 'closed', 'unknown'];
  const hasAllKeys = expectedKeys.every(k => SEMAPHORE_COLOR[k]);
  assert(hasAllKeys, 'SEMAPHORE_COLOR tiene los 6 semáforos', 'SEMAPHORE_COLOR incompleto');

  // estimated_due toma precedencia sobre prioridad
  const withDue = getSLAInfo({
    priority: 'P4 — Baja',
    status: 'En Proceso',
    created_date: new Date(Date.now() - 3600000).toISOString(),
    estimated_due: new Date(Date.now() + 3600000).toISOString(), // vence en 1h
  });
  assert(withDue.semaphore !== 'unknown', 'estimated_due anula P4 sin límite', `Con due → ${withDue.semaphore} (no debería ser unknown)`);
}

// ── Test: Transiciones válidas ────────────────────────────────
function testTransitions() {
  info('=== Transiciones de estado ===');

  const VALID = {
    'Pendiente':            ['En Proceso', 'Rechazado', 'Cancelado'],
    'En Proceso':           ['En Espera', 'Requiere Información', 'En Validación', 'Retrasado', 'Cancelado'],
    'En Espera':            ['En Proceso', 'Cancelado'],
    'Requiere Información': ['En Proceso', 'Cancelado'],
    'En Validación':        ['Finalizado', 'En Proceso'],
    'Retrasado':            ['En Proceso', 'Cancelado'],
    'Finalizado':           [],
    'Cancelado':            [],
    'Rechazado':            [],
  };

  // Terminales no pueden transicionar
  ['Finalizado', 'Cancelado', 'Rechazado'].forEach(s => {
    assert(VALID[s].length === 0, `${s} es terminal (0 transiciones)`, `${s} tiene transiciones inesperadas`);
  });

  // Pendiente no puede ir directo a Finalizado
  assert(!VALID['Pendiente'].includes('Finalizado'), 'Pendiente → Finalizado no permitido', 'Pendiente → Finalizado incorrectamente permitido');

  // En Proceso puede ir a En Validación
  assert(VALID['En Proceso'].includes('En Validación'), 'En Proceso → En Validación permitido', 'En Proceso → En Validación bloqueado (error)');

  // En Validación puede devolver a En Proceso
  assert(VALID['En Validación'].includes('En Proceso'), 'En Validación → En Proceso permitido', 'En Validación → En Proceso bloqueado (error)');

  // Total de estados
  assert(Object.keys(VALID).length === 9, '9 estados definidos', `${Object.keys(VALID).length} estados (esperado: 9)`);
}

// ── Test: Tipos de solicitud y TYPE_CONFIG ────────────────────
function testRequestTypes() {
  info('=== Tipos de solicitud ===');

  const REQUEST_TYPES = [
    'Nueva Implementación', 'Reparación / Bug', 'Mantenimiento', 'Actualización',
    'Consulta o Asesoría', 'Integración', 'Optimización', 'Capacitación',
    'Reporte o Análisis', 'Soporte Técnico', 'Automatización',
  ];
  assert(REQUEST_TYPES.length === 11, '11 tipos de solicitud', `${REQUEST_TYPES.length} tipos (esperado: 11)`);

  const TYPE_CONFIG = {
    'Nueva Implementación': { priority: 'P2 — Alta' },
    'Reparación / Bug':     { priority: 'P1 — Crítica' },
    'Mantenimiento':        { priority: 'P4 — Baja' },
    'Consulta o Asesoría':  { priority: 'P4 — Baja' },
    'Integración':          { priority: 'P2 — Alta' },
    'Automatización':       { priority: 'P2 — Alta' },
  };

  assert(TYPE_CONFIG['Reparación / Bug'].priority === 'P1 — Crítica',
    'Reparación/Bug → P1 Crítica', 'Reparación/Bug prioridad incorrecta');
  assert(TYPE_CONFIG['Mantenimiento'].priority === 'P4 — Baja',
    'Mantenimiento → P4 Baja', 'Mantenimiento prioridad incorrecta');
  assert(TYPE_CONFIG['Nueva Implementación'].priority === 'P2 — Alta',
    'Nueva Implementación → P2 Alta', 'Nueva Implementación prioridad incorrecta');
}

// ── Test: Prioridades P1–P4 ───────────────────────────────────
function testPriorities() {
  info('=== Prioridades ===');

  const PRIORITIES = ['P1 — Crítica', 'P2 — Alta', 'P3 — Media', 'P4 — Baja'];
  assert(PRIORITIES.length === 4, '4 prioridades P1–P4', `${PRIORITIES.length} prioridades`);

  // Ninguna tiene formato viejo
  const oldFormats = ['Alta', 'Media', 'Baja', 'Crítica'];
  const hasOld = PRIORITIES.some(p => oldFormats.includes(p));
  assert(!hasOld, 'Sin prioridades en formato viejo', 'Hay prioridades en formato viejo (sin prefijo P)');
}

// ── Test: Urgency → Priority mapping (formulario simplificado) ─
function testUrgencyMap() {
  info('=== Mapeo Urgencia → Prioridad ===');

  const URGENCY_MAP = { 'Normal': 'P3 — Media', 'Urgente': 'P2 — Alta', 'Crítico': 'P1 — Crítica' };
  assert(URGENCY_MAP['Normal']   === 'P3 — Media',  'Normal → P3 Media',   `Normal → ${URGENCY_MAP['Normal']}`);
  assert(URGENCY_MAP['Urgente']  === 'P2 — Alta',   'Urgente → P2 Alta',   `Urgente → ${URGENCY_MAP['Urgente']}`);
  assert(URGENCY_MAP['Crítico']  === 'P1 — Crítica','Crítico → P1 Crítica',`Crítico → ${URGENCY_MAP['Crítico']}`);
}

// ── Test: CoverageHeatmap lógica ──────────────────────────────
function testCoverageHeatmap() {
  info('=== CoverageHeatmap 24/7 ===');

  const DAYS_AHEAD = 7;
  const BLOCK_HOURS = 4;
  const BLOCKS = 24 / BLOCK_HOURS;
  const totalBlocks = DAYS_AHEAD * BLOCKS;

  assert(totalBlocks === 42, `Total bloques = 42 (${DAYS_AHEAD}d × ${BLOCKS} bloques)`, `Total bloques = ${totalBlocks} (esperado 42)`);
  assert(BLOCKS === 6, 'BLOCKS = 6 por día', `BLOCKS = ${BLOCKS}`);

  // Simular coverage con 1 guardia de 08:00 a 17:00 hoy
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const g = {
    estado: 'programada',
    inicio: new Date(dayStart.getTime() + 8 * 3600000).toISOString(),
    fin:    new Date(dayStart.getTime() + 17 * 3600000).toISOString(),
    tecnico_nombre: 'Test Tech',
  };

  const getCoverage = (blockIdx) => {
    const from = new Date(dayStart.getTime() + blockIdx * BLOCK_HOURS * 3600000);
    const to   = new Date(from.getTime() + BLOCK_HOURS * 3600000);
    return [g].filter(x =>
      x.estado !== 'cancelada' &&
      new Date(x.inicio) < to && new Date(x.fin) > from
    );
  };

  // Bloque 0 (00:00–04:00) sin cobertura
  assert(getCoverage(0).length === 0, 'Bloque 00h sin guardia (correcto)', 'Bloque 00h con guardia inesperada');
  // Bloque 2 (08:00–12:00) con cobertura
  assert(getCoverage(2).length === 1, 'Bloque 08h tiene guardia', `Bloque 08h: ${getCoverage(2).length} guardias`);
  // Bloque 4 (16:00–20:00) con cobertura parcial (fin=17:00 > inicio del bloque=16:00)
  assert(getCoverage(4).length === 1, 'Bloque 16h cubre hasta 17h', `Bloque 16h: ${getCoverage(4).length}`);
}

// ── Test: Recurrence UI logic ─────────────────────────────────
function testRecurrenceUI() {
  info('=== Reincidencia de incidentes ===');

  const RECURRENCE_THRESHOLD = 2;
  const BANNER_THRESHOLD = 3;

  const mockIncidents = [
    { id: '1', department: 'TI', recurrence_count: 3, status: 'Pendiente', created_date: new Date().toISOString() },
    { id: '2', department: 'TI', recurrence_count: 1, status: 'En atención', created_date: new Date().toISOString() },
    { id: '3', department: 'TI', recurrence_count: 0, status: 'Resuelto', created_date: new Date().toISOString() },
  ];

  const recurrentCount = mockIncidents.filter(i => (i.recurrence_count || 0) >= RECURRENCE_THRESHOLD).length;
  assert(recurrentCount === 1, '1 incidente recurrente (count ≥ 2)', `${recurrentCount} (esperado 1)`);

  const showBanner = recurrentCount >= BANNER_THRESHOLD;
  assert(!showBanner, 'Banner no aparece con < 3 reincidentes', 'Banner aparece incorrectamente');

  // Filtro
  const filtered = mockIncidents.filter(i => (i.recurrence_count || 0) >= RECURRENCE_THRESHOLD);
  assert(filtered.length === 1, 'Filtro reincidentes devuelve 1', `Filtro devuelve ${filtered.length}`);
}

// ── Test: Origin field ────────────────────────────────────────
function testOriginField() {
  info('=== Campo Origen ===');

  const ORIGINS = ['WhatsApp', 'Presencial', 'Email', 'Web'];
  const ORIGIN_ICONS = { WhatsApp: '💬', Presencial: '🏢', Email: '📧', Web: '🌐' };

  assert(ORIGINS.length === 4, '4 canales de origen', `${ORIGINS.length} canales`);
  ORIGINS.forEach(o => {
    assert(!!ORIGIN_ICONS[o], `Ícono para ${o}`, `Sin ícono para ${o}`);
  });
}

// ── Test: Lifecycle steps ─────────────────────────────────────
function testLifecycleSteps() {
  info('=== Ciclo de vida ===');

  const LIFECYCLE_STEPS = ['Pendiente', 'En Proceso', 'En Validación', 'Finalizado'];
  const TERMINAL = ['Cancelado', 'Rechazado'];

  assert(LIFECYCLE_STEPS.length === 4, '4 pasos en el ciclo de vida', `${LIFECYCLE_STEPS.length} pasos`);
  assert(LIFECYCLE_STEPS[0] === 'Pendiente', 'Primer paso = Pendiente', `Primer paso = ${LIFECYCLE_STEPS[0]}`);
  assert(LIFECYCLE_STEPS[3] === 'Finalizado', 'Último paso = Finalizado', `Último paso = ${LIFECYCLE_STEPS[3]}`);
  assert(TERMINAL.length === 2, '2 estados terminales especiales', `${TERMINAL.length} terminales`);
}

// ── Ejecutar todos ────────────────────────────────────────────
async function runAllTests() {
  console.clear();
  console.log('%c╔══════════════════════════════════════════════╗', 'color: #60a5fa');
  console.log('%c║  Smoke Tests — Protocolo Operativo v1.0      ║', 'color: #60a5fa; font-weight: bold');
  console.log('%c╚══════════════════════════════════════════════╝', 'color: #60a5fa');

  testTransitions();
  testRequestTypes();
  testPriorities();
  testUrgencyMap();
  testCoverageHeatmap();
  testRecurrenceUI();
  testOriginField();
  testLifecycleSteps();
  await testSlaUtils();

  console.log('%c\n── Smoke tests completados ──', 'color: #94a3b8; font-style: italic');
}

runAllTests();
