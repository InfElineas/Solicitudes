import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getSLAInfo, SEMAPHORE_COLOR } from '@/lib/slaUtils';
import { AlertTriangle, Clock, Shield, CheckCircle2, Loader2, ArrowRight, Timer } from 'lucide-react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

function fmtMins(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

const STATUS_COLOR = {
  'Pendiente':           { bg: 'hsl(38,50%,15%)',   text: '#fbbf24' },
  'En Proceso':          { bg: 'hsl(217,60%,18%)',  text: '#60a5fa' },
  'En Validación':       { bg: 'hsl(270,40%,20%)',  text: '#c084fc' },
  'En Espera':           { bg: 'hsl(217,33%,18%)',  text: '#94a3b8' },
  'Requiere Información':{ bg: 'hsl(38,50%,15%)',   text: '#fbbf24' },
  'Retrasado':           { bg: 'hsl(0,50%,15%)',    text: '#f87171' },
};

function StatusPill({ status }) {
  const c = STATUS_COLOR[status] || { bg: 'hsl(217,33%,18%)', text: '#94a3b8' };
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}>
      {status}
    </span>
  );
}

// ── Sección: Solicitudes activas asignadas a mí ──────────────────────────────
function MyRequests({ requests }) {
  const navigate = useNavigate();
  const active = requests
    .filter(r => r.status !== 'Finalizado' && r.status !== 'Rechazado' && r.status !== 'Cancelado')
    .sort((a, b) => {
      const sa = getSLAInfo(a); const sb = getSLAInfo(b);
      const ord = { breached: 0, red: 1, yellow: 2, green: 3, paused: 4, unknown: 5, closed: 6 };
      return (ord[sa.semaphore] ?? 3) - (ord[sb.semaphore] ?? 3);
    });

  if (active.length === 0) return (
    <p className="text-xs py-3 text-center" style={{ color: 'hsl(215,20%,40%)' }}>Sin solicitudes activas asignadas a ti ✓</p>
  );

  return (
    <div className="space-y-2">
      {active.map(r => {
        const sla = getSLAInfo(r);
        return (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
            style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,20%)' }}
            onClick={() => navigate(`/Requests?open=${r.id}`)}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{r.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusPill status={r.status} />
                <span className="text-[10px]" style={{ color: 'hsl(215,20%,45%)' }}>{timeAgo(r.updated_date)}</span>
                {r.estimated_hours && <span className="text-[10px]" style={{ color: 'hsl(215,20%,45%)' }}>{r.estimated_hours}h est.</span>}
              </div>
            </div>
            {sla.semaphore !== 'closed' && sla.semaphore !== 'unknown' && (
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-semibold mb-0.5" style={{ color: SEMAPHORE_COLOR[sla.semaphore] }}>
                  {sla.semaphore === 'breached' ? <span className="flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Vencida</span> : sla.semaphore === 'paused' ? '⏸ Pausado' : `SLA ${sla.pct}%`}
                </div>
                <div className="w-16 rounded-full h-1" style={{ background: 'hsl(217,33%,22%)' }}>
                  <div className="h-full rounded-full" style={{ width: `${sla.pct ?? 100}%`, background: SEMAPHORE_COLOR[sla.semaphore] }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sección: Incidencias activas asignadas a mí ──────────────────────────────
function MyIncidents({ incidents }) {
  const navigate = useNavigate();
  const active = incidents.filter(i => i.status !== 'Resuelto' && i.status !== 'Cerrado');

  if (active.length === 0) return (
    <p className="text-xs py-3 text-center" style={{ color: 'hsl(215,20%,40%)' }}>Sin incidencias activas asignadas a ti ✓</p>
  );

  const impactColor = { 'Crítico': '#f87171', 'Alto': '#fb923c', 'Medio': '#fbbf24', 'Bajo': '#4ade80' };

  return (
    <div className="space-y-2">
      {active.map(i => (
        <div key={i.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
          style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,20%)' }}
          onClick={() => navigate(`/Incidents?open=${i.id}`)}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{i.tool_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold" style={{ color: impactColor[i.impact] || '#94a3b8' }}>{i.impact || 'Sin impacto'}</span>
              <span className="text-[10px]" style={{ color: 'hsl(215,20%,45%)' }}>{i.department || ''}</span>
              <span className="text-[10px]" style={{ color: 'hsl(215,20%,45%)' }}>{timeAgo(i.created_date)}</span>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
            style={{ background: 'hsl(217,33%,20%)', color: 'hsl(215,20%,65%)' }}>
            {i.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sección: Worklogs esta semana ────────────────────────────────────────────
function MyWorklogs({ worklogs }) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeek = worklogs.filter(w => w.created_date && new Date(w.created_date) >= weekStart);
  const totalMins = thisWeek.reduce((s, w) => s + (w.minutes || 0), 0);
  const byDay = {};
  thisWeek.forEach(w => {
    const d = new Date(w.created_date).toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
    byDay[d] = (byDay[d] || 0) + (w.minutes || 0);
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4" style={{ color: '#60a5fa' }} />
        <span className="text-sm font-bold text-white">{fmtMins(totalMins)}</span>
        <span className="text-xs" style={{ color: 'hsl(215,20%,50%)' }}>registrados esta semana</span>
      </div>
      {Object.entries(byDay).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byDay).map(([day, mins]) => (
            <div key={day} className="flex flex-col items-center px-3 py-2 rounded-lg"
              style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,20%)' }}>
              <span className="text-[10px] capitalize" style={{ color: 'hsl(215,20%,50%)' }}>{day}</span>
              <span className="text-xs font-bold text-white mt-0.5">{fmtMins(mins)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'hsl(215,20%,40%)' }}>Sin registros esta semana. Usa el botón "Tiempo" en cada solicitud.</p>
      )}
    </div>
  );
}

// ── Sección: Guardia hoy ─────────────────────────────────────────────────────
function GuardToday({ guards, userEmail }) {
  const today = new Date().toISOString().slice(0, 10);
  const onDuty = guards.filter(g => g.date?.slice(0, 10) === today && g.technician_email === userEmail);
  if (onDuty.length === 0) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'hsl(142,40%,12%)', border: '1px solid hsl(142,40%,20%)' }}>
      <Shield className="w-4 h-4 text-green-400 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-green-400">Estás de guardia hoy</p>
        <p className="text-[10px]" style={{ color: 'hsl(142,30%,55%)' }}>Las incidencias nuevas se asignarán automáticamente a ti</p>
      </div>
    </div>
  );
}

// ── Card contenedor ──────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, count, children, onViewAll, color = '#60a5fa' }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {count != null && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'hsl(217,33%,20%)', color: 'hsl(215,20%,65%)' }}>
              {count}
            </span>
          )}
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="flex items-center gap-1 text-[11px] hover:text-blue-300 transition-colors"
            style={{ color: '#60a5fa' }}>
            Ver todo <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── KPI stat tile ────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, color = 'white', onClick }) {
  return (
    <div className={`rounded-lg px-4 py-3 flex flex-col gap-0.5${onClick ? ' cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
      style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,20%)' }}
      onClick={onClick}>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'hsl(215,20%,50%)' }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px]" style={{ color: 'hsl(215,20%,45%)' }}>{sub}</span>}
    </div>
  );
}

// ── Panel principal ──────────────────────────────────────────────────────────
export default function Panel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: myRequests = [], isLoading: loadingReq } = useQuery({
    queryKey: ['panel-my-requests', user?.email],
    queryFn: () => base44.entities.Request.filter({ assigned_to_id: user?.email, is_deleted: false }, '-created_date', 100),
    enabled: !!user?.email,
    refetchInterval: 60_000,
    staleTime: 0,
  });

  const { data: myIncidents = [], isLoading: loadingInc } = useQuery({
    queryKey: ['panel-my-incidents', user?.email],
    queryFn: () => base44.entities.Incident.filter({ assigned_to: user?.email, is_deleted: false }, '-created_date', 50),
    enabled: !!user?.email,
    staleTime: 30_000,
  });

  const { data: myWorklogs = [] } = useQuery({
    queryKey: ['panel-my-worklogs', user?.email],
    queryFn: () => base44.entities.Worklog.filter({ user_id: user?.email }, '-created_date', 200),
    enabled: !!user?.email,
    staleTime: 30_000,
  });

  const { data: guards = [] } = useQuery({
    queryKey: ['guards'],
    queryFn: () => base44.entities.Guardia.list('-date', 60),
    staleTime: 60_000,
  });

  const activeReqs = myRequests.filter(r => r.status !== 'Finalizado' && r.status !== 'Rechazado' && r.status !== 'Cancelado');
  const activeIncs = myIncidents.filter(i => i.status !== 'Resuelto' && i.status !== 'Cerrado');
  const slaBreached = activeReqs.filter(r => getSLAInfo(r).semaphore === 'breached').length;
  const slaWarning  = activeReqs.filter(r => getSLAInfo(r).semaphore === 'yellow').length;
  const slaPaused   = activeReqs.filter(r => getSLAInfo(r).semaphore === 'paused').length;

  const weekStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d;
  }, []);
  const weekMins = myWorklogs.filter(w => w.created_date && new Date(w.created_date) >= weekStart).reduce((s, w) => s + (w.minutes || 0), 0);

  const isLoading = loadingReq || loadingInc;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Mi trabajo hoy</h1>
          <p className="text-xs mt-0.5" style={{ color: 'hsl(217,91%,60%)' }}>
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin mt-1" style={{ color: 'hsl(215,20%,40%)' }} />}
      </div>

      {/* Guardia hoy */}
      <GuardToday guards={guards} userEmail={user?.email} />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Solicitudes activas" value={activeReqs.length} sub="asignadas a mí" color="#60a5fa" onClick={() => navigate('/Requests')} />
        <KpiTile label="Vencidas SLA" value={slaBreached} sub={slaWarning > 0 ? `+${slaWarning} por vencer` : 'ninguna más'} color={slaBreached > 0 ? '#f87171' : '#4ade80'} onClick={() => navigate('/Requests')} />
        <KpiTile label="Incidencias activas" value={activeIncs.length} sub="asignadas a mí" color="#fbbf24" onClick={() => navigate('/Incidents')} />
        <KpiTile label="Tiempo esta semana" value={fmtMins(weekMins)} sub={`${myWorklogs.filter(w => w.created_date && new Date(w.created_date) >= weekStart).length} registros`} color="#c084fc" />
      </div>

      {/* Mis solicitudes */}
      <SectionCard
        title="Mis solicitudes activas"
        icon={CheckCircle2}
        count={activeReqs.length}
        onViewAll={() => navigate('/Requests?assigned=' + user?.email)}
        color="#60a5fa"
      >
        <MyRequests requests={myRequests} />
      </SectionCard>

      {/* Mis incidencias */}
      {(activeIncs.length > 0 || loadingInc) && (
        <SectionCard
          title="Mis incidencias activas"
          icon={AlertTriangle}
          count={activeIncs.length}
          onViewAll={() => navigate('/Incidents')}
          color="#fbbf24"
        >
          <MyIncidents incidents={myIncidents} />
        </SectionCard>
      )}

      {/* Worklogs */}
      <SectionCard title="Registro de tiempo" icon={Clock} color="#c084fc">
        <MyWorklogs worklogs={myWorklogs} />
      </SectionCard>
    </div>
  );
}
