import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { List, Plus, Search, SlidersHorizontal, Kanban, Paperclip, Table } from 'lucide-react';
import EvidenceModal from '../components/requests/EvidenceModal';
import RequestsTable from '../components/requests/RequestsTable';
import AdvancedFilters from '../components/requests/AdvancedFilters';
import ExportButton from '../components/requests/ExportButton';
import { toast } from 'sonner';
import {
  RequestFormModal,
  ClassifyModal,
  AssignModal,
  RejectModal,
  DetailModal,
} from '../components/requests/RequestModals';
import KanbanBoard from '../components/requests/KanbanBoard';
import { sendFinalizadaEmail } from '@/services/emailNotifications';

// ---- APPROVAL MODAL ----
function ApprovalModal({ request, user, onClose, onSaved }) {
  const [action, setAction] = useState('approve');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const inputStyle2 = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)', color: 'white', outline: 'none' };

  const handle = async () => {
    setSaving(true);
    const isApprove = action === 'approve';
    const newStatus = isApprove ? 'Pendiente' : 'Rechazada';

    // Usar RPC para evitar problema de schema cache de PostgREST
    const { error } = await supabase.rpc('process_request_approval', {
      p_request_id:       request.id,
      p_status:           newStatus,
      p_approved_by:      user?.email || '',
      p_approved_by_name: user?.full_name || user?.email || '',
      p_approved_at:      new Date().toISOString(),
      p_approval_notes:   notes || null,
      p_rejection_reason: isApprove ? null : (notes || 'Rechazada por administración'),
    });

    if (error) {
      console.error('[ApprovalModal] rpc error:', error.message);
      setSaving(false);
      return;
    }

    await base44.entities.RequestHistory.create({
      request_id:  request.id,
      from_status: 'Pendiente aprobación',
      to_status:   newStatus,
      note:        isApprove ? `Aprobado. ${notes}` : `Rechazado. ${notes}`,
      by_user_id:  user?.email,
      by_user_name: user?.full_name || user?.email,
    });

    if (request.requester_id) {
      await base44.entities.Notification.create({
        user_id:       request.requester_id,
        type:          'status_change',
        title:         isApprove ? '✅ Tu solicitud fue aprobada' : '❌ Tu solicitud fue rechazada',
        message:       isApprove
          ? `La solicitud "${request.title}" fue aprobada y está Pendiente.`
          : `La solicitud "${request.title}" fue rechazada. Motivo: ${notes}`,
        request_id:    request.id,
        request_title: request.title,
        is_read:       false,
      });
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-1">Acción de aprobación</h3>
        <p className="text-xs mb-4" style={{ color: 'hsl(215,20%,55%)' }}>{request.title}</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setAction('approve')}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{ background: action === 'approve' ? 'hsl(142,60%,25%)' : 'hsl(217,33%,22%)', color: action === 'approve' ? '#4ade80' : 'hsl(215,20%,60%)' }}>
              ✓ Aprobar
            </button>
            <button onClick={() => setAction('reject')}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{ background: action === 'reject' ? 'hsl(0,60%,28%)' : 'hsl(217,33%,22%)', color: action === 'reject' ? '#f87171' : 'hsl(215,20%,60%)' }}>
              ✕ Rechazar
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">{action === 'approve' ? 'Notas (opcional)' : 'Motivo del rechazo *'}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle2}
              placeholder={action === 'approve' ? 'Observaciones...' : 'Explica el motivo...'} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button onClick={handle} disabled={saving || (action === 'reject' && !notes.trim())}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: action === 'approve' ? 'hsl(142,60%,30%)' : 'hsl(0,70%,40%)' }}>
            {saving ? '...' : action === 'approve' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUSES = ['Pendiente aprobación', 'Pendiente', 'En progreso', 'En revisión', 'Finalizada', 'Rechazada'];
const REQUEST_TYPES = ['Desarrollo', 'Corrección de errores', 'Mejora funcional', 'Mejora visual', 'Migración', 'Automatización'];
const LEVELS = ['Fácil', 'Medio', 'Difícil'];

const selectCls = "text-xs rounded-lg px-3 py-1.5 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 min-w-[100px]";
const selectStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' };

const PRIORITY_COLORS = {
  Alta: { bg: 'hsl(0,84%,22%)', text: '#f87171', label: 'Alta' },
  Media: { bg: 'hsl(38,80%,20%)', text: '#fbbf24', label: 'Media' },
  Baja: { bg: 'hsl(142,60%,18%)', text: '#4ade80', label: 'Baja' },
};

const STATUS_COLORS = {
  'Pendiente': { bg: 'hsl(38,80%,20%)', text: '#fbbf24' },
  'En progreso': { bg: 'hsl(217,60%,20%)', text: '#60a5fa' },
  'En revisión': { bg: 'hsl(270,60%,22%)', text: '#c084fc' },
  'Finalizada': { bg: 'hsl(142,60%,18%)', text: '#4ade80' },
  'Rechazada': { bg: 'hsl(0,60%,20%)', text: '#f87171' },
};

const normalizeStatus = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function Pill({ label, colorCfg }) {
  if (!label || !colorCfg) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: colorCfg.bg, color: colorCfg.text }}>
      {label}
    </span>
  );
}

