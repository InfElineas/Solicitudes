import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Search, RotateCcw, Download, FileText,
  AlertTriangle, CheckCircle2, RefreshCw, Clock, Mail
} from 'lucide-react';
import { toast } from 'sonner';

const cardStyle  = { background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' };
const muted      = 'hsl(215,20%,55%)';
const selectStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' };

const ENTITY_LABELS = {
  request:  'Solicitud',
  incident: 'Incidencia',
  activo:   'Activo',
  guardia:  'Guardia',
};

const ACTION_COLORS = {
  create:        { bg: 'hsl(142,60%,16%)', text: '#4ade80',  label: 'Creado',     icon: '✚' },
  update:        { bg: 'hsl(217,60%,18%)', text: '#60a5fa',  label: 'Modificado', icon: '✎' },
  delete:        { bg: 'hsl(0,50%,18%)',   text: '#f87171',  label: 'Eliminado',  icon: '✕' },
  status_change: { bg: 'hsl(270,50%,18%)', text: '#c084fc',  label: 'Estado',     icon: '⇄' },
};

const ENTITY_COLORS = {
  request:  '#60a5fa',
  incident: '#fbbf24',
  activo:   '#34d399',
  guardia:  '#c084fc',
};

const PERIOD_OPTIONS = [
  { value: 'all',  label: 'Todo el tiempo' },
  { value: '1d',   label: 'Hoy' },
  { value: '7d',   label: 'Últimos 7 días' },
  { value: '30d',  label: 'Últimos 30 días' },
  { value: '90d',  label: 'Últimos 90 días' },
];

function exportCSV(logs) {
  const headers = ['Fecha', 'Acción', 'Entidad', 'Título', 'Campo', 'Valor anterior', 'Valor nuevo', 'Usuario'];
  const rows = logs.map(l => [
    new Date(l.created_date).toLocaleString('es'),
    ACTION_COLORS[l.action]?.label || l.action,
    ENTITY_LABELS[l.entity_type] || l.entity_type,
    l.entity_title || '',
    l.field_changed || '',
    l.old_value || '',
    l.new_value || '',
    l.by_user_name || '',
  ]);
  const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function RestoreModal({ log, onClose, onRestored }) {
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (!log.snapshot) { toast.error('No hay snapshot disponible para restaurar'); return; }
    setRestoring(true);
    try {
      const data = JSON.parse(log.snapshot) || {};
      const { id, created_date, updated_date, created_by, ...restoreData } = data;
      if (log.entity_type === 'request')        await base44.entities.Request.update(log.entity_id, restoreData);
      else if (log.entity_type === 'incident')  await base44.entities.Incident.update(log.entity_id, restoreData);
      else if (log.entity_type === 'activo')    await base44.entities.Activo.update(log.entity_id, restoreData);
      else if (log.entity_type === 'guardia')   await base44.entities.Guardia.update(log.entity_id, restoreData);
      else { toast.error('Tipo de entidad desconocido, no se puede restaurar'); return; }
      toast.success('Estado restaurado correctamente');
      onRestored();
    } catch {
      toast.error('Error al restaurar');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-1">¿Restaurar estado anterior?</h3>
        <p className="text-xs mb-1" style={{ color: muted }}>Entidad: <strong className="text-white">{log.entity_title}</strong></p>
        <p className="text-xs mb-1" style={{ color: muted }}>Acción registrada: <strong className="text-white">{new Date(log.created_date).toLocaleString('es')}</strong></p>
        <p className="text-xs mb-4" style={{ color: muted }}>Esto aplicará el snapshot guardado sobre el registro actual. La operación no puede deshacerse.</p>
        {!log.snapshot && <p className="text-xs text-red-400 mb-3">⚠ No hay snapshot para este registro.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button onClick={handleRestore} disabled={restoring || !log.snapshot}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: 'hsl(217,91%,45%)' }}>
            {restoring ? 'Restaurando...' : 'Restaurar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SnapshotModal({ log, onClose }) {
  let pretty = log.snapshot;
  try { pretty = JSON.stringify(JSON.parse(log.snapshot), null, 2); } catch {}
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg my-8" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-3">Snapshot — {log.entity_title}</h3>
        <pre className="text-xs rounded-lg p-3 overflow-x-auto text-green-300 whitespace-pre-wrap break-words"
          style={{ background: 'hsl(222,47%,8%)', maxHeight: 400, overflowY: 'auto' }}>
          {pretty || 'Sin datos'}
        </pre>
        <button onClick={onClose} className="mt-4 w-full py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10">Cerrar</button>
      </div>
    </div>
  );
}

const INSTALL_SQL = `-- Pegar en Supabase → SQL Editor y ejecutar
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _entity_type TEXT; _entity_id TEXT; _entity_title TEXT;
  _action TEXT; _field TEXT; _old_val TEXT; _new_val TEXT; _snapshot TEXT;
BEGIN
  _entity_type := REPLACE(REPLACE(TG_TABLE_NAME,'requests','request'),'incidents','incident');
  IF TG_OP = 'INSERT' THEN
    _action := 'create'; _entity_id := NEW.id::TEXT;
    _entity_title := COALESCE(NEW.title, NEW.name, NEW.descripcion, '—');
    _snapshot := row_to_json(NEW)::TEXT;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete'; _entity_id := OLD.id::TEXT;
    _entity_title := COALESCE(OLD.title, OLD.name, OLD.descripcion, '—');
    _snapshot := row_to_json(OLD)::TEXT;
  ELSIF TG_OP = 'UPDATE' THEN
    _entity_id := NEW.id::TEXT;
    _entity_title := COALESCE(NEW.title, NEW.name, NEW.descripcion, '—');
    _snapshot := row_to_json(NEW)::TEXT;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := 'status_change'; _field := 'status';
      _old_val := OLD.status; _new_val := NEW.status;
    ELSE
      _action := 'update';
      IF OLD.title IS DISTINCT FROM NEW.title THEN
        _field := 'title'; _old_val := OLD.title; _new_val := NEW.title;
      ELSIF OLD.priority IS DISTINCT FROM NEW.priority THEN
        _field := 'priority'; _old_val := OLD.priority; _new_val := NEW.priority;
      END IF;
    END IF;
  END IF;
  INSERT INTO audit_logs (entity_type,entity_id,entity_title,action,
    field_changed,old_value,new_value,snapshot,created_date)
  VALUES (_entity_type,_entity_id,_entity_title,_action,
    _field,_old_val,_new_val,_snapshot,NOW());
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_requests  ON requests;
DROP TRIGGER IF EXISTS trg_audit_incidents ON incidents;
DROP TRIGGER IF EXISTS trg_audit_activos   ON activos;
DROP TRIGGER IF EXISTS trg_audit_guardias  ON guardias;

CREATE TRIGGER trg_audit_requests  AFTER INSERT OR UPDATE OR DELETE ON requests  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER trg_audit_incidents AFTER INSERT OR UPDATE OR DELETE ON incidents FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER trg_audit_activos   AFTER INSERT OR UPDATE OR DELETE ON activos   FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER trg_audit_guardias  AFTER INSERT OR UPDATE OR DELETE ON guardias  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();`;

function EmptyAuditState() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(INSTALL_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };
  return (
    <div className="rounded-xl p-5" style={{ background: 'hsl(38,50%,10%)', border: '1px solid hsl(38,60%,22%)' }}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-300 mb-1">Triggers de auditoría no instalados</p>
          <p className="text-xs mb-3" style={{ color: 'hsl(38,60%,60%)' }}>
            La tabla está vacía porque los triggers de BD aún no existen. Una vez instalados, todos los cambios en solicitudes, incidencias, activos y guardias quedan registrados.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
              style={{ background: 'hsl(38,70%,30%)', color: '#fde68a' }}>
              {copied ? '✓ Copiado' : '⎘ Copiar SQL de instalación'}
            </button>
            <button onClick={() => setOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
              style={{ background: 'hsl(217,33%,20%)', color: muted }}>
              {open ? 'Ocultar SQL' : 'Ver SQL'}
            </button>
          </div>
          {open && (
            <pre className="mt-3 text-[10px] rounded-lg p-3 overflow-x-auto text-green-300 whitespace-pre-wrap break-words"
              style={{ background: 'hsl(222,47%,8%)', maxHeight: 280, overflowY: 'auto' }}>
              {INSTALL_SQL}
            </pre>
          )}
          <ol className="mt-3 text-xs space-y-0.5" style={{ color: 'hsl(38,60%,65%)' }}>
            <li>1. Copia el SQL → <strong className="text-white">Supabase Dashboard → SQL Editor</strong></li>
            <li>2. Ejecuta → recarga esta página</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 40;

export default function AuditLog() {
  const [tab,           setTab]           = useState('audit');
  const [search,        setSearch]        = useState('');
  const [filterEntity,  setFilterEntity]  = useState('all');
  const [filterAction,  setFilterAction]  = useState('all');
  const [filterUser,    setFilterUser]    = useState('all');
  const [periodFilter,  setPeriodFilter]  = useState('30d');
  const [restoreLog,    setRestoreLog]    = useState(null);
  const [snapshotLog,   setSnapshotLog]   = useState(null);
  const [page,          setPage]          = useState(0);
  const [emailSearch,   setEmailSearch]   = useState('');
  const [emailStatus,   setEmailStatus]   = useState('all');
  const [emailPeriod,   setEmailPeriod]   = useState('7d');
  const qc = useQueryClient();

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-logs'],
    queryFn:  () => base44.entities.AuditLog.list('-created_date', 1000),
    refetchInterval: 60000,
  });

  const { data: emailLogs = [], isLoading: emailLoading, refetch: refetchEmail } = useQuery({
    queryKey: ['email-logs'],
    queryFn:  () => base44.entities.EmailLog.list('-created_date', 500),
    refetchInterval: 60000,
  });

  const filteredEmails = useMemo(() => {
    const now = new Date();
    let l = emailLogs;
    if (emailPeriod === '1d')  l = l.filter(x => new Date(x.created_date) > new Date(now - 86400000));
    if (emailPeriod === '7d')  l = l.filter(x => new Date(x.created_date) > new Date(now - 7  * 86400000));
    if (emailPeriod === '30d') l = l.filter(x => new Date(x.created_date) > new Date(now - 30 * 86400000));
    if (emailStatus !== 'all') l = l.filter(x => x.status === emailStatus);
    if (emailSearch) {
      const s = emailSearch.toLowerCase();
      l = l.filter(x => x.to_email?.toLowerCase().includes(s) || x.subject?.toLowerCase().includes(s) || x.error_message?.toLowerCase().includes(s));
    }
    return l;
  }, [emailLogs, emailPeriod, emailStatus, emailSearch]);

  // Unique users in logs
  const allUsers = useMemo(() => {
    const map = {};
    logs.forEach(l => { if (l.by_user_name) map[l.by_user_name] = true; });
    return Object.keys(map).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let l = logs;
    const now = new Date();
    if (periodFilter === '1d')  l = l.filter(x => new Date(x.created_date) > new Date(now - 86400000));
    if (periodFilter === '7d')  l = l.filter(x => new Date(x.created_date) > new Date(now - 7  * 86400000));
    if (periodFilter === '30d') l = l.filter(x => new Date(x.created_date) > new Date(now - 30 * 86400000));
    if (periodFilter === '90d') l = l.filter(x => new Date(x.created_date) > new Date(now - 90 * 86400000));
    if (filterEntity !== 'all') l = l.filter(x => x.entity_type === filterEntity);
    if (filterAction !== 'all') l = l.filter(x => x.action === filterAction);
    if (filterUser   !== 'all') l = l.filter(x => x.by_user_name === filterUser);
    if (search) {
      const s = search.toLowerCase();
      l = l.filter(x =>
        x.entity_title?.toLowerCase().includes(s) ||
        x.by_user_name?.toLowerCase().includes(s) ||
        x.field_changed?.toLowerCase().includes(s) ||
        x.new_value?.toLowerCase().includes(s) ||
        x.old_value?.toLowerCase().includes(s)
      );
    }
    return l;
  }, [logs, periodFilter, filterEntity, filterAction, filterUser, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // KPI counts (sobre filtrado actual)
  const kpis = useMemo(() => ({
    total:  filtered.length,
    create: filtered.filter(l => l.action === 'create').length,
    update: filtered.filter(l => l.action === 'update').length,
    delete: filtered.filter(l => l.action === 'delete').length,
    status: filtered.filter(l => l.action === 'status_change').length,
  }), [filtered]);

  const resetFilters = () => {
    setSearch(''); setFilterEntity('all'); setFilterAction('all');
    setFilterUser('all'); setPeriodFilter('30d'); setPage(0);
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' }}>
        {[
          { key: 'audit', label: 'Auditoría',    icon: ShieldCheck },
          { key: 'email', label: 'Log de Emails', icon: Mail },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={tab === key
              ? { background: 'hsl(217,91%,40%)', color: 'white' }
              : { color: muted }}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'email' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Mail className="w-4 h-4 text-blue-400" /> Log de Emails</h2>
              <p className="text-xs mt-0.5" style={{ color: muted }}>Todos los intentos de envío de correo — éxitos y fallos</p>
            </div>
            <button onClick={() => refetchEmail()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs hover:opacity-80" style={{ background: 'hsl(217,33%,20%)', color: muted }}>
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
          </div>
          <div className="flex flex-wrap gap-2 p-4 rounded-xl" style={cardStyle}>
            <input value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Buscar destinatario, asunto, error..."
              className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' }} />
            <select value={emailStatus} onChange={e => setEmailStatus(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
              <option value="all">Todos</option>
              <option value="sent">Enviados</option>
              <option value="failed">Fallidos</option>
            </select>
            <select value={emailPeriod} onChange={e => setEmailPeriod(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
              <option value="1d">Hoy</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="all">Todo</option>
            </select>
          </div>
          <div className="flex gap-3 text-xs" style={{ color: muted }}>
            <span>Total: {filteredEmails.length}</span>
            <span style={{ color: '#4ade80' }}>✓ {filteredEmails.filter(x => x.status === 'sent').length} enviados</span>
            <span style={{ color: '#f87171' }}>✕ {filteredEmails.filter(x => x.status === 'failed').length} fallidos</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            {emailLoading ? (
              <div className="p-8 text-center text-sm" style={{ color: muted }}>Cargando...</div>
            ) : filteredEmails.length === 0 ? (
              <div className="py-10 text-center">
                <Mail className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(215,20%,22%)' }} />
                <p className="text-sm" style={{ color: muted }}>Sin registros de email para este filtro</p>
              </div>
            ) : (
              filteredEmails.map((log, idx) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3"
                  style={{ borderBottom: idx < filteredEmails.length - 1 ? '1px solid hsl(217,33%,15%)' : undefined }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: log.status === 'sent' ? 'hsl(142,60%,14%)' : 'hsl(0,50%,16%)' }}>
                    <span className="text-[11px]">{log.status === 'sent' ? '✓' : '✕'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white truncate">{log.subject}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={log.status === 'sent'
                          ? { background: 'hsl(142,60%,14%)', color: '#4ade80' }
                          : { background: 'hsl(0,50%,16%)', color: '#f87171' }}>
                        {log.status === 'sent' ? 'Enviado' : 'Falló'}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: muted }}>→ {log.to_email}</p>
                    {log.error_message && (
                      <p className="text-[11px] mt-0.5 text-red-400 truncate">{log.error_message}</p>
                    )}
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: 'hsl(215,20%,36%)' }}>
                    {new Date(log.created_date).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" /> Registro de Auditoría
          </h1>
          <p className="text-xs mt-0.5" style={{ color: muted }}>
            Historial automático de cambios — solicitudes, incidencias, activos y guardias
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
            style={{ background: 'hsl(217,33%,20%)', color: muted }}>
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
          {filtered.length > 0 && (
            <button onClick={() => exportCSV(filtered)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
              style={{ background: 'hsl(217,91%,40%)', color: 'white' }}>
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Empty state — triggers not yet installed */}
      {!isLoading && logs.length === 0 && (
        <EmptyAuditState />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'total',  label: 'Total registros', value: kpis.total,  color: '#94a3b8', icon: FileText },
          { key: 'create', label: 'Creaciones',       value: kpis.create, color: '#4ade80', icon: CheckCircle2 },
          { key: 'update', label: 'Modificaciones',   value: kpis.update, color: '#60a5fa', icon: RefreshCw },
          { key: 'status', label: 'Cambios de estado',value: kpis.status, color: '#c084fc', icon: Clock },
          { key: 'delete', label: 'Eliminaciones',    value: kpis.delete, color: '#f87171', icon: AlertTriangle },
        ].map(({ key, label, value, color, icon: Icon }) => (
          <div key={key} className="rounded-xl p-3 cursor-pointer hover:opacity-80 transition-opacity" style={cardStyle}
            onClick={() => { setFilterAction(filterAction === key && key !== 'total' ? 'all' : key === 'total' ? 'all' : key); setPage(0); }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px]" style={{ color: muted }}>{label}</p>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px] sm:min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por título, usuario, campo, valor..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' }} />
        </div>
        <select value={periodFilter} onChange={e => { setPeriodFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="all">Todas las entidades</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="all">Todas las acciones</option>
          {Object.entries(ACTION_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {allUsers.length > 0 && (
          <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
            <option value="all">Todos los usuarios</option>
            {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
        <span className="text-xs" style={{ color: muted }}>{filtered.length} registros</span>
        {(search || filterEntity !== 'all' || filterAction !== 'all' || filterUser !== 'all') && (
          <button onClick={resetFilters} className="text-xs px-2 py-1 rounded hover:bg-white/10" style={{ color: muted }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-500">Cargando auditoría...</div>
      ) : paginated.length === 0 && logs.length > 0 ? (
        <div className="text-center py-16 rounded-xl text-gray-500" style={cardStyle}>
          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin registros con los filtros actuales</p>
          <button onClick={resetFilters} className="mt-2 text-xs text-blue-400 hover:underline">Limpiar filtros</button>
        </div>
      ) : paginated.length > 0 ? (
        <div className="space-y-1.5">
          {paginated.map(log => {
            const actionCfg  = ACTION_COLORS[log.action] || ACTION_COLORS.update;
            const entityColor = ENTITY_COLORS[log.entity_type] || '#94a3b8';
            return (
              <div key={log.id} className="rounded-xl px-3 sm:px-4 py-3 flex items-start gap-3 flex-wrap hover:opacity-90 transition-opacity" style={cardStyle}>
                {/* Left: badges */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                    style={{ background: actionCfg.bg, color: actionCfg.text }}>
                    {actionCfg.icon} {actionCfg.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
                    style={{ background: `${entityColor}22`, color: entityColor }}>
                    {ENTITY_LABELS[log.entity_type] || log.entity_type}
                  </span>
                </div>

                {/* Center: details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{log.entity_title || '—'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {log.field_changed && (
                      <span className="text-xs" style={{ color: muted }}>
                        Campo: <strong className="text-white">{log.field_changed}</strong>
                      </span>
                    )}
                    {log.old_value && (
                      <span className="text-xs" style={{ color: muted }}>
                        Antes: <span className="text-red-300">{log.old_value.slice(0, 60)}</span>
                      </span>
                    )}
                    {log.new_value && (
                      <span className="text-xs" style={{ color: muted }}>
                        Después: <span className="text-green-300">{log.new_value.slice(0, 60)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: user + date + actions */}
                <div className="text-right shrink-0 flex flex-col items-end gap-1 w-full sm:w-auto">
                  <p className="text-xs font-medium text-white">{log.by_user_name || '—'}</p>
                  <p className="text-[10px]" style={{ color: muted }}>
                    {new Date(log.created_date).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                  <div className="flex gap-1">
                    {log.snapshot && (
                      <button onClick={() => setSnapshotLog(log)}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded hover:opacity-80"
                        style={{ background: 'hsl(217,33%,20%)', color: muted }}>
                        <FileText className="w-2.5 h-2.5" /> Ver
                      </button>
                    )}
                    {log.snapshot && log.action !== 'create' && (
                      <button onClick={() => setRestoreLog(log)}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded hover:opacity-80"
                        style={{ background: 'hsl(217,33%,22%)', color: '#60a5fa' }}>
                        <RotateCcw className="w-2.5 h-2.5" /> Restaurar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs" style={{ color: muted }}>
          <button onClick={() => setPage(0)} disabled={page === 0}
            className="px-2 py-1.5 rounded hover:bg-white/10 disabled:opacity-30">«</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 rounded hover:bg-white/10 disabled:opacity-30">Anterior</button>
          <span className="whitespace-nowrap">Pág {page + 1}/{totalPages} · {filtered.length}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded hover:bg-white/10 disabled:opacity-30">Siguiente</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
            className="px-2 py-1.5 rounded hover:bg-white/10 disabled:opacity-30">»</button>
        </div>
      )}

      {restoreLog  && <RestoreModal  log={restoreLog}  onClose={() => setRestoreLog(null)}  onRestored={() => { setRestoreLog(null);  qc.invalidateQueries({ queryKey: ['audit-logs'] }); }} />}
      {snapshotLog && <SnapshotModal log={snapshotLog} onClose={() => setSnapshotLog(null)} />}
      </>
      )}
    </div>
  );
}
