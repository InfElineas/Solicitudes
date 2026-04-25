import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import CommentsSection from './CommentsSection';
import ChatSection from './ChatSection';
import FileAttachmentPicker from './FileAttachmentPicker';
import AttachmentsViewer from './AttachmentsViewer';
import { sendAssignedCriticalEmail } from '@/services/emailNotifications';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const selectCls = inputCls + " cursor-pointer";
const labelCls = "text-xs font-medium text-gray-300 mb-1 block";
const modalStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' };

function ModalWrapper({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center bg-black/60 sm:p-4 sm:overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full shadow-2xl ${wide
          ? 'rounded-t-2xl sm:rounded-xl sm:max-w-2xl sm:my-8 max-h-[92vh] flex flex-col'
          : 'rounded-t-2xl sm:rounded-xl sm:max-w-md sm:my-8 max-h-[92vh] flex flex-col'
        }`}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(217,33%,30%)' }} />
        </div>
        <div className="flex items-center justify-between px-4 pt-2 pb-1 sm:px-6 sm:pt-5 shrink-0">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">✕</button>
        </div>
        {subtitle && <p className="text-xs px-4 sm:px-6 pb-2 shrink-0" style={{ color: 'hsl(215,20%,55%)' }}>{subtitle}</p>}
        <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---- CREATE / EDIT REQUEST MODAL ----
export function RequestFormModal({ request, departments = [], onClose, onSaved, user }) {
  const isEdit = !!request;
  const role = user?.role || 'employee';
  const canCreateRequest = role === 'jefe' || role === 'admin';
  const [form, setForm] = useState({
    title: request?.title || '',
    description: request?.description || '',
    request_type: request?.request_type || '',
    level: request?.level || '',
    estimated_hours: request?.estimated_hours ? String(request.estimated_hours) : '',
    estimated_due: request?.estimated_due ? request.estimated_due.slice(0, 16) : '',
    priority: request?.priority || 'Media',
    department_ids: request?.department_ids || [],
    department_names: request?.department_names || [],
  });
  const [attachments, setAttachments] = useState(
    (request?.file_urls || []).map(url => ({ name: url.split('/').pop(), url, uploading: false }))
  );
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddFiles = async (pickedFiles) => {
    const newEntries = pickedFiles.map(f => ({ name: f.name, url: null, uploading: true }));
    setAttachments(prev => [...prev, ...newEntries]);
    for (const f of pickedFiles) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setAttachments(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(x => x.name === f.name && x.uploading);
        if (idx !== -1) updated[idx] = { name: f.name, url: file_url, uploading: false };
        return updated;
      });
    }
  };

  const handleAddUrl = (url) => {
    // Extract a readable name from the URL
    let name = url;
    try { name = new URL(url).hostname + '...'; } catch {}
    setAttachments(prev => [...prev, { name, url, uploading: false }]);
  };

  const toggleDept = (dept) => {
    const sel = form.department_ids.includes(dept.id);
    if (sel) {
      set('department_ids', form.department_ids.filter(id => id !== dept.id));
      set('department_names', form.department_names.filter(n => n !== dept.name));
    } else {
      set('department_ids', [...form.department_ids, dept.id]);
      set('department_names', [...form.department_names, dept.name]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !canCreateRequest) {
      toast.error('Solo jefatura de departamento o administración puede crear solicitudes.');
      return;
    }
    if (attachments.some(f => f.uploading)) return;
    setSaving(true);
    try {
      const readyUrls = attachments.filter(f => f.url).map(f => f.url);
      const payload = {
        ...form,
        level: form.level || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        estimated_due: form.estimated_due || null,
        file_urls: readyUrls,
      };
      if (isEdit) {
        await base44.entities.Request.update(request.id, payload);
        if (request.assigned_to_id) {
          await base44.entities.Notification.create({
            user_id: request.assigned_to_id,
            type: 'status_change',
            title: '✏️ Solicitud modificada',
            message: `La solicitud "${request.title}" fue editada por el solicitante.`,
            request_id: request.id,
            request_title: request.title,
            is_read: false,
          });
        }
      } else {
        await base44.entities.Request.create({
          ...payload,
          status: 'Pendiente aprobación',
          is_deleted: false,
          requester_id: user?.email,
          requester_name: user?.full_name || user?.email,
        });
      }
      onSaved();
    } catch (err) {
      console.error('[RequestFormModal] handleSubmit error:', err);
      toast.error('Error al guardar la solicitud. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  const REQUEST_TYPES = ['Desarrollo', 'Corrección de errores', 'Mejora funcional', 'Mejora visual', 'Migración', 'Automatización'];
  const PRIORITIES = ['Alta', 'Media', 'Baja'];
  const LEVELS = ['Fácil', 'Medio', 'Difícil'];

  return (
    <ModalWrapper title={isEdit ? 'Editar Solicitud' : 'Nueva Solicitud'} subtitle={isEdit ? 'Modifica los campos y guarda los cambios.' : 'Completa el formulario para crear la solicitud.'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelCls}>Título</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} required className={inputCls} style={inputStyle} placeholder="Título de la solicitud" />
        </div>
        <div>
          <label className={labelCls}>Descripción</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} required rows={3} className={inputCls + ' resize-none'} style={inputStyle} placeholder="Describe la solicitud..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tipo de solicitud</label>
            <select value={form.request_type} onChange={e => set('request_type', e.target.value)} className={selectCls} style={inputStyle}>
              <option value="">Seleccionar...</option>
              {REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Dificultad</label>
            <select value={form.level} onChange={e => set('level', e.target.value)} className={selectCls} style={inputStyle}>
              <option value="">Seleccionar</option>
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Horas estimadas</label>
            <input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ej: 4" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Prioridad</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className={selectCls} style={inputStyle}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Fecha compromiso (opcional)</label>
          <input type="datetime-local" value={form.estimated_due} onChange={e => set('estimated_due', e.target.value)} className={inputCls} style={inputStyle} />
        </div>
        {departments.length > 0 && (
          <div>
            <label className={labelCls}>Departamentos</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {departments.map(d => {
                const sel = form.department_ids.includes(d.id);
                return (
                  <button type="button" key={d.id} onClick={() => toggleDept(d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${sel ? 'text-white border-blue-500' : 'text-gray-400 border-gray-600 hover:border-gray-400'}`}
                    style={sel ? { background: 'hsl(217,91%,30%)' } : { background: 'transparent' }}>
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label className={labelCls}>Archivos adjuntos</label>
          <FileAttachmentPicker
            files={attachments}
            onAdd={handleAddFiles}
            onAddUrl={handleAddUrl}
            onRemove={i => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button type="submit" disabled={saving || attachments.some(f => f.uploading)} className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60" style={{ background: 'hsl(217,91%,50%)' }}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Solicitud'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ---- CLASSIFY MODAL ----
export function ClassifyModal({ request, onClose, onSaved, user }) {
  const [level, setLevel] = useState(request?.level || '');
  const [priority, setPriority] = useState(request?.priority || 'Alta');
  const [saving, setSaving] = useState(false);
  const isReclassify = !!(request?.level || request?.priority);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Request.update(request.id, { level, priority });
      await base44.entities.RequestHistory.create({
        request_id: request.id,
        from_status: request.status,
        to_status: request.status,
        note: `${isReclassify ? 'Reclasificado' : 'Clasificado'}: Dificultad=${level}, Prioridad=${priority}`,
        by_user_id: user?.email,
        by_user_name: user?.full_name || user?.email,
      });
      if (request.assigned_to_id) {
        await base44.entities.Notification.create({
          user_id: request.assigned_to_id,
          type: 'status_change',
          title: '🏷️ Solicitud reclasificada',
          message: `La solicitud "${request.title}" fue ${isReclassify ? 'reclasificada' : 'clasificada'}. Dificultad: ${level}, Prioridad: ${priority}.`,
          request_id: request.id,
          request_title: request.title,
          is_read: false,
        });
      }
      onSaved();
    } catch (err) {
      console.error('[ClassifyModal] handleSave error:', err);
      toast.error('Error al clasificar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={isReclassify ? 'Reclasificar solicitud' : 'Clasificar solicitud'} subtitle="Define la dificultad y la prioridad" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className={labelCls}>Dificultad</label>
          <select value={level} onChange={e => setLevel(e.target.value)} className={selectCls} style={inputStyle}>
            <option value="">Seleccionar</option>
            <option value="Fácil">Fácil</option>
            <option value="Medio">Medio</option>
            <option value="Difícil">Difícil</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Prioridad</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className={selectCls} style={inputStyle}>
            <option>Alta</option>
            <option>Media</option>
            <option>Baja</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-white font-medium" style={{ background: 'hsl(217,91%,50%)' }}>
          {saving ? '...' : (isReclassify ? 'Reclasificar' : 'Clasificar')}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ---- ASSIGN MODAL ----
export function AssignModal({ request, users = [], onClose, onSaved }) {
  const [techId, setTechId] = useState(request?.assigned_to_id || '');
  const [hours, setHours] = useState(request?.estimated_hours ? String(request.estimated_hours) : '');
  const [due, setDue] = useState(request?.estimated_due ? request.estimated_due.slice(0, 16) : '');
  const [saving, setSaving] = useState(false);
  const isReassign = !!request?.assigned_to_id;
  const techs = users.filter(u => u.role === 'admin' || u.role === 'support');

  const handleAssign = async () => {
    setSaving(true);
    try {
      const tech = techs.find(u => u.email === techId);
      const updatedRequest = {
        ...request,
        assigned_to_id: techId || null,
        assigned_to_name: tech?.display_name || tech?.full_name || techId || null,
        estimated_hours: hours ? Number(hours) : null,
        estimated_due: due || null,
      };
      const updatePayload = {
        assigned_to_id: techId || null,
        assigned_to_name: tech?.display_name || tech?.full_name || techId || null,
        estimated_hours: hours ? Number(hours) : null,
        estimated_due: due || null,
      };
      if (isReassign && techId && request.assigned_to_id !== techId) {
        updatePayload.status = 'Pendiente';
      }
      await base44.entities.Request.update(request.id, updatePayload);
      if (isReassign && techId && request.assigned_to_id !== techId) {
        await base44.entities.RequestHistory.create({
          request_id: request.id,
          from_status: request.status,
          to_status: 'Pendiente',
          note: `Reasignada a ${tech?.full_name || techId}`,
          by_user_id: request.assigned_to_id || '',
          by_user_name: '',
        });
      }
      if (techId) {
        await base44.entities.Notification.create({
          user_id: techId,
          type: 'assigned',
          title: isReassign ? '🔄 Solicitud reasignada a ti' : '📋 Se te asignó una solicitud',
          message: isReassign
            ? `La solicitud "${request.title}" ha sido reasignada a ti.`
            : `La solicitud "${request.title}" ha sido asignada a ti.`,
          request_id: request.id,
          request_title: request.title,
          is_read: false,
        });
        await sendAssignedCriticalEmail(updatedRequest, techId, tech?.full_name || techId);
      }
      if (isReassign && request.assigned_to_id && request.assigned_to_id !== techId) {
        await base44.entities.Notification.create({
          user_id: request.assigned_to_id,
          type: 'status_change',
          title: '🔄 Solicitud reasignada',
          message: `La solicitud "${request.title}" fue reasignada a otro técnico.`,
          request_id: request.id,
          request_title: request.title,
          is_read: false,
        });
      }
      toast.success(isReassign ? 'Solicitud reasignada' : 'Solicitud asignada');
      onSaved();
    } catch (err) {
      console.error('[AssignModal] handleAssign error:', err);
      toast.error('Error al asignar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={isReassign ? 'Reasignar responsable' : 'Asignar responsable'} subtitle="Solo puedes asignar a técnicos disponibles" onClose={onClose}>
      <div className="space-y-3 mb-4">
        <div>
          <label className={labelCls}>Técnico</label>
          <select value={techId} onChange={e => setTechId(e.target.value)} className={selectCls} style={inputStyle}>
            <option value="">Seleccionar...</option>
            {techs.map(u => <option key={u.email} value={u.email}>{u.full_name || u.email}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Horas estimadas</label>
            <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="Ej: 4" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Fecha compromiso (opcional)</label>
            <input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
        <button onClick={handleAssign} disabled={saving || !techId} className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50" style={{ background: 'hsl(217,91%,50%)' }}>
          {saving ? '...' : (isReassign ? 'Reasignar' : 'Asignar')}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ---- REJECT MODAL ----
export function RejectModal({ request, onClose, onSaved, user }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await base44.entities.Request.update(request.id, {
        status: 'Rechazada',
        rejection_reason: reason,
      });
      await base44.entities.RequestHistory.create({
        request_id: request.id,
        from_status: request.status,
        to_status: 'Rechazada',
        note: reason,
        by_user_id: user?.email,
        by_user_name: user?.full_name || user?.email,
      });
      if (request.requester_id) {
        await base44.entities.Notification.create({
          user_id: request.requester_id,
          type: 'status_change',
          title: '❌ Tu solicitud fue rechazada',
          message: `La solicitud "${request.title}" fue rechazada. Motivo: ${reason}`,
          request_id: request.id,
          request_title: request.title,
          is_read: false,
        });
      }
      onSaved();
    } catch (err) {
      console.error('[RejectModal] handleReject error:', err);
      toast.error('Error al rechazar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="Rechazar solicitud" subtitle="Debes indicar un motivo para rechazar." onClose={onClose}>
      <div className="space-y-3 mb-4">
        <div>
          <label className={labelCls}>Motivo del rechazo *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required className={inputCls + ' resize-none'} style={inputStyle} placeholder="Explica por qué se rechaza..." />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
        <button onClick={handleReject} disabled={saving || !reason.trim()} className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50" style={{ background: 'hsl(0,84%,50%)' }}>
          {saving ? '...' : 'Rechazar'}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ---- DETAIL MODAL ----
export function DetailModal({ request, history = [], worklogs = [], onClose, user }) {
  const [tab, setTab] = useState('resumen');
  const normalizeStatus = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const extractLinks = (text = '') => (text.match(/https?:\/\/[^\s|)]+/g) || []);
  const evidenceHistory = history.filter(h => normalizeStatus(h?.to_status) === 'en revision');

  const tabs = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'chat', label: '💬 Chat' },
    { key: 'comentarios', label: 'Comentarios' },
    { key: 'adjuntos', label: `Adjuntos${request.file_urls?.length ? ` (${request.file_urls.length})` : ''}` },
    { key: 'evidencias', label: `Evidencias${evidenceHistory.length ? ` (${evidenceHistory.length})` : ''}` },
    { key: 'historial', label: 'Historial' },
    { key: 'worklogs', label: 'Worklogs' },
  ];

  return (
    <ModalWrapper title="Detalle de la solicitud" onClose={onClose} wide>
      {/* Title + pills */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="text-base font-semibold text-white">{request.title}</h4>
          <PriorityPill p={request.priority} />
          <StatusPill s={request.status} />
        </div>
        <p className="text-xs" style={{ color: 'hsl(215,20%,55%)' }}>
          {request.requester_name} • {request.department_names?.join(', ') || '—'} • {request.created_date ? new Date(request.created_date).toLocaleString('es') : '—'}
        </p>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto -mx-1 mb-4" style={{ borderBottom: '1px solid hsl(217,33%,22%)' }}>
        <div className="flex min-w-max px-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'resumen' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {[
            ['Tipo', request.request_type || '—'],
            ['Dificultad', request.level || '—'],
            ['Asignado a', request.assigned_to_name || '—'],
            ['Compromiso', request.estimated_due ? new Date(request.estimated_due).toLocaleDateString('es') : '—'],
            ['Estimado (h)', request.estimated_hours ?? '—'],
            ['Tiempo real (h)', request.actual_hours != null ? `${request.actual_hours}h` : request.started_at ? `En progreso` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg px-3 py-2" style={{ background: 'hsl(222,47%,17%)' }}>
              <span className="block text-xs mb-0.5" style={{ color: 'hsl(215,20%,55%)' }}>{k}</span>
              <span className="font-semibold text-white">{v}</span>
            </div>
          ))}
          {request.approved_by_name && (
            <div className="rounded-lg px-3 py-2" style={{ background: 'hsl(222,47%,17%)' }}>
              <span className="block text-xs mb-0.5" style={{ color: 'hsl(215,20%,55%)' }}>Aprobado por</span>
              <span className="font-semibold text-green-400">{request.approved_by_name}</span>
            </div>
          )}
          {request.approved_at && (
            <div className="rounded-lg px-3 py-2" style={{ background: 'hsl(222,47%,17%)' }}>
              <span className="block text-xs mb-0.5" style={{ color: 'hsl(215,20%,55%)' }}>Fecha aprobación</span>
              <span className="font-semibold text-white">{new Date(request.approved_at).toLocaleString('es')}</span>
            </div>
          )}
          <div className="sm:col-span-2 rounded-lg px-3 py-2" style={{ background: 'hsl(222,47%,17%)' }}>
            <span className="block text-xs mb-1" style={{ color: 'hsl(215,20%,55%)' }}>Descripción</span>
            <span className="text-white text-sm leading-relaxed">{request.description}</span>
          </div>
          {request.rejection_reason && (
            <div className="sm:col-span-2 rounded-lg px-3 py-2" style={{ background: 'hsl(0,40%,15%)', border: '1px solid hsl(0,60%,25%)' }}>
              <span className="block text-xs mb-1 text-red-400">Motivo de rechazo</span>
              <span className="text-red-300 text-sm">{request.rejection_reason}</span>
            </div>
          )}
          <div className="sm:col-span-2 rounded-lg px-3 py-2" style={{ background: 'hsl(222,47%,17%)' }}>
            <span className="block text-xs mb-2" style={{ color: 'hsl(215,20%,55%)' }}>Cambios de estado (resumen)</span>
            {history.length === 0 ? (
              <p className="text-xs text-gray-500">Sin historial disponible.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 5).map((h, i) => (
                  <div key={`${h.id || i}-${h.created_date || ''}`} className="text-xs">
                    <p>
                      <span className="text-gray-400">{h.from_status ? `${h.from_status} → ` : ''}</span>
                      <span className="text-white font-medium">{h.to_status || '—'}</span>
                    </p>
                    {h.note && <p className="text-gray-400 mt-0.5">{h.note}</p>}
                    <p className="text-[11px] mt-0.5" style={{ color: 'hsl(215,20%,45%)' }}>
                      {h.by_user_name || 'Sistema'} · {h.created_date ? new Date(h.created_date).toLocaleString('es') : '—'}
                    </p>
                  </div>
                ))}
                {history.length > 5 && (
                  <p className="text-[11px] text-blue-300">Ver pestaña “Historial” para el detalle completo.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">Sin historial.</p>
          ) : history.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-blue-500" />
              <div>
                <span className="text-gray-400">{h.from_status ? `${h.from_status} → ` : ''}</span>
                <span className="text-white font-medium">{h.to_status}</span>
                {h.note && <p className="text-gray-400 mt-0.5">{h.note}</p>}
                <p className="text-gray-500 mt-0.5">{h.by_user_name} · {new Date(h.created_date).toLocaleString('es')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'chat' && (
        <ChatSection entityType="request" entityId={request.id} user={user} />
      )}

      {tab === 'comentarios' && (
        <CommentsSection requestId={request.id} user={user} />
      )}

      {tab === 'adjuntos' && (
        <AttachmentsViewer urls={request.file_urls || []} />
      )}

      {tab === 'evidencias' && (
        <div className="space-y-3">
          {evidenceHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Sin evidencias registradas en cambios a revisión.</p>
          ) : evidenceHistory.map((h, i) => {
            const links = extractLinks(h.note || '');
            return (
              <div key={`${h.id || i}-${h.created_date || ''}`} className="rounded-lg p-3" style={{ background: 'hsl(222,47%,17%)', border: '1px solid hsl(217,33%,22%)' }}>
                <p className="text-xs text-white font-semibold">Evidencia #{evidenceHistory.length - i}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'hsl(215,20%,55%)' }}>
                  {h.by_user_name || 'Sistema'} · {h.created_date ? new Date(h.created_date).toLocaleString('es') : '—'}
                </p>
                {h.note && (
                  <p className="text-sm mt-2 whitespace-pre-wrap break-words" style={{ color: 'hsl(215,20%,80%)' }}>
                    {h.note}
                  </p>
                )}
                {links.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {links.map((link, idx) => (
                      <a
                        key={`${link}-${idx}`}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs break-all underline text-blue-300 hover:text-blue-200"
                      >
                        {link}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-lg p-3" style={{ background: 'hsl(222,47%,17%)', border: '1px solid hsl(217,33%,22%)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'hsl(215,20%,65%)' }}>
              Archivos de evidencia adjuntos
            </p>
            <AttachmentsViewer urls={request.file_urls || []} />
          </div>
        </div>
      )}

      {tab === 'worklogs' && (
        <div className="space-y-2">
          {worklogs.length === 0 ? (
            <p className="text-sm text-gray-500">Sin registros de tiempo.</p>
          ) : worklogs.map((w, i) => (
            <div key={i} className="flex items-center gap-3 text-xs p-2 rounded" style={{ background: 'hsl(222,47%,18%)' }}>
              <span className="font-medium text-white">{w.minutes}min</span>
              <span className="text-gray-400 flex-1">{w.note || '—'}</span>
              <span className="text-gray-500">{w.user_name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-lg text-gray-300 hover:bg-white/10 font-medium">Cerrar</button>
      </div>
    </ModalWrapper>
  );
}

// -- helpers --
function PriorityPill({ p }) {
  const cfg = { Alta: 'bg-red-500/20 text-red-400', Media: 'bg-yellow-500/20 text-yellow-400', Baja: 'bg-green-500/20 text-green-400' };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg[p] || ''}`}>{p}</span>;
}

function StatusPill({ s }) {
  const cfg = {
    'Pendiente': 'bg-yellow-500/20 text-yellow-400',
    'En progreso': 'bg-blue-500/20 text-blue-400',
    'En revisión': 'bg-purple-500/20 text-purple-400',
    'Finalizada': 'bg-green-500/20 text-green-400',
    'Rechazada': 'bg-red-500/20 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg[s] || ''}`}>{s}</span>;
}