function ActionBtn({ label, color, onClick, disabled }) {
  const colors = {
    blue: { background: 'hsl(217,91%,35%)', color: 'white' },
    red: { background: 'hsl(0,70%,35%)', color: 'white' },
    gray: { background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' },
    green: { background: 'hsl(142,60%,25%)', color: '#4ade80' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30 min-h-[36px] sm:min-h-0"
      style={colors[color] || colors.gray}
    >
      {label}
    </button>
  );
}

function RequestCard({ req, user, users, onRefresh }) {
  const [modal, setModal] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [history, setHistory] = useState([]);
  const [worklogs, setWorklogs] = useState([]);
  const qc = useQueryClient();

  const pc = PRIORITY_COLORS[req.priority] || PRIORITY_COLORS.Media;
  const sc = STATUS_COLORS[req.status] || STATUS_COLORS['Pendiente'];
  const role = user?.role || 'employee';
  const canManage = role === 'admin' || role === 'support';
  const isRequester = req.requester_id === user?.email;
  const statusKey = normalizeStatus(req.status);

  const openDetail = async () => {
    const [h, w] = await Promise.all([
      base44.entities.RequestHistory.filter({ request_id: req.id }, '-created_date'),
      base44.entities.Worklog.filter({ request_id: req.id }, '-created_date'),
    ]);
    setHistory(h);
    setWorklogs(w);
    setModal('detail');
  };

  const handleAttend = async () => {
    const newStatus = req.status === 'Pendiente' ? 'En progreso' : req.status;
    const updates = {
      assigned_to_id: user?.email,
      assigned_to_name: user?.display_name || user?.full_name || user?.email,
      status: newStatus,
    };
    if (newStatus === 'En progreso' && !req.started_at) {
      updates.started_at = new Date().toISOString();
    }
    try {
      await base44.entities.Request.update(req.id, updates);
      await base44.entities.RequestHistory.create({
        request_id: req.id,
        from_status: req.status,
        to_status: newStatus,
        note: 'Atendida por técnico',
        by_user_id: user?.email,
        by_user_name: user?.full_name || user?.email,
      });
      if (req.requester_id && req.requester_id !== user?.email) {
        await base44.entities.Notification.create({
          user_id: req.requester_id,
          type: 'status_change',
          title: '🔧 Tu solicitud está siendo atendida',
          message: `${user?.full_name || user?.email} está atendiendo tu solicitud "${req.title}".`,
          request_id: req.id,
          request_title: req.title,
          is_read: false,
        });
      }
      toast.success('Solicitud atendida');
      onRefresh();
    } catch (err) {
      console.error('[handleAttend]', err);
      toast.error('Error al actualizar. Inténtalo de nuevo.');
    }
  };

  const handleSendToReview = () => {
    if (statusKey !== 'en progreso') return;
    setShowEvidence(true);
  };

  const handleFinalizar = async () => {
    if (statusKey !== 'en revision') return;
    const completionDate = new Date().toISOString();
    const updatePayload = { status: 'Finalizada', completion_date: completionDate };
    if (req.started_at) {
      updatePayload.actual_hours = parseFloat(((new Date(completionDate) - new Date(req.started_at)) / 3600000).toFixed(2));
    }
    try {
      await base44.entities.Request.update(req.id, updatePayload);
      await base44.entities.RequestHistory.create({
        request_id: req.id,
        from_status: 'En revisión',
        to_status: 'Finalizada',
        note: 'Aprobada y finalizada',
        by_user_id: user?.email,
        by_user_name: user?.full_name || user?.email,
      });
      if (req.requester_id && req.requester_id !== user?.email) {
        await base44.entities.Notification.create({
          user_id: req.requester_id,
          type: 'status_change',
          title: '✅ Tu solicitud fue finalizada',
          message: `La solicitud "${req.title}" ha sido aprobada y marcada como Finalizada.`,
          request_id: req.id,
          request_title: req.title,
          is_read: false,
        });
      }
      if (req.assigned_to_id && req.assigned_to_id !== user?.email) {
        await base44.entities.Notification.create({
          user_id: req.assigned_to_id,
          type: 'status_change',
          title: '✅ Solicitud aprobada y finalizada',
          message: `La solicitud "${req.title}" fue aprobada por administración.`,
          request_id: req.id,
          request_title: req.title,
          is_read: false,
        });
      }
      sendFinalizadaEmail({ ...req, ...updatePayload });
      toast.success('Solicitud finalizada');
      onRefresh();
    } catch (err) {
      console.error('[handleFinalizar]', err);
      toast.error('Error al finalizar. Inténtalo de nuevo.');
    }
  };

  const handleReturnToDevelopment = async () => {
    if (statusKey !== 'en revision') return;
    const reason = window.prompt('Indica qué debe ajustarse antes de continuar:');
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('Debes indicar un motivo para devolver a desarrollo.');
      return;
    }
    try {
      await base44.entities.Request.update(req.id, { status: 'En progreso' });
      await base44.entities.RequestHistory.create({
        request_id: req.id,
        from_status: 'En revisión',
        to_status: 'En progreso',
        note: `Devuelta a desarrollo: ${reason.trim()}`,
        by_user_id: user?.email,
        by_user_name: user?.full_name || user?.email,
      });
      if (req.assigned_to_id && req.assigned_to_id !== user?.email) {
        await base44.entities.Notification.create({
          user_id: req.assigned_to_id,
          type: 'status_change',
          title: '↩️ Solicitud devuelta a desarrollo',
          message: `La solicitud "${req.title}" fue devuelta a En progreso. Motivo: ${reason.trim()}`,
          request_id: req.id,
          request_title: req.title,
          is_read: false,
        });
      }
      toast.success('Solicitud devuelta a desarrollo');
      onRefresh();
    } catch (err) {
      console.error('[handleReturnToDevelopment]', err);
      toast.error('No se pudo devolver la solicitud a desarrollo.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Mover esta solicitud a la papelera?')) return;
    try {
      await base44.entities.Request.update(req.id, { is_deleted: true });
      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + 30);
      await base44.entities.RequestTrash.create({
        original_request_id: req.id,
        snapshot: JSON.stringify(req),
        deleted_by_id: user?.email,
        deleted_by_name: user?.full_name || user?.email,
        expire_at: expireAt.toISOString(),
      });
      toast.success('Solicitud movida a la papelera');
      onRefresh();
    } catch (err) {
      console.error('[handleDelete]', err);
      toast.error('Error al eliminar. Inténtalo de nuevo.');
    }
  };

  const saved = () => { setModal(null); onRefresh(); };

  const isAssignedToMe = req.assigned_to_id === user?.email;
  const isFinalized = statusKey === 'finalizada' || statusKey === 'rechazada';
  const [showApprove, setShowApprove] = useState(false);
  const isPendingApproval = statusKey === 'pendiente aprobacion';
  const isInReview = statusKey === 'en revision';
  const isPending = statusKey === 'pendiente';
  const isInProgress = statusKey === 'en progreso';
  const canApproveRequests = role === 'admin';
  const canReturnToDevelopment = isInReview && (isRequester || role === 'admin');

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,20%)' }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Pill label={req.priority} colorCfg={pc} />
          <Pill label={req.status} colorCfg={sc} />
        </div>
        <div className="text-right text-xs shrink-0" style={{ color: 'hsl(215,20%,55%)' }}>
          {req.estimated_hours ? <span>{req.estimated_hours}h estimadas</span> : null}
          {req.estimated_due && <div>Compromiso {new Date(req.estimated_due).toLocaleDateString('es')}</div>}
          {req.assigned_to_id && <div>Asignado a <span className="text-blue-400">{
            (users.find(u => u.email === req.assigned_to_id)?.display_name) ||
            (users.find(u => u.email === req.assigned_to_id)?.full_name) ||
            req.assigned_to_name || req.assigned_to_id
          }</span></div>}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white leading-snug">{req.title}</h3>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'hsl(215,20%,55%)' }}>
        <span>{req.requester_name || req.requester_id}</span>
        {req.department_names?.map(d => <span key={d}>• {d}</span>)}
        <span>• {req.created_date ? new Date(req.created_date).toLocaleDateString('es') : ''}</span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 text-[10px] font-medium">
        {req.level && <span className="px-1.5 py-0.5 rounded" style={{ background: req.level === 'Difícil' ? 'hsl(0,40%,18%)' : req.level === 'Medio' ? 'hsl(38,40%,18%)' : 'hsl(142,40%,14%)', color: req.level === 'Difícil' ? '#f87171' : req.level === 'Medio' ? '#fbbf24' : '#4ade80' }}>{req.level}</span>}
        {req.request_type && <span className="px-1.5 py-0.5 rounded" style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>{req.request_type}</span>}
        {req.file_urls?.length > 0 && (
          <span className="px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,65%)' }}>
            <Paperclip className="w-2.5 h-2.5" />{req.file_urls.length}
          </span>
        )}
      </div>

      {/* Description */}
      {req.description && <p className="text-xs line-clamp-2" style={{ color: 'hsl(215,20%,60%)' }}>{req.description}</p>}
      {req.requester_name && <p className="text-xs" style={{ color: 'hsl(215,20%,50%)' }}>Solicitante: {req.requester_name}</p>}

      {/* Pending approval banner */}
      {isPendingApproval && (
        <div className="text-xs px-2 py-1 rounded" style={{ background: 'hsl(38,80%,15%)', color: '#fbbf24', border: '1px solid hsl(38,80%,25%)' }}>
          ⏳ Pendiente de aprobación por administración
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {canApproveRequests && isPendingApproval && <ActionBtn label="✓ Aprobar/Rechazar" color="green" onClick={() => setShowApprove(true)} />}
        {canManage && !isFinalized && !isPendingApproval && <ActionBtn label={req.level ? 'Reclasificar' : 'Clasificar'} color="gray" onClick={() => setModal('classify')} />}
        {canManage && !isFinalized && !isPendingApproval && <ActionBtn label={req.assigned_to_id ? 'Reasignar' : 'Asignar'} color="gray" onClick={() => setModal('assign')} />}
        <ActionBtn label="Ver detalles" color="gray" onClick={openDetail} />
        {(canManage || isRequester) && !isFinalized && !isPendingApproval && (
          <ActionBtn label="Editar" color="gray" onClick={() => setModal('edit')} />
        )}
        {canManage && isPending && (
          <ActionBtn label="Atender" color="blue" onClick={handleAttend} />
        )}
        {canManage && isInProgress && (
          <ActionBtn label="Enviar a revisión" color="blue" onClick={handleSendToReview} />
        )}
        {/* Only admin/superadmin can finalize — tech (support) can only send to review */}
        {(role === 'admin') && isInReview && (
          <ActionBtn label="✓ Aprobar y Finalizar" color="green" onClick={handleFinalizar} />
        )}
        {canReturnToDevelopment && (
          <ActionBtn label="↩ Devolver a desarrollo" color="gray" onClick={handleReturnToDevelopment} />
        )}
        {canManage && <ActionBtn label="Eliminar" color="red" onClick={handleDelete} />}
      </div>

      {/* Modals */}
      {modal === 'edit' && <RequestFormModal request={req} departments={[]} onClose={() => setModal(null)} onSaved={saved} user={user} />}
      {modal === 'classify' && <ClassifyModal request={req} onClose={() => setModal(null)} onSaved={saved} user={user} />}
      {modal === 'assign' && <AssignModal request={req} users={users} onClose={() => setModal(null)} onSaved={saved} />}
      {modal === 'reject' && <RejectModal request={req} onClose={() => setModal(null)} onSaved={saved} user={user} />}
      {modal === 'detail' && <DetailModal request={req} history={history} worklogs={worklogs} onClose={() => setModal(null)} user={user} />}
      {showEvidence && <EvidenceModal request={req} user={user} onClose={() => setShowEvidence(false)} onSaved={() => { setShowEvidence(false); onRefresh(); }} />}
      {showApprove && <ApprovalModal request={req} user={user} onClose={() => setShowApprove(false)} onSaved={saved} />}
    </div>
  );
}

