import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import {
  FileText, CheckCircle2, Loader2, Eye, Clock, Award,
  XCircle, AlarmClock, Percent, Download, AlertTriangle, Mail, Zap, Target, TrendingUp, Shield, X
} from 'lucide-react';
import ScheduledReportModal from '../components/analisys/ScheduleReportModal';
import { useAuth } from '@/lib/AuthContext';

const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };
const selectStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' };
const muted = 'hsl(215,20%,55%)';
const tooltipStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white', fontSize: 11 };

const PRIORITY_COLORS = { Alta: '#f87171', Media: '#fbbf24', Baja: '#4ade80' };
const LEVEL_WEIGHT = { 'Difícil': 3, 'Medio': 2, 'Fácil': 1 };
const LEVEL_COLORS = { 'Fácil': '#4ade80', 'Medio': '#fbbf24', 'Difícil': '#f87171' };
const STATUS_COLORS = { 'Pendiente': '#fbbf24', 'En progreso': '#3b82f6', 'En revisión': '#8b5cf6', 'Finalizada': '#22c55e', 'Rechazada': '#f87171' };
const REQUEST_TYPE_COLORS = {
  'Desarrollo': '#818cf8', 'Corrección de errores': '#f87171', 'Mejora funcional': '#22d3ee',
  'Mejora visual': '#f472b6', 'Migración': '#fb923c', 'Automatización': '#a3e635'
};

function exportCSV(filename, headers, rows) {
  const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportTablePDF(title, headers, rows) {
  const win = window.open('', '_blank');
  const th = headers.map(h => `<th style="padding:6px 10px;border:1px solid #ccc;background:#1e3a5f;color:white;font-size:12px">${h}</th>`).join('');
  const trs = rows.map(r =>
    `<tr>${r.map(v => `<td style="padding:5px 10px;border:1px solid #ddd;font-size:12px">${v}</td>`).join('')}</tr>`
  ).join('');
  win.document.write(`
    <html><head><title>${title}</title></head>
    <body style="font-family:sans-serif;padding:20px">
      <h2 style="color:#1e3a5f;margin-bottom:16px">${title}</h2>
      <table style="border-collapse:collapse;width:100%"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
      <p style="color:#888;font-size:11px;margin-top:16px">Exportado: ${new Date().toLocaleString('es')}</p>
    </body></html>`);
  win.document.close();
  win.print();
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor, highlight, onClick }) {
  return (
    <div
      className={`rounded-xl p-5 transition-all ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-blue-500/40 hover:brightness-110' : ''}`}
      style={cardStyle}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: muted }}>{title}</p>
          <p className={`text-3xl font-bold ${highlight || 'text-white'}`}>{value}</p>
          {subtitle && <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,50%)' }}>{subtitle}</p>}
        </div>
        {Icon && <Icon className={`w-5 h-5 mt-1 ${iconColor || 'text-gray-500'}`} />}
      </div>
      {onClick && <p className="text-[10px] mt-2" style={{ color: 'hsl(215,20%,40%)' }}>Click para ver detalle</p>}
    </div>
  );
}

function isOnDutyNow(g) {
  if (g.estado === 'cancelada' || g.estado === 'finalizada' || g.estado === 'reemplazada') return false;
  const now = new Date();
  return new Date(g.inicio) <= now && new Date(g.fin) >= now;
}

function KpiDetailModal({ title, items, type, onClose, users }) {
  const getUserName = (email) => {
    const u = users.find(x => x.email === email);
    return u?.full_name || email || '—';
  };
  const now = new Date();
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const formatOverdue = (d) => {
    if (!d) return '—';
    const diff = now - new Date(d);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-xl overflow-hidden"
        style={{ background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'hsl(217,33%,18%)' }}>
          <h3 className="font-semibold text-white">
            {title} <span className="text-sm font-normal" style={{ color: muted }}>({items.length})</span>
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-center py-10" style={{ color: muted }}>No hay solicitudes en esta categoría</p>
          )}
          {items.map(r => (
            <div key={r.id} className="rounded-lg p-3" style={{ background: 'hsl(222,47%,16%)', border: '1px solid hsl(217,33%,22%)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{r.title || r.description || `#${r.id?.slice(-6)}`}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs" style={{ color: muted }}>#{r.id?.slice(-6)}</span>
                    {r.assigned_to_id && (
                      <span className="text-xs" style={{ color: muted }}>{getUserName(r.assigned_to_id)}</span>
                    )}
                    {type === 'vencidas' && r.estimated_due && (
                      <span className="text-xs font-semibold text-orange-400">Vencida hace {formatOverdue(r.estimated_due)}</span>
                    )}
                    {type === 'finalizada' && r.completion_date && (
                      <span className="text-xs" style={{ color: muted }}>Finalizada: {formatDate(r.completion_date)}</span>
                    )}
                    {!['vencidas', 'finalizada'].includes(type) && (
                      <span className="text-xs" style={{ color: muted }}>Creada: {formatDate(r.created_date)}</span>
                    )}
                    {type === 'vencidas' && r.estimated_due && (
                      <span className="text-xs" style={{ color: muted }}>Vencía: {formatDate(r.estimated_due)}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap shrink-0"
                  style={{ background: `${STATUS_COLORS[r.status] || '#888'}22`, color: STATUS_COLORS[r.status] || '#888' }}>
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: muted }}>{subtitle}</p>}
    </div>
  );
}

function ExportBtn({ onCSV, onPDF }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80"
        style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' }}>
        <Download className="w-3 h-3" /> Exportar
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 rounded-lg shadow-xl py-1 min-w-[110px]"
          style={{ background: 'hsl(222,47%,16%)', border: '1px solid hsl(217,33%,25%)' }}>
          <button onClick={() => { onCSV(); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 text-white">CSV</button>
          <button onClick={() => { onPDF(); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 text-white">PDF (imprimir)</button>
        </div>
      )}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs truncate" style={{ color: muted, minWidth: 70, maxWidth: 90 }}>{label}</span>
      <div className="flex-1 rounded-full h-1.5" style={{ background: 'hsl(217,33%,20%)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-white w-5 text-right">{value}</span>
    </div>
  );
}

// Score badge — color por score 0-100
function ScoreBadge({ score }) {
  const color = score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
  const label = score >= 75 ? 'Alto' : score >= 50 ? 'Medio' : 'Bajo';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}22`, color }}>
      {score} · {label}
    </span>
  );
}

const IMPACT_WEIGHTS = { 'Crítico': 4, 'Alto': 3, 'Medio': 2, 'Bajo': 1 };

// Score de solicitudes (0-100)
function computeRequestScore(t) {
  const successRate = t.Asignadas > 0 ? (t.Finalizadas / t.Asignadas) * 100 : 0;
  const complexityBonus = Math.min(t.complexityScore / Math.max(t.Asignadas, 1) * 10, 30);
  const volumeScore = Math.min(t.Asignadas * 2, 30);
  const speedScore = t.avgHrs !== '—' ? Math.max(0, 40 - parseFloat(t.avgHrs)) : 0;
  return Math.min(100, Math.round((successRate * 0.4) + complexityBonus + (volumeScore * 0.2) + (speedScore * 0.1)));
}

// Score de incidencias (0-100)
function computeIncidentScore(inc) {
  if (!inc || inc.Asignadas === 0) return 0;
  const resolutionRate = (inc.Resueltas / inc.Asignadas) * 40;              // 40 pts max
  const volumeScore = Math.min(inc.Asignadas * 3, 25);                      // 25 pts max
  const criticalityScore = Math.min(inc.criticalityScore * 2, 20);          // 20 pts max
  const speedScore = inc.avgHrs !== '—' ? Math.max(0, 15 - parseFloat(inc.avgHrs) * 0.5) : 0; // 15 pts max
  return Math.min(100, Math.round(resolutionRate + volumeScore + criticalityScore + speedScore));
}

// Score combinado (0-100): 55% solicitudes + 45% incidencias
function computeScore(t) { return computeRequestScore(t); } // legacy alias

export default function Analysis() {
  const [periodFilter, setPeriodFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState('solicitudes');
  const [kpiModal, setKpiModal] = useState(null);
  const { user } = useAuth();

  const { data: requests = [] } = useQuery({
    queryKey: ['requests-analysis'],
    queryFn: () => base44.entities.Request.filter({ is_deleted: false }, '-created_date', 500),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-created_date', 500),
  });
  const { data: guardias = [] } = useQuery({
    queryKey: ['guardias-analysis'],
    queryFn: () => base44.entities.Guardia.list('-inicio', 30),
    staleTime: 60000,
  });

  const activeGuardia = useMemo(() => guardias.find(isOnDutyNow) || null, [guardias]);
  const isCurrentUserOnDuty = !!(user && activeGuardia && user.email === activeGuardia.tecnico_id);

  useEffect(() => {
    if (!isCurrentUserOnDuty || !activeGuardia) return;
    const key = `guardia_notif_${activeGuardia.id}_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) return;
    base44.entities.Notification.create({
      user_id: user.email,
      type: 'guardia_turno',
      title: 'Estás de guardia',
      message: `Tu turno de guardia está activo hasta ${new Date(activeGuardia.fin).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`,
      read: false,
    }).then(() => localStorage.setItem(key, '1')).catch(console.error);
  }, [isCurrentUserOnDuty, activeGuardia, user]);

  const techs = users.filter(u => u.role === 'admin' || u.role === 'support');

  const periodFiltered = useMemo(() => {
    let r = requests;
    const now = new Date();
    if (periodFilter === '7d') r = r.filter(x => new Date(x.created_date) > new Date(now - 7 * 86400000));
    if (periodFilter === '30d') r = r.filter(x => new Date(x.created_date) > new Date(now - 30 * 86400000));
    if (periodFilter === '90d') r = r.filter(x => new Date(x.created_date) > new Date(now - 90 * 86400000));
    if (techFilter !== 'all') r = r.filter(x => x.assigned_to_id === techFilter);
    return r;
  }, [requests, periodFilter, techFilter]);

  const incidentsPeriodFiltered = useMemo(() => {
    let inc = incidents;
    const now = new Date();
    if (periodFilter === '7d') inc = inc.filter(x => new Date(x.created_date) > new Date(now - 7 * 86400000));
    if (periodFilter === '30d') inc = inc.filter(x => new Date(x.created_date) > new Date(now - 30 * 86400000));
    if (periodFilter === '90d') inc = inc.filter(x => new Date(x.created_date) > new Date(now - 90 * 86400000));
    if (techFilter !== 'all') inc = inc.filter(x => x.assigned_to === techFilter);
    return inc;
  }, [incidents, periodFilter, techFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const total = periodFiltered.length;
    const finalizada = periodFiltered.filter(r => r.status === 'Finalizada').length;
    const enProgreso = periodFiltered.filter(r => r.status === 'En progreso').length;
    const enRevision = periodFiltered.filter(r => r.status === 'En revisión').length;
    const pendiente = periodFiltered.filter(r => r.status === 'Pendiente').length;
    const rechazada = periodFiltered.filter(r => r.status === 'Rechazada').length;
    const vencidas = periodFiltered.filter(r =>
      r.estimated_due && new Date(r.estimated_due) < now &&
      r.status !== 'Finalizada' && r.status !== 'Rechazada'
    ).length;
    const withTime = periodFiltered.filter(r => r.status === 'Finalizada' && r.completion_date && r.created_date);
    const avgResolutionHrs = withTime.length > 0
      ? (withTime.reduce((s, r) => s + (new Date(r.completion_date) - new Date(r.created_date)), 0) / withTime.length / 3600000).toFixed(1)
      : '—';
    const resolutionRate = total > 0 ? Math.round((finalizada / total) * 100) : 0;
    const activeTechs = techs.filter(t => periodFiltered.some(r => r.assigned_to_id === t.email));
    const avgPerTech = activeTechs.length > 0 ? (total / activeTechs.length).toFixed(1) : '0';
    const finishedPerTech = activeTechs.length > 0 ? (finalizada / activeTechs.length).toFixed(1) : '0';

    const byPriority = ['Alta', 'Media', 'Baja'].map(p => ({ name: p, value: periodFiltered.filter(r => r.priority === p).length }));
    const byLevel = ['Fácil', 'Medio', 'Difícil'].map(l => ({ name: l, value: periodFiltered.filter(r => r.level === l).length }));
    const byRequestType = ['Desarrollo', 'Corrección de errores', 'Mejora funcional', 'Mejora visual', 'Migración', 'Automatización']
      .map(t => ({ name: t, value: periodFiltered.filter(r => r.request_type === t).length }));

    const byStatus = ['Pendiente', 'En progreso', 'En revisión', 'Finalizada', 'Rechazada'].map(s => ({ name: s, value: periodFiltered.filter(r => r.status === s).length }));

    const deptMap = {};
    periodFiltered.forEach(r => r.department_names?.forEach(d => {
      if (!deptMap[d]) deptMap[d] = { total: 0, Finalizadas: 0, Pendientes: 0, 'En progreso': 0 };
      deptMap[d].total++;
      if (r.status === 'Finalizada') deptMap[d].Finalizadas++;
      else if (r.status === 'Pendiente') deptMap[d].Pendientes++;
      else if (r.status === 'En progreso') deptMap[d]['En progreso']++;
    }));
    const byDept = Object.entries(deptMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);

    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (7 - i) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return {
        week: `S${i + 1}`,
        Creadas: requests.filter(r => { const d = new Date(r.created_date); return d >= weekStart && d < weekEnd; }).length,
        Finalizadas: requests.filter(r => { const d = r.completion_date ? new Date(r.completion_date) : null; return d && d >= weekStart && d < weekEnd; }).length,
      };
    });

    // Daily trend (last 14 days)
    const dailyTrend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const dateStr = d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      return {
        day: dateStr,
        Creadas: requests.filter(r => { const x = new Date(r.created_date); return x >= dayStart && x < dayEnd; }).length,
        Finalizadas: requests.filter(r => { const x = r.completion_date ? new Date(r.completion_date) : null; return x && x >= dayStart && x < dayEnd; }).length,
      };
    });

    return { total, finalizada, enProgreso, enRevision, pendiente, rechazada, vencidas, avgResolutionHrs, resolutionRate, activeTechs, avgPerTech, finishedPerTech, byPriority, byLevel, byRequestType, byStatus, byDept, weeklyTrend, dailyTrend };
  }, [periodFiltered, requests, techs]);

  // Rich tech productivity with complexity metrics
  const techProductivity = useMemo(() => techs.map(t => {
    const assigned = periodFiltered.filter(r => r.assigned_to_id === t.email);
    const finished = assigned.filter(r => r.status === 'Finalizada');
    const withTime = finished.filter(r => r.completion_date && r.created_date);
    const avgHrs = withTime.length > 0
      ? (withTime.reduce((s, r) => s + (new Date(r.completion_date) - new Date(r.created_date)), 0) / withTime.length / 3600000).toFixed(1)
      : '—';

    // Complexity score: sum of level weights for finished tasks
    const complexityScore = finished.reduce((s, r) => s + (LEVEL_WEIGHT[r.level] || 1), 0);
    const difficultCount = assigned.filter(r => r.level === 'Difícil').length;
    const mediumCount = assigned.filter(r => r.level === 'Medio').length;
    const easyCount = assigned.filter(r => r.level === 'Fácil').length;

    // On-time rate: finished before estimated_due
    const withDue = finished.filter(r => r.estimated_due && r.completion_date);
    const onTimeCount = withDue.filter(r => new Date(r.completion_date) <= new Date(r.estimated_due)).length;
    const onTimeRate = withDue.length > 0 ? Math.round((onTimeCount / withDue.length) * 100) : null;

    // Requests by type
    const byReqType = {};
    assigned.forEach(r => {
      if (r.request_type) byReqType[r.request_type] = (byReqType[r.request_type] || 0) + 1;
    });

    return {
      name: t.full_name || t.email,
      email: t.email,
      Asignadas: assigned.length,
      'En progreso': assigned.filter(r => r.status === 'En progreso').length,
      'En revisión': assigned.filter(r => r.status === 'En revisión').length,
      Finalizadas: finished.length,
      Pendientes: assigned.filter(r => r.status === 'Pendiente').length,
      Rechazadas: assigned.filter(r => r.status === 'Rechazada').length,
      avgHrs,
      complexityScore,
      difficultCount,
      mediumCount,
      easyCount,
      onTimeRate,
      byReqType,
    };
  }).filter(t => t.Asignadas > 0), [periodFiltered, techs]);

  // ── incidentsByTech debe estar ANTES de ranking ──────────────
  const incidentsByTech = useMemo(() => techs.map(t => {
    const assigned = incidentsPeriodFiltered.filter(i => i.assigned_to === t.email);
    const resolved = assigned.filter(i => i.status === 'Resuelto');
    const withHrs = resolved.filter(i => i.resolution_hours);
    const avgHrs = withHrs.length > 0
      ? (withHrs.reduce((s, i) => s + i.resolution_hours, 0) / withHrs.length).toFixed(1)
      : '—';
    const pending    = assigned.filter(i => i.status === 'Pendiente').length;
    const inProgress = assigned.filter(i => i.status === 'En atención').length;
    const noRepro    = assigned.filter(i => i.status === 'No reproducible').length;
    const critica = assigned.filter(i => i.impact?.startsWith('Crítico'));
    const alta    = assigned.filter(i => i.impact?.startsWith('Alto'));
    const media   = assigned.filter(i => i.impact?.startsWith('Medio'));
    const baja    = assigned.filter(i => i.impact?.startsWith('Bajo'));
    const avgHrsByCrit = (arr) => {
      const r = arr.filter(i => i.status === 'Resuelto' && i.resolution_hours);
      return r.length > 0 ? (r.reduce((s, i) => s + i.resolution_hours, 0) / r.length).toFixed(1) : '—';
    };
    const SLA = { 'Crítico': 4, 'Alto': 8, 'Medio': 24, 'Bajo': 48 };
    const slaCheck = (arr, key) => {
      const r = arr.filter(i => i.status === 'Resuelto' && i.resolution_hours);
      if (!r.length) return null;
      return Math.round((r.filter(i => i.resolution_hours <= SLA[key]).length / r.length) * 100);
    };
    const criticalityScore =
      critica.filter(i => i.status === 'Resuelto').length * 4 +
      alta.filter(i => i.status === 'Resuelto').length * 3 +
      media.filter(i => i.status === 'Resuelto').length * 2 +
      baja.filter(i => i.status === 'Resuelto').length;
    return {
      name: t.full_name || t.email, email: t.email,
      Asignadas: assigned.length, Resueltas: resolved.length,
      Pendientes: pending, 'En atención': inProgress, 'No reproducible': noRepro,
      avgHrs,
      critica: critica.length, alta: alta.length, media: media.length, baja: baja.length,
      avgHrsCritica: avgHrsByCrit(critica), avgHrsAlta: avgHrsByCrit(alta),
      slaCritica: slaCheck(critica, 'Crítico'), slaAlta: slaCheck(alta, 'Alto'),
      criticalityScore,
    };
  }).filter(t => t.Asignadas > 0), [incidentsPeriodFiltered, techs]);

  const ranking = useMemo(() => {
    return [...techProductivity].map(t => {
      const reqScore = computeRequestScore(t);
      const incData  = incidentsByTech.find(i => i.email === t.email);
      const incScore = incData ? computeIncidentScore(incData) : 0;
      const combined = incData
        ? Math.round(reqScore * 0.55 + incScore * 0.45)
        : reqScore;
      return { ...t, score: combined, reqScore, incScore, incData };
    }).sort((a, b) => b.score - a.score);
  }, [techProductivity, incidentsByTech]);

  const distData = techProductivity.map(t => ({
    name: t.name.split(' ')[0],
    Difícil: t.difficultCount,
    Medio: t.mediumCount,
    Fácil: t.easyCount,
  }));

  const resolutionByTech = techProductivity
    .filter(t => t.avgHrs !== '—')
    .map(t => ({ name: t.name.split(' ')[0], horas: parseFloat(t.avgHrs) }))
    .sort((a, b) => a.horas - b.horas);

  const maxFin = ranking[0]?.Finalizadas || 1;
  const maxScore = ranking[0]?.score || 1;

  const exportRankingCSV = () => exportCSV('ranking_tecnicos',
    ['Pos.', 'Técnico', 'Score', 'Finalizadas', 'Asignadas', 'Tasa éxito', 'Complejidad', 'Prom.h', 'A tiempo %'],
    ranking.map((t, i) => {
      const rate = t.Asignadas > 0 ? Math.round((t.Finalizadas / t.Asignadas) * 100) : 0;
      return [i + 1, t.name, t.score, t.Finalizadas, t.Asignadas, `${rate}%`, t.complexityScore, t.avgHrs, t.onTimeRate !== null ? `${t.onTimeRate}%` : '—'];
    })
  );
  const exportRankingPDF = () => exportTablePDF('Ranking de Técnicos',
    ['Pos.', 'Técnico', 'Score', 'Finalizadas', 'Asignadas', 'Tasa éxito', 'Complejidad', 'Prom.h', 'A tiempo %'],
    ranking.map((t, i) => {
      const rate = t.Asignadas > 0 ? Math.round((t.Finalizadas / t.Asignadas) * 100) : 0;
      return [i + 1, t.name, t.score, t.Finalizadas, t.Asignadas, `${rate}%`, t.complexityScore, t.avgHrs, t.onTimeRate !== null ? `${t.onTimeRate}%` : '—'];
    })
  );
  const exportProdCSV = () => exportCSV('productividad_tecnicos',
    ['Técnico', 'Asignadas', 'Finalizadas', 'En progreso', 'Rechazadas', 'Prom.h', 'Complejidad', 'Difíciles', 'Medios', 'Fáciles', 'A tiempo%'],
    techProductivity.map(t => [t.name, t.Asignadas, t.Finalizadas, t['En progreso'], t.Rechazadas, t.avgHrs, t.complexityScore, t.difficultCount, t.mediumCount, t.easyCount, t.onTimeRate !== null ? `${t.onTimeRate}%` : '—'])
  );
  const exportProdPDF = () => exportTablePDF('Productividad por Técnico',
    ['Técnico', 'Asignadas', 'Finalizadas', 'En progreso', 'Rechazadas', 'Prom.h', 'Complejidad', 'A tiempo%'],
    techProductivity.map(t => [t.name, t.Asignadas, t.Finalizadas, t['En progreso'], t.Rechazadas, t.avgHrs, t.complexityScore, t.onTimeRate !== null ? `${t.onTimeRate}%` : '—'])
  );
  const exportDeptCSV = () => exportCSV('solicitudes_departamento',
    ['Departamento', 'Total', 'Finalizadas', 'En progreso', 'Pendientes'],
    stats.byDept.map(d => [d.name, d.total, d.Finalizadas, d['En progreso'], d.Pendientes])
  );
  const exportDeptPDF = () => exportTablePDF('Solicitudes por Departamento',
    ['Departamento', 'Total', 'Finalizadas', 'En progreso', 'Pendientes'],
    stats.byDept.map(d => [d.name, d.total, d.Finalizadas, d['En progreso'], d.Pendientes])
  );

  // Incident metrics by tech — enriquecido con criticidad, SLA y score
  const incidentStats = useMemo(() => {
    const inc = incidentsPeriodFiltered;
    const total     = inc.length;
    const resolved  = inc.filter(i => i.status === 'Resuelto').length;
    const pending   = inc.filter(i => i.status === 'Pendiente').length;
    const inProgress = inc.filter(i => i.status === 'En atención').length;
    const withHrs   = inc.filter(i => i.resolution_hours);
    const avgHrs    = withHrs.length > 0
      ? (withHrs.reduce((s, i) => s + i.resolution_hours, 0) / withHrs.length).toFixed(1)
      : '—';

    // Críticas sin resolver
    const criticalPending = inc.filter(i => i.impact?.startsWith('Crítico') && i.status !== 'Resuelto' && i.status !== 'No reproducible').length;

    // Por categoría
    const byCategory = {};
    inc.forEach(i => { if (i.category) byCategory[i.category] = (byCategory[i.category] || 0) + 1; });
    const byCategoryArr = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Por impacto
    const byImpact = {};
    inc.forEach(i => { if (i.impact) { const k = i.impact.split(' - ')[0]; byImpact[k] = (byImpact[k] || 0) + 1; } });
    const byImpactArr = ['Crítico', 'Alto', 'Medio', 'Bajo']
      .filter(k => byImpact[k])
      .map(name => ({ name, value: byImpact[name] }));

    // Tiempo prom por criticidad
    const avgHrsByCrit = (key) => {
      const r = inc.filter(i => i.impact?.startsWith(key) && i.resolution_hours);
      return r.length > 0 ? (r.reduce((s, i) => s + i.resolution_hours, 0) / r.length).toFixed(1) : '—';
    };
    const avgHrsByCritArr = ['Crítico', 'Alto', 'Medio', 'Bajo'].map(k => ({
      name: k, horas: avgHrsByCrit(k) === '—' ? 0 : parseFloat(avgHrsByCrit(k)),
      label: avgHrsByCrit(k),
    })).filter(k => k.horas > 0);

    // Por departamento
    const byDept = {};
    inc.forEach(i => { if (i.department) byDept[i.department] = (byDept[i.department] || 0) + 1; });
    const byDeptArr = Object.entries(byDept).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Tendencia semanal (últimas 8 semanas)
    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const ws = new Date(); ws.setDate(ws.getDate() - (7 - i) * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      return {
        week: `S${i + 1}`,
        Creadas:  incidents.filter(r => { const d = new Date(r.created_date); return d >= ws && d < we; }).length,
        Resueltas: incidents.filter(r => { const d = r.resolved_at ? new Date(r.resolved_at) : null; return d && d >= ws && d < we; }).length,
      };
    });

    // Herramientas / tools más frecuentes
    const byTool = {};
    inc.forEach(i => { if (i.tool_name) byTool[i.tool_name] = (byTool[i.tool_name] || 0) + 1; });
    const byToolArr = Object.entries(byTool).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    // SLA global: críticas ≤ 4h
    const critResolved = inc.filter(i => i.impact?.startsWith('Crítico') && i.status === 'Resuelto' && i.resolution_hours);
    const slaGlobal = critResolved.length > 0
      ? Math.round((critResolved.filter(i => i.resolution_hours <= 4).length / critResolved.length) * 100)
      : null;

    return { total, resolved, pending, inProgress, avgHrs, criticalPending, byCategoryArr, byImpactArr, avgHrsByCritArr, byDeptArr, weeklyTrend, byToolArr, slaGlobal, resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0 };
  }, [incidentsPeriodFiltered, incidents]);

  const tabStyle = (t) => ({
    color: activeTab === t ? 'white' : 'hsl(215,20%,55%)',
    borderBottom: activeTab === t ? '2px solid hsl(217,91%,60%)' : '2px solid transparent',
    paddingBottom: 8,
    cursor: 'pointer',
    fontWeight: activeTab === t ? 700 : 400,
    fontSize: 13,
    background: 'none',
    border: 'none',
    outline: 'none',
  });

  return (
    <div className="space-y-5">
      {/* Guard banner */}
      {activeGuardia && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${isCurrentUserOnDuty ? 'ring-1 ring-green-500/40' : ''}`}
          style={{ background: isCurrentUserOnDuty ? 'hsl(142,50%,12%)' : 'hsl(222,47%,14%)', border: `1px solid ${isCurrentUserOnDuty ? 'hsl(142,60%,22%)' : 'hsl(217,33%,22%)'}` }}>
          <Shield className={`w-5 h-5 shrink-0 ${isCurrentUserOnDuty ? 'text-green-400' : 'text-blue-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isCurrentUserOnDuty ? 'text-green-300' : 'text-white'}`}>
              {isCurrentUserOnDuty ? '¡Estás de guardia ahora!' : `Técnico de guardia: ${activeGuardia.tecnico_nombre}`}
            </p>
            <p className="text-xs" style={{ color: 'hsl(215,20%,55%)' }}>
              Hasta {new Date(activeGuardia.fin).toLocaleString('es', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {activeGuardia.tipo && activeGuardia.tipo !== 'normal' && ` · ${activeGuardia.tipo}`}
            </p>
          </div>
        </div>
      )}

      {/* KPI detail modal */}
      {kpiModal && (
        <KpiDetailModal
          title={kpiModal.title}
          items={kpiModal.items}
          type={kpiModal.type}
          onClose={() => setKpiModal(null)}
          users={users}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white">Dashboard & Análisis</h2>
        <div className="flex gap-2 flex-wrap">
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
            <option value="all">Todos los tiempos</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
          </select>
          <select value={techFilter} onChange={e => setTechFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
            <option value="all">Todos los técnicos</option>
            {techs.map(t => <option key={t.email} value={t.email}>{t.full_name || t.email}</option>)}
          </select>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
            style={{ background: 'hsl(217,91%,40%)', color: 'white' }}
          >
            <Mail className="w-3.5 h-3.5" /> Enviar Reporte
          </button>
        </div>
      </div>

      {showReportModal && (
        <ScheduledReportModal onClose={() => setShowReportModal(false)} stats={stats} techProductivity={techProductivity} requests={periodFiltered} />
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: 'hsl(217,33%,18%)' }}>
        <button style={tabStyle('solicitudes')} onClick={() => setActiveTab('solicitudes')}>Solicitudes</button>
        <button style={tabStyle('incidencias')} onClick={() => setActiveTab('incidencias')}>Incidencias</button>
      </div>

      {activeTab === 'incidencias' && (
        <div className="space-y-5">

          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Total incidencias" value={incidentStats.total} subtitle="En el periodo" icon={FileText} iconColor="text-gray-400" />
            <StatCard title="Resueltas" value={incidentStats.resolved} subtitle={`Tasa ${incidentStats.resolutionRate}%`} icon={CheckCircle2} iconColor="text-green-400" highlight="text-green-400" />
            <StatCard title="En atención" value={incidentStats.inProgress} icon={Loader2} iconColor="text-blue-400" highlight="text-blue-400" />
            <StatCard title="Tiempo prom. resolución" value={incidentStats.avgHrs !== '—' ? `${incidentStats.avgHrs}h` : '—'} subtitle="Para resueltas" icon={AlarmClock} iconColor="text-orange-400" />
            <StatCard title="Pendientes" value={incidentStats.pending} icon={Clock} iconColor="text-yellow-400" highlight="text-yellow-400" />
            <StatCard title="⚠ Críticas sin resolver" value={incidentStats.criticalPending} subtitle="Requieren atención inmediata" icon={AlertTriangle} iconColor="text-red-400" highlight={incidentStats.criticalPending > 0 ? 'text-red-400' : 'text-white'} />
            {incidentStats.slaGlobal !== null && (
              <StatCard title="SLA críticas (≤4h)" value={`${incidentStats.slaGlobal}%`} subtitle="Resueltas en tiempo" icon={Zap} iconColor="text-purple-400" highlight={incidentStats.slaGlobal >= 80 ? 'text-green-400' : incidentStats.slaGlobal >= 50 ? 'text-yellow-400' : 'text-red-400'} />
            )}
          </div>

          {/* Tendencia semanal */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <SectionTitle title="Tendencia semanal de incidencias" subtitle="Creadas vs resueltas — últimas 8 semanas" />
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={incidentStats.weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,20%)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: muted }} />
                <YAxis tick={{ fontSize: 10, fill: muted }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: muted }} />
                <Line type="monotone" dataKey="Creadas" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Resueltas" stroke="#4ade80" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-5" style={cardStyle}>
              <SectionTitle title="Por criticidad (impacto)" />
              <div className="space-y-2">
                {incidentStats.byImpactArr.map(imp => (
                  <MiniBar key={imp.name} label={imp.name} value={imp.value} max={incidentStats.total}
                    color={imp.name === 'Crítico' ? '#f87171' : imp.name === 'Alto' ? '#fb923c' : imp.name === 'Medio' ? '#fbbf24' : '#4ade80'} />
                ))}
                {incidentStats.byImpactArr.length === 0 && <p className="text-xs" style={{ color: muted }}>Sin datos</p>}
              </div>
            </div>
            <div className="rounded-xl p-5" style={cardStyle}>
              <SectionTitle title="Por categoría" />
              <div className="space-y-2">
                {incidentStats.byCategoryArr.map(c => (
                  <MiniBar key={c.name} label={c.name} value={c.value} max={incidentStats.total} color="#818cf8" />
                ))}
                {incidentStats.byCategoryArr.length === 0 && <p className="text-xs" style={{ color: muted }}>Sin datos</p>}
              </div>
            </div>
            {incidentStats.byDeptArr.length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <SectionTitle title="Por departamento" />
                <div className="space-y-2">
                  {incidentStats.byDeptArr.map(d => (
                    <MiniBar key={d.name} label={d.name} value={d.value} max={incidentStats.total} color="#22d3ee" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tiempo resolución por criticidad + herramientas más afectadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incidentStats.avgHrsByCritArr.length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <SectionTitle title="Tiempo prom. de resolución por criticidad" subtitle="Horas desde reporte hasta resolución" />
                <ResponsiveContainer width="100%" height={Math.max(120, incidentStats.avgHrsByCritArr.length * 50)}>
                  <BarChart data={incidentStats.avgHrsByCritArr} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: muted }} unit="h" />
                    <YAxis dataKey="name" type="category" width={65} tick={{ fontSize: 10, fill: muted }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}h`, 'Prom. resolución']} />
                    <Bar dataKey="horas" radius={[0, 4, 4, 0]}>
                      {incidentStats.avgHrsByCritArr.map((entry) => (
                        <rect key={entry.name} fill={entry.name === 'Crítico' ? '#f87171' : entry.name === 'Alto' ? '#fb923c' : entry.name === 'Medio' ? '#fbbf24' : '#4ade80'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {incidentStats.byToolArr.length > 0 && (
              <div className="rounded-xl p-5" style={cardStyle}>
                <SectionTitle title="Herramientas / activos más afectados" subtitle="Top 8 por frecuencia de incidencias" />
                <div className="space-y-2">
                  {incidentStats.byToolArr.map(t => (
                    <MiniBar key={t.name} label={t.name} value={t.value} max={incidentStats.byToolArr[0]?.value || 1} color="#a78bfa" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabla detallada por técnico */}
          {incidentsByTech.length > 0 && (
            <div className="rounded-xl p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle title="Ranking de técnicos — Incidencias" subtitle="Criticidad atendida, tiempos de resolución y cumplimiento SLA" />
                <ExportBtn
                  onCSV={() => exportCSV('incidencias_tecnicos',
                    ['Técnico', 'Asignadas', 'Resueltas', 'Tasa%', 'Prom.h', 'Críticas', 'Altas', 'Medias', 'Bajas', 'Score crit.', 'h Críticas', 'h Altas', 'SLA Críticas%', 'SLA Altas%'],
                    incidentsByTech.map(t => {
                      const rate = t.Asignadas > 0 ? Math.round((t.Resueltas / t.Asignadas) * 100) : 0;
                      return [t.name, t.Asignadas, t.Resueltas, `${rate}%`, t.avgHrs, t.critica, t.alta, t.media, t.baja, t.criticalityScore, t.avgHrsCritica, t.avgHrsAlta, t.slaCritica !== null ? `${t.slaCritica}%` : '—', t.slaAlta !== null ? `${t.slaAlta}%` : '—'];
                    })
                  )}
                  onPDF={() => exportTablePDF('Ranking Técnicos — Incidencias',
                    ['Técnico', 'Asignadas', 'Resueltas', 'Tasa%', 'Prom.h', 'Críticas', 'Altas', 'Score crit.', 'SLA Críticas%'],
                    incidentsByTech.map(t => {
                      const rate = t.Asignadas > 0 ? Math.round((t.Resueltas / t.Asignadas) * 100) : 0;
                      return [t.name, t.Asignadas, t.Resueltas, `${rate}%`, t.avgHrs, t.critica, t.alta, t.criticalityScore, t.slaCritica !== null ? `${t.slaCritica}%` : '—'];
                    })
                  )}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[800px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid hsl(217,33%,22%)' }}>
                      {['Técnico', 'Asignadas', 'Resueltas', 'En at.', 'Tasa éxito', 'Prom.h total', 'Críticas', 'h Críticas', 'SLA≤4h', 'Altas', 'h Altas', 'SLA≤8h', 'Medias', 'Bajas', 'Score crit.'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-medium whitespace-nowrap" style={{ color: 'hsl(215,20%,45%)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {incidentsByTech.sort((a, b) => b.criticalityScore - a.criticalityScore).map((t, i) => {
                      const rate = t.Asignadas > 0 ? Math.round((t.Resueltas / t.Asignadas) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid hsl(217,33%,16%)', background: i === 0 ? 'hsl(222,47%,13%)' : undefined }}>
                          <td className="py-2 px-2 font-semibold" style={{ color: '#60a5fa' }}>
                            {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{t.name}
                          </td>
                          <td className="py-2 px-2 text-white font-semibold">{t.Asignadas}</td>
                          <td className="py-2 px-2 text-green-400 font-semibold">{t.Resueltas}</td>
                          <td className="py-2 px-2 text-blue-300">{t['En atención']}</td>
                          <td className="py-2 px-2">
                            <span className={`font-semibold ${rate >= 70 ? 'text-green-400' : rate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{rate}%</span>
                          </td>
                          <td className="py-2 px-2 text-orange-300">{t.avgHrs !== '—' ? `${t.avgHrs}h` : '—'}</td>
                          <td className="py-2 px-2 font-semibold" style={{ color: '#f87171' }}>{t.critica}</td>
                          <td className="py-2 px-2" style={{ color: '#fca5a5' }}>{t.avgHrsCritica !== '—' ? `${t.avgHrsCritica}h` : '—'}</td>
                          <td className="py-2 px-2">
                            {t.slaCritica !== null
                              ? <span className={`font-semibold ${t.slaCritica >= 80 ? 'text-green-400' : t.slaCritica >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{t.slaCritica}%</span>
                              : <span style={{ color: muted }}>—</span>}
                          </td>
                          <td className="py-2 px-2 font-semibold" style={{ color: '#fb923c' }}>{t.alta}</td>
                          <td className="py-2 px-2" style={{ color: '#fed7aa' }}>{t.avgHrsAlta !== '—' ? `${t.avgHrsAlta}h` : '—'}</td>
                          <td className="py-2 px-2">
                            {t.slaAlta !== null
                              ? <span className={`font-semibold ${t.slaAlta >= 80 ? 'text-green-400' : t.slaAlta >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{t.slaAlta}%</span>
                              : <span style={{ color: muted }}>—</span>}
                          </td>
                          <td className="py-2 px-2 text-yellow-400">{t.media}</td>
                          <td className="py-2 px-2 text-green-400">{t.baja}</td>
                          <td className="py-2 px-2 font-bold text-purple-300">{t.criticalityScore}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'solicitudes' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Total solicitudes" value={stats.total} subtitle="En el periodo" icon={FileText} iconColor="text-gray-400"
              onClick={() => setKpiModal({ title: 'Todas las solicitudes', items: periodFiltered, type: 'total' })} />
            <StatCard title="Finalizadas" value={stats.finalizada} subtitle={`Tasa ${stats.resolutionRate}%`} icon={CheckCircle2} iconColor="text-green-400" highlight="text-green-400"
              onClick={() => setKpiModal({ title: 'Finalizadas', items: periodFiltered.filter(r => r.status === 'Finalizada'), type: 'finalizada' })} />
            <StatCard title="En progreso" value={stats.enProgreso} icon={Loader2} iconColor="text-blue-400" highlight="text-blue-400"
              onClick={() => setKpiModal({ title: 'En progreso', items: periodFiltered.filter(r => r.status === 'En progreso'), type: 'progreso' })} />
            <StatCard title="Pendientes" value={stats.pendiente} icon={Clock} iconColor="text-yellow-400" highlight="text-yellow-400"
              onClick={() => setKpiModal({ title: 'Pendientes', items: periodFiltered.filter(r => r.status === 'Pendiente'), type: 'pendiente' })} />
            <StatCard title="En revisión" value={stats.enRevision} icon={Eye} iconColor="text-purple-400" highlight="text-purple-400"
              onClick={() => setKpiModal({ title: 'En revisión', items: periodFiltered.filter(r => r.status === 'En revisión'), type: 'revision' })} />
            <StatCard title="Rechazadas" value={stats.rechazada} icon={XCircle} iconColor="text-red-400" highlight="text-red-400"
              onClick={() => setKpiModal({ title: 'Rechazadas', items: periodFiltered.filter(r => r.status === 'Rechazada'), type: 'rechazada' })} />
            <StatCard title="Tiempo prom. resolución" value={stats.avgResolutionHrs === '—' ? '—' : `${stats.avgResolutionHrs}h`} subtitle="Para finalizadas" icon={AlarmClock} iconColor="text-orange-400" />
            <StatCard title="⚠ Vencidas" value={stats.vencidas} subtitle="Fecha compromiso expirada" icon={AlertTriangle} iconColor="text-orange-400" highlight={stats.vencidas > 0 ? 'text-orange-400' : 'text-white'}
              onClick={() => setKpiModal({ title: '⚠ Vencidas', items: periodFiltered.filter(r => r.estimated_due && new Date(r.estimated_due) < new Date() && r.status !== 'Finalizada' && r.status !== 'Rechazada'), type: 'vencidas' })} />
          </div>

          {/* Daily trend */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <SectionTitle title="Tendencia diaria" subtitle="Solicitudes creadas vs finalizadas (últimos 14 días)" />
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={stats.dailyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,20%)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: muted }} />
                <YAxis tick={{ fontSize: 10, fill: muted }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: muted }} />
                <Line type="monotone" dataKey="Creadas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Finalizadas" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Ranking */}
          {ranking.length > 0 && (
            <div className="rounded-xl p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Award className="w-4 h-4 text-yellow-400" /> Ranking de Técnicos de Soporte</h3>
                  <p className="text-xs mt-0.5" style={{ color: muted }}>Score compuesto: volumen × tasa éxito × complejidad × velocidad de ejecución</p>
                </div>
                <ExportBtn onCSV={exportRankingCSV} onPDF={exportRankingPDF} />
              </div>
              <div className="space-y-3">
                {ranking.map((t, i) => {
                  const rate = t.Asignadas > 0 ? Math.round((t.Finalizadas / t.Asignadas) * 100) : 0;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={t.email} className="rounded-xl p-4" style={{ background: i === 0 ? 'hsl(38,40%,13%)' : 'hsl(222,47%,13%)', border: `1px solid ${i === 0 ? 'hsl(38,60%,25%)' : 'hsl(217,33%,20%)'}` }}>
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <span className="text-lg">{medals[i] || `#${i + 1}`}</span>
                          <div>
                            <p className="text-sm font-bold text-white">{t.name}</p>
                            <p className="text-[10px]" style={{ color: muted }}>{t.email}</p>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px]" style={{ color: muted }}>Score global</span>
                            <ScoreBadge score={t.score} />
                          </div>
                          <div className="w-full rounded-full h-2" style={{ background: 'hsl(217,33%,20%)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${t.score}%`, background: t.score >= 75 ? '#4ade80' : t.score >= 50 ? '#fbbf24' : '#f87171' }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 w-full mt-1">
                          <MetricCell label="Asignadas" value={t.Asignadas} color="#60a5fa" icon={<Target className="w-3 h-3" />} />
                          <MetricCell label="Finalizadas" value={t.Finalizadas} color="#4ade80" icon={<CheckCircle2 className="w-3 h-3" />} />
                          <MetricCell label="Tasa éxito" value={`${rate}%`} color={rate >= 70 ? '#4ade80' : rate >= 40 ? '#fbbf24' : '#f87171'} icon={<Percent className="w-3 h-3" />} />
                          <MetricCell label="Prom. horas" value={t.avgHrs !== '—' ? `${t.avgHrs}h` : '—'} color="#fb923c" icon={<AlarmClock className="w-3 h-3" />} />
                          <MetricCell label="Complejidad" value={t.complexityScore} color="#c084fc" icon={<Zap className="w-3 h-3" />} />
                          <MetricCell label="A tiempo" value={t.onTimeRate !== null ? `${t.onTimeRate}%` : '—'} color={t.onTimeRate >= 80 ? '#4ade80' : t.onTimeRate >= 50 ? '#fbbf24' : '#f87171'} icon={<TrendingUp className="w-3 h-3" />} />
                        </div>
                        <div className="w-full mt-1 space-y-1">
                          <p className="text-[10px] font-medium" style={{ color: muted }}>Solicitudes — dificultad</p>
                          <div className="flex gap-3 flex-wrap">
                            {[['Fácil', t.easyCount, '#4ade80'], ['Medio', t.mediumCount, '#fbbf24'], ['Difícil', t.difficultCount, '#f87171']].map(([l, v, c]) => (
                              <span key={l} className="flex items-center gap-1 text-xs" style={{ color: c }}>
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                                {l}: <strong>{v}</strong>
                              </span>
                            ))}
                            <span className="text-[10px] ml-auto" style={{ color: muted }}>
                              Score solicitudes: <strong className="text-white">{t.reqScore}</strong>
                            </span>
                          </div>
                        </div>
                        {t.incData && (
                          <div className="w-full mt-2 rounded-lg px-3 py-2" style={{ background: 'hsl(0,30%,12%)', border: '1px solid hsl(0,40%,22%)' }}>
                            <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#fca5a5' }}>
                              🚨 Incidencias · Score: <strong className="text-white">{t.incScore}</strong>
                            </p>
                            <div className="flex gap-4 flex-wrap">
                              <span className="text-[10px]" style={{ color: muted }}>Atendidas: <strong className="text-white">{t.incData.Asignadas}</strong></span>
                              <span className="text-[10px]" style={{ color: muted }}>Resueltas: <strong className="text-green-400">{t.incData.Resueltas}</strong></span>
                              <span className="text-[10px]" style={{ color: muted }}>Prom: <strong className="text-orange-300">{t.incData.avgHrs !== '—' ? `${t.incData.avgHrs}h` : '—'}</strong></span>
                              {[['🔴 Crítico', t.incData.critica, '#f87171'], ['🟠 Alto', t.incData.alta, '#fb923c'], ['🟡 Medio', t.incData.media, '#fbbf24'], ['🟢 Bajo', t.incData.baja, '#4ade80']].filter(([, v]) => v > 0).map(([l, v, c]) => (
                                <span key={l} className="text-[10px]" style={{ color: c }}>{l}: <strong>{v}</strong></span>
                              ))}
                              {t.incData.slaCritica !== null && (
                                <span className="text-[10px]" style={{ color: t.incData.slaCritica >= 80 ? '#4ade80' : t.incData.slaCritica >= 50 ? '#fbbf24' : '#f87171' }}>
                                  SLA críticas: <strong>{t.incData.slaCritica}%</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Productivity table */}
          {techProductivity.length > 0 && (
            <div className="rounded-xl p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle title="Tabla de métricas por técnico" subtitle="Detalle completo de rendimiento individual" />
                <ExportBtn onCSV={exportProdCSV} onPDF={exportProdPDF} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[800px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid hsl(217,33%,22%)' }}>
                      {['Técnico', 'Asignadas', 'Finalizadas', 'En progreso', 'Rechazadas', 'Tasa éxito', 'Prom. horas', 'A tiempo', 'Score complejidad', 'Difícil', 'Medio', 'Fácil'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-medium" style={{ color: 'hsl(215,20%,45%)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {techProductivity.map((t, i) => {
                      const rate = t.Asignadas > 0 ? Math.round((t.Finalizadas / t.Asignadas) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid hsl(217,33%,16%)' }}>
                          <td className="py-2 px-2 text-blue-400 font-medium">{t.name}</td>
                          <td className="py-2 px-2 text-white">{t.Asignadas}</td>
                          <td className="py-2 px-2 text-green-400 font-semibold">{t.Finalizadas}</td>
                          <td className="py-2 px-2 text-blue-300">{t['En progreso']}</td>
                          <td className="py-2 px-2 text-red-400">{t.Rechazadas}</td>
                          <td className="py-2 px-2"><span className={`font-semibold ${rate >= 70 ? 'text-green-400' : rate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{rate}%</span></td>
                          <td className="py-2 px-2 text-orange-300">{t.avgHrs !== '—' ? `${t.avgHrs}h` : '—'}</td>
                          <td className="py-2 px-2" style={{ color: t.onTimeRate >= 80 ? '#4ade80' : t.onTimeRate >= 50 ? '#fbbf24' : '#f87171' }}>
                            {t.onTimeRate !== null ? `${t.onTimeRate}%` : '—'}
                          </td>
                          <td className="py-2 px-2 text-purple-300 font-semibold">{t.complexityScore}</td>
                          <td className="py-2 px-2" style={{ color: '#f87171' }}>{t.difficultCount}</td>
                          <td className="py-2 px-2" style={{ color: '#fbbf24' }}>{t.mediumCount}</td>
                          <td className="py-2 px-2" style={{ color: '#4ade80' }}>{t.easyCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Complexity + resolution charts */}
          {distData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl p-5" style={cardStyle}>
                <SectionTitle title="Dificultad atendida por técnico" subtitle="Distribución de tareas Fácil / Medio / Difícil" />
                <ResponsiveContainer width="100%" height={Math.max(120, distData.length * 40)}>
                  <BarChart data={distData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: muted }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: muted }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="Fácil" stackId="a" fill="#4ade80" />
                    <Bar dataKey="Medio" stackId="a" fill="#fbbf24" />
                    <Bar dataKey="Difícil" stackId="a" fill="#f87171" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {resolutionByTech.length > 0 && (
                <div className="rounded-xl p-5" style={cardStyle}>
                  <SectionTitle title="Tiempo de resolución por técnico" subtitle="Promedio de horas hasta finalización" />
                  <ResponsiveContainer width="100%" height={Math.max(120, resolutionByTech.length * 40)}>
                    <BarChart data={resolutionByTech} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: muted }} unit="h" />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: muted }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}h`, 'Prom. resolución']} />
                      <Bar dataKey="horas" fill="#f97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Weekly trend */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <SectionTitle title="Tendencia semanal" subtitle="Solicitudes creadas vs finalizadas (últimas 8 semanas)" />
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={stats.weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,20%)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: muted }} />
                <YAxis tick={{ fontSize: 10, fill: muted }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Creadas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Finalizadas" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: muted }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={cardStyle}>
              <SectionTitle title="Por prioridad" />
              <div className="space-y-2">
                {stats.byPriority.map(p => (
                  <MiniBar key={p.name} label={p.name} value={p.value} max={stats.total} color={PRIORITY_COLORS[p.name]} />
                ))}
              </div>
            </div>
            <div className="rounded-xl p-4" style={cardStyle}>
              <SectionTitle title="Por dificultad" />
              <div className="space-y-2">
                {stats.byLevel.map(l => (
                  <MiniBar key={l.name} label={l.name} value={l.value} max={stats.total} color={LEVEL_COLORS[l.name]} />
                ))}
              </div>
            </div>
            <div className="rounded-xl p-4" style={cardStyle}>
              <SectionTitle title="Por tipo de solicitud" />
              <div className="space-y-2">
                {stats.byRequestType.filter(t => t.value > 0).map(t => (
                  <MiniBar key={t.name} label={t.name.replace('Corrección de errores', 'Corrección')} value={t.value} max={stats.total} color={REQUEST_TYPE_COLORS[t.name]} />
                ))}
                {stats.byRequestType.every(t => t.value === 0) && <p className="text-xs" style={{ color: muted }}>Sin datos aún</p>}
              </div>
            </div>
            <div className="rounded-xl p-4" style={cardStyle}>
              <SectionTitle title="Por estado" />
              <div className="space-y-2">
                {stats.byStatus.map(s => (
                  <MiniBar key={s.name} label={s.name} value={s.value} max={stats.total} color={STATUS_COLORS[s.name]} />
                ))}
              </div>
            </div>
          </div>

          {/* By dept */}
          {stats.byDept.length > 0 && (
            <div className="rounded-xl p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-1">
                <SectionTitle title="Solicitudes por departamento" />
                <ExportBtn onCSV={exportDeptCSV} onPDF={exportDeptPDF} />
              </div>
              <ResponsiveContainer width="100%" height={Math.max(160, stats.byDept.length * 40)}>
                <BarChart data={stats.byDept} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: muted }} />
                  <YAxis tick={{ fontSize: 10, fill: muted }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, color: muted }} />
                  <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Finalizadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="En progreso" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pendientes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, color, icon }) {
  return (
    <div className="flex flex-col items-center rounded-lg px-2 py-2" style={{ background: 'hsl(222,47%,16%)' }}>
      <span className="flex items-center gap-1 mb-1" style={{ color }}>{icon}<span className="text-[10px]">{label}</span></span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}