const PAGE_SIZES = [10, 20, 30, 50];

export default function Requests() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', dept: '', request_type: '', level: '', assigned: '', requester: '', priority: '', dateFrom: '', dateTo: '' });
  const [sort, setSort] = useState('created_desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [showNew, setShowNew] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'table' | 'kanban'
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['requests-list'],
    queryFn: () => base44.entities.Request.filter({ is_deleted: false }, '-created_date', 500),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.filter({ is_active: true }),
    initialData: [],
  });
  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const role = user?.role || 'employee';
  const canCreateRequests = role === 'jefe' || role === 'admin';

  const filtered = useMemo(() => {
    let r = requests;
    if (role === 'employee') r = r.filter(x => x.requester_id === user?.email);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(x => x.title?.toLowerCase().includes(s) || x.description?.toLowerCase().includes(s));
    }
    if (filters.status) r = r.filter(x => x.status === filters.status);
    if (filters.dept) r = r.filter(x => x.department_names?.includes(filters.dept));
    if (filters.request_type) r = r.filter(x => x.request_type === filters.request_type);
    if (filters.level) r = r.filter(x => x.level === filters.level);
    if (filters.assigned) r = r.filter(x => x.assigned_to_id === filters.assigned);
    if (filters.requester) r = r.filter(x => x.requester_id === filters.requester);
    if (filters.priority) r = r.filter(x => x.priority === filters.priority);
    if (filters.dateFrom) r = r.filter(x => x.created_date && new Date(x.created_date) >= new Date(filters.dateFrom));
    if (filters.dateTo) r = r.filter(x => x.created_date && new Date(x.created_date) <= new Date(filters.dateTo + 'T23:59:59'));

    // Sort
    if (sort === 'created_desc') r = [...r].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    if (sort === 'created_asc') r = [...r].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    if (sort === 'priority') {
      const order = { Alta: 0, Media: 1, Baja: 2 };
      r = [...r].sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));
    }
    return r;
  }, [requests, search, filters, sort, role, user]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const start = filtered.length === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, filtered.length);

  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v === 'all' ? '' : v })); setPage(0); };

  const techUsers = users.filter(u => u.role === 'admin' || u.role === 'support');

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-xl font-bold text-white">Solicitudes de Automatización</h1>
          <p className="text-xs mt-0.5" style={{ color: 'hsl(217,91%,60%)' }}>
            Prioriza y da seguimiento con una vista enfocada en acciones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid hsl(217,33%,22%)' }}>
            <button
              onClick={() => setViewMode('list')}
              className="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
              style={{ background: viewMode === 'list' ? 'hsl(217,91%,35%)' : 'hsl(222,47%,14%)', color: viewMode === 'list' ? 'white' : 'hsl(215,20%,55%)' }}
              title="Vista lista"
            >
              <List className="w-3.5 h-3.5" /><span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
              style={{ background: viewMode === 'table' ? 'hsl(217,91%,35%)' : 'hsl(222,47%,14%)', color: viewMode === 'table' ? 'white' : 'hsl(215,20%,55%)' }}
              title="Vista tabla"
            >
              <Table className="w-3.5 h-3.5" /><span className="hidden sm:inline">Tabla</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
              style={{ background: viewMode === 'kanban' ? 'hsl(217,91%,35%)' : 'hsl(222,47%,14%)', color: viewMode === 'kanban' ? 'white' : 'hsl(215,20%,55%)' }}
              title="Tablero Kanban"
            >
              <Kanban className="w-3.5 h-3.5" /><span className="hidden sm:inline">Kanban</span>
            </button>
          </div>
          <ExportButton requests={filtered} />
          {canCreateRequests && (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
              style={{ background: 'hsl(217,91%,45%)' }}
            >
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nueva Solicitud</span><span className="sm:hidden">Nueva</span>
            </button>
          )}
        </div>
      </div>
      {!canCreateRequests && (
        <div
          className="mb-4 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'hsl(38,80%,14%)', border: '1px solid hsl(38,80%,25%)', color: '#fbbf24' }}
        >
          Solo jefatura de departamento o administración puede crear solicitudes. Si tienes rol empleado, utiliza el módulo de Incidencias.
        </div>
      )}

      {/* Search bar */}
      <div className="relative mt-4 mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'hsl(215,20%,45%)' }} />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Buscar por título o descripción..."
          className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' }}
        />
      </div>

      {/* Advanced filters */}
      <AdvancedFilters
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(0); }}
        departments={departments}
        users={users}
        role={role}
      />

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'hsl(215,20%,45%)' }} />
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} className={selectCls} style={{ ...selectStyle, minWidth: 200 }}>
          <option value="created_desc">Creación: más recientes</option>
          <option value="created_asc">Creación: más antiguas</option>
          <option value="priority">Prioridad: Alta primero</option>
        </select>
      </div>

      {/* Count + pagination top */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs" style={{ color: 'hsl(215,20%,55%)' }}>
        <span>Mostrando {start}–{end} de {filtered.length}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden sm:inline">Por página</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="px-2 py-1 rounded text-xs outline-none" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' }}>
            {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">Anterior</button>
          <span>Pág {page + 1}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30 text-blue-400 font-medium">Siguiente</button>
        </div>
      </div>

      {/* Kanban, Table or List view */}
      {viewMode === 'kanban' ? (
        isLoading ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : (
          <KanbanBoard requests={filtered} user={user} users={users} onRefresh={refetch} />
        )
      ) : viewMode === 'table' ? (
        isLoading ? (
          <div className="text-center py-16 text-gray-500">Cargando solicitudes...</div>
        ) : (
          <RequestsTable requests={paginated} user={user} users={users} onRefresh={refetch} />
        )
      ) : isLoading ? (
        <div className="text-center py-16 text-gray-500">Cargando solicitudes...</div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 text-gray-500 rounded-xl" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' }}>
          No hay solicitudes con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {paginated.map(req => (
            <RequestCard key={req.id} req={req} user={user} users={users} onRefresh={refetch} />
          ))}
        </div>
      )}

      {/* Bottom pagination */}
      <div className="flex items-center justify-between mt-4 text-xs" style={{ color: 'hsl(215,20%,55%)' }}>
        <span>Por página
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="ml-2 px-2 py-1 rounded outline-none" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' }}>
            {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
          </select>
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">Anterior</button>
          <span>Página {page + 1}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30 text-blue-400 font-medium">Siguiente</button>
        </div>
      </div>

      {/* New Request Modal */}
      {showNew && canCreateRequests && (
        <RequestFormModal
          departments={departments}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); refetch(); toast.success('Solicitud creada'); }}
          user={user}
        />
      )}
    </div>
  );
}
