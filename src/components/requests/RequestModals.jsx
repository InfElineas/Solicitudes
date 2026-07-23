import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';

// ── Indicador online ────────────────────────────────────────────────────────
function OnlineDot({ lastSeen }) {
  if (!lastSeen) return <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(217,33%,30%)' }} title="Sin datos de actividad" />;
  const mins = (Date.now() - new Date(lastSeen)) / 60000;
  if (mins < 15) return <span className="w-2 h-2 rounded-full inline-block bg-green-400 animate-pulse" title="Activo hace menos de 15 min" />;
  if (mins < 60) return <span className="w-2 h-2 rounded-full inline-block bg-yellow-400" title={`Activo hace ${Math.round(mins)} min`} />;
  return <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(217,33%,35%)' }} title="Inactivo" />;
}

// ── Plantillas de solicitud ─────────────────────────────────────────────────
const TEMPLATES = [
  { label: '👤 Nueva cuenta',    request_type: 'Nueva Implementación', priority: 'P3 — Media',   title: 'Crear cuenta de acceso para ',  description: 'Solicito la creación de una nueva cuenta de acceso al sistema para el usuario indicado.' },
  { label: '💻 Instalar software',request_type: 'Nueva Implementación', priority: 'P3 — Media',   title: 'Instalación de software: ',     description: 'Requiero la instalación del software en mi equipo de trabajo.' },
  { label: '🔴 Error crítico',    request_type: 'Reparación / Bug',     priority: 'P1 — Crítica', title: 'Error en sistema: ',            description: 'El sistema presenta el siguiente error que impide continuar trabajando:\n\nDescripción del error:' },
  { label: '🐢 Equipo lento',     request_type: 'Reparación / Bug',     priority: 'P2 — Alta',    title: 'Equipo con problemas de rendimiento', description: 'Mi equipo presenta lentitud severa o comportamiento anormal. Detalles:\n\nModelo de equipo:' },
  { label: '🎓 Capacitación',     request_type: 'Capacitación',         priority: 'P4 — Baja',    title: 'Solicitud de capacitación: ',  description: 'Solicito capacitación en el uso de la herramienta/proceso indicado.' },
  { label: '❓ Consulta técnica', request_type: 'Consulta o Asesoría',  priority: 'P4 — Baja',    title: 'Consulta: ',                   description: 'Requiero orientación técnica sobre el siguiente tema:\n\nConsulta específica:' },
];
import CommentsSection from './CommentsSection';
import ChatSection from './ChatSection';
import FileAttachmentPicker from './FileAttachmentPicker';
import AttachmentsViewer from './AttachmentsViewer';
import { sendAssignedEmail, sendRejectedEmail, sendRequiereInfoEmail } from '@/services/emailNotifications';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const selectCls = inputCls + " cursor-pointer";
const labelCls = "text-xs font-medium text-gray-300 mb-1 block";
const modalStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' };

function ModalWrapper({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
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
  const isTechnical = role === 'admin' || role === 'support';
  const canCreateRequest = role === 'jefe' || role === 'admin' || role === 'employee' || role === 'support';

  // Mapa urgencia → prioridad para formulario simplificado
  const URGENCY_MAP = { 'Normal': 'P3 — Media', 'Urgente': 'P2 — Alta', 'Crítico': 'P1 — Crítica' };

  const ORIGINS = [
    { value: 'WhatsApp',   icon: '💬', label: 'WhatsApp' },
    { value: 'Presencial', icon: '🏢', label: 'Presencial' },
    { value: 'Email',      icon: '📧', label: 'Email' },
    { value: 'Web',        icon: '🌐', label: 'Web / Sistema' },
  ];

  const [form, setForm] = useState({
    title: request?.title || '',
    description: request?.description || '',
    request_type: request?.request_type || '',
    origin: request?.origin || '',
    urgency: 'Normal', // solo formulario simplificado
    level: request?.level || '',
    estimated_hours: request?.estimated_hours ? String(request.estimated_hours) : '',
    estimated_due: request?.estimated_due ? request.estimated_due.slice(0, 16) : '',
    priority: request?.priority || 'P3 — Media',
    department_ids: request?.department_ids || [],
    department_names: request?.department_names || [],
  });
  const [attachments, setAttachments] = useState(
    (request?.file_urls || []).map(url => ({ name: url.split('/').pop(), url, uploading: false }))
  );
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // { id, publicToken, title }
  const [copiedConf, setCopiedConf] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddFiles = async (pickedFiles) => {
    const newEntries = pickedFiles.map(f => ({ name: f.name, url: null, uploading: true }));
    setAttachments(prev => [...prev, ...newEntries]);
    for (const f of pickedFiles) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setAttachments(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(x => x.name === f.name && x.uploading);
          if (idx !== -1) updated[idx] = { name: f.name, url: file_url, uploading: false };
          return updated;
        });
      } catch (err) {
        console.error('[RequestFormModal] UploadFile error:', err);
        toast.error(`Error al subir "${f.name}". Verifica tu conexión e inténtalo de nuevo.`);
        setAttachments(prev => prev.filter(x => !(x.name === f.name && x.uploading)));
      }
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
      toast.error('No tienes permiso para crear solicitudes.');
      return;
    }
    if (attachments.some(f => f.uploading)) return;
    setSaving(true);
    try {
      const readyUrls = attachments.filter(f => f.url).map(f => f.url);
      // En modo simplificado (employee/jefe), mapear urgency → priority
      const resolvedPriority = isTechnical ? form.priority : (URGENCY_MAP[form.urgency] || 'P3 — Media');
      const payload = {
        title: form.title,
        description: form.description,
        request_type: form.request_type,
        origin: form.origin || null,
        priority: resolvedPriority,
        department_ids: form.department_ids,
        department_names: form.department_names,
        ...(isTechnical && {
          level: form.level || null,
          estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
          estimated_due: form.estimated_due || null,
        }),
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
        onSaved();
      } else {
        const created = await base44.entities.Request.create({
          ...payload,
          status: 'Pendiente',
          is_deleted: false,
          requester_id: user?.email,
          requester_name: user?.full_name || user?.email,
        });
        // Mostrar pantalla de confirmación con token público
        setConfirmed({
          id: created?.id || '',
          publicToken: created?.public_token || '',
          title: form.title,
        });
        setSaving(false);
        onSaved(); // refresca la lista en background
        return;
      }
    } catch (err) {
      console.error('[RequestFormModal] handleSubmit error:', err);
      toast.error('Error al guardar la solicitud. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  // Protocolo Operativo v1.0
  const REQUEST_TYPES = ['Nueva Implementación', 'Reparación / Bug', 'Mantenimiento', 'Actualización', 'Consulta o Asesoría', 'Integración', 'Optimización', 'Capacitación', 'Reporte o Análisis', 'Soporte Técnico', 'Automatización'];
  const PRIORITIES = ['P1 — Crítica', 'P2 — Alta', 'P3 — Media', 'P4 — Baja'];
  const LEVELS = ['Fácil', 'Medio', 'Difícil'];

  // Consideración y prioridad sugerida por tipo (Regla 1)
  const TYPE_CONFIG = {
    'Nueva Implementación': { priority: 'P2 — Alta',    hint: 'Requiere análisis previo y estimación de tiempo' },
    'Reparación / Bug':     { priority: 'P1 — Crítica', hint: 'Prioridad según impacto operativo' },
    'Mantenimiento':        { priority: 'P4 — Baja',    hint: 'Se programará en ventana de bajo impacto' },
    'Actualización':        { priority: 'P3 — Media',   hint: 'Se validará con el solicitante antes de implementar' },
    'Consulta o Asesoría':  { priority: 'P4 — Baja',    hint: 'Se responderá en ≤ 24h' },
    'Integración':          { priority: 'P2 — Alta',    hint: 'Requiere análisis de arquitectura previo' },
    'Optimización':         { priority: 'P3 — Media',   hint: 'Se medirá el estado antes y después' },
    'Capacitación':         { priority: 'P4 — Baja',    hint: 'Se coordinará con el área solicitante' },
    'Reporte o Análisis':   { priority: 'P3 — Media',   hint: 'Se definirá el formato de entrega' },
    'Soporte Técnico':      { priority: 'P3 — Media',   hint: 'Se clasificará en subtipo al atender el contacto' },
    'Automatización':       { priority: 'P2 — Alta',    hint: 'Se documentará el flujo antes de implementar' },
  };

  const handleTypeChange = (type) => {
    set('request_type', type);
    // Priority auto-update is intentionally skipped on edit to avoid overwriting
    // a manually set priority when the technician changes the type.
    if (TYPE_CONFIG[type] && !isEdit) {
      set('priority', TYPE_CONFIG[type].priority);
    }
  };

  const typeHint = TYPE_CONFIG[form.request_type]?.hint;

  const applyTemplate = (tpl) => {
    set('title', tpl.title);
    set('description', tpl.description);
    set('request_type', tpl.request_type);
    set('priority', tpl.priority);
  };

  // Pantalla de confirmación post-creación
  if (confirmed) {
    const trackUrl = `${window.location.origin}/track/${confirmed.publicToken}`;
    const copyTrackUrl = () => {
      navigator.clipboard.writeText(trackUrl);
      setCopiedConf(true);
      setTimeout(() => setCopiedConf(false), 2000);
    };
    return (
      <ModalWrapper title="¡Solicitud creada!" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'hsl(142,60%,18%)' }}>✅</div>
          <div>
            <p className="text-white font-semibold text-base">{confirmed.title}</p>
            <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,55%)' }}>
              Ticket <span className="font-mono font-bold text-white">#{confirmed.id.slice(-8).toUpperCase()}</span>
            </p>
          </div>
          <p className="text-sm" style={{ color: 'hsl(215,20%,65%)' }}>
            Tu solicitud fue registrada y está en cola. Puedes hacer seguimiento con el enlace público:
          </p>
          {confirmed.publicToken && (
            <div className="w-full rounded-xl p-3 text-xs font-mono break-all" style={{ background: 'hsl(222,47%,18%)', color: '#60a5fa', border: '1px solid hsl(217,33%,28%)' }}>
              {trackUrl}
            </div>
          )}
          <div className="flex gap-2 w-full pt-1">
            {confirmed.publicToken && (
              <button onClick={copyTrackUrl} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: copiedConf ? 'hsl(142,60%,20%)' : 'hsl(217,33%,22%)', color: copiedConf ? '#4ade80' : 'hsl(215,20%,80%)' }}>
                {copiedConf ? '✓ Enlace copiado' : '🔗 Copiar enlace'}
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'hsl(217,91%,50%)' }}>
              Cerrar
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title={isEdit ? 'Editar Solicitud' : 'Nueva Solicitud'} subtitle={isEdit ? 'Modifica los campos y guarda los cambios.' : 'Completa el formulario para crear la solicitud.'} onClose={onClose} wide>
      {/* Plantillas rápidas — solo en modo crear */}
      {!isEdit && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(215,20%,45%)' }}>Plantillas rápidas</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:brightness-110"
                style={{ background: 'hsl(217,33%,20%)', color: 'hsl(215,20%,75%)', border: '1px solid hsl(217,33%,30%)' }}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelCls}>Título *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} required className={inputCls} style={inputStyle} placeholder="Título de la solicitud" />
        </div>
        <div>
          <label className={labelCls}>Descripción *</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} required rows={3} className={inputCls + ' resize-none'} style={inputStyle} placeholder="Describe la solicitud..." />
        </div>
        <div>
          <label className={labelCls}>Tipo de solicitud *</label>
          <select value={form.request_type} onChange={e => handleTypeChange(e.target.value)} required className={selectCls} style={inputStyle}>
            <option value="">Seleccionar...</option>
            {REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          {typeHint && (
            <p className="text-xs mt-1 px-1" style={{ color: 'hsl(38,90%,60%)' }}>
              ℹ️ {typeHint}
            </p>
          )}
        </div>

        {/* Formulario simplificado para employee/jefe */}
        {!isTechnical && (
          <div>
            <label className={labelCls}>Urgencia</label>
            <div className="flex gap-2 mt-1">
              {['Normal', 'Urgente', 'Crítico'].map(u => {
                const colors = { Normal: '#4ade80', Urgente: '#fbbf24', Crítico: '#f87171' };
                const selected = form.urgency === u;
                return (
                  <button type="button" key={u} onClick={() => set('urgency', u)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
                    style={{
                      background: selected ? `${colors[u]}20` : 'transparent',
                      borderColor: selected ? colors[u] : 'hsl(217,33%,28%)',
                      color: selected ? colors[u] : 'hsl(215,20%,55%)',
                    }}>
                    {u}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] mt-1 px-1" style={{ color: 'hsl(215,20%,45%)' }}>
              Urgencia → Prioridad: Normal = Media, Urgente = Alta, Crítico = Crítica
            </p>
          </div>
        )}

        {/* Campos técnicos solo para support/admin */}
        {isTechnical && (
          <>
            <div className="grid grid-cols-2 gap-3">
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
          </>
        )}

        {/* Origen — Regla 5 — visible en ambos modos */}
        <div>
          <label className={labelCls}>Canal de origen</label>
          <div className="flex gap-2 mt-1">
            {ORIGINS.map(o => {
              const selected = form.origin === o.value;
              return (
                <button type="button" key={o.value} onClick={() => set('origin', selected ? '' : o.value)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all flex flex-col items-center gap-0.5"
                  style={{
                    background: selected ? 'hsl(217,91%,25%)' : 'transparent',
                    borderColor: selected ? 'hsl(217,91%,50%)' : 'hsl(217,33%,28%)',
                    color: selected ? '#60a5fa' : 'hsl(215,20%,55%)',
                  }}>
                  <span>{o.icon}</span>
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {departments.length > 0 && (
          <div>
            <label className={labelCls}>Departamento</label>
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
  const [priority, setPriority] = useState(request?.priority || 'P3 — Media');
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
      toast.success(isReclassify ? 'Solicitud reclasificada' : 'Solicitud clasificada');
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
            <option>P1 — Crítica</option>
            <option>P2 — Alta</option>
            <option>P3 — Media</option>
            <option>P4 — Baja</option>
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
export function AssignModal({ request, users = [], onClose, onSaved, user }) {
  const [techId, setTechId] = useState(request?.assigned_to_id || '');
  const [hours, setHours] = useState(request?.estimated_hours ? String(request.estimated_hours) : '');
  const [due, setDue] = useState(request?.estimated_due ? request.estimated_due.slice(0, 16) : '');
  const [saving, setSaving] = useState(false);
  const isReassign = !!request?.assigned_to_id;
  const techs = users.filter(u => u.role === 'support' || u.department?.toLowerCase() === 'soporte');

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
          by_user_id: user?.email || '',
          by_user_name: user?.full_name || user?.email || '',
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
        await sendAssignedEmail(updatedRequest, techId, tech?.full_name || techId);
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
          <div className="space-y-1">
            {techs.map(u => {
              const isSelected = techId === u.email;
              const mins = u.last_seen_at ? (Date.now() - new Date(u.last_seen_at)) / 60000 : null;
              const onlineStatus = mins === null ? 'unknown' : mins < 15 ? 'online' : mins < 60 ? 'away' : 'offline';
              return (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => setTechId(u.email)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                  style={{
                    background: isSelected ? 'hsl(217,60%,22%)' : 'hsl(222,47%,16%)',
                    border: `1px solid ${isSelected ? 'hsl(217,91%,45%)' : 'hsl(217,33%,24%)'}`,
                    color: 'white',
                  }}
                >
                  <OnlineDot lastSeen={u.last_seen_at} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{u.full_name || u.display_name || u.email}</span>
                    {u.department && <span className="text-[10px] block truncate" style={{ color: 'hsl(215,20%,50%)' }}>{u.department}</span>}
                  </div>
                  <span className="text-[10px]" style={{ color: onlineStatus === 'online' ? '#4ade80' : onlineStatus === 'away' ? '#fbbf24' : 'hsl(215,20%,40%)' }}>
                    {onlineStatus === 'online' ? 'Activo' : onlineStatus === 'away' ? `${Math.round(mins)}m` : 'Sin actividad'}
                  </span>
                  {isSelected && <span className="text-blue-400 text-xs">✓</span>}
                </button>
              );
            })}
          </div>
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
      const { error: rejectError } = await supabase.rpc('record_status_change', {
        p_request_id:       request.id,
        p_to_status:        'Rechazado',
        p_note:             reason,
        p_by_user_id:       user?.email || '',
        p_by_user_name:     user?.full_name || user?.email || '',
        p_rejection_reason: reason,
      });
      if (rejectError) throw rejectError;
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
        sendRejectedEmail(request, reason).catch(e => console.warn('[RequestModals] reject email error:', e));
      }
      toast.success('Solicitud rechazada');
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
// Ciclo de vida \u2014 Regla 4
const LIFECYCLE_STEPS = [
  { key: 'Pendiente',            color: '#9ca3af', icon: '\u23f3' },
  { key: 'En Proceso',           color: '#60a5fa', icon: '\ud83d\udd27' },
  { key: 'En Validaci\u00f3n',        color: '#c084fc', icon: '\ud83d\udd0d' },
  { key: 'Finalizado',           color: '#4ade80', icon: '\u2705' },
];
const TERMINAL_STEPS = {
  'Cancelado': { color: '#6b7280', icon: '\ud83d\udeab' },
  'Rechazado': { color: '#fb7185', icon: '\u274c' },
  'Retrasado': { color: '#f87171', icon: '\u26a0\ufe0f' },
};
const ORIGIN_ICONS = { WhatsApp: '\ud83d\udcac', Presencial: '\ud83c\udfe2', Email: '\ud83d\udce7', Web: '\ud83c\udf10' };

function LifecycleBar({ status, history }) {
  const isClosed = status === 'Cancelado' || status === 'Rechazado';
  const activeIdx = LIFECYCLE_STEPS.findIndex(s => s.key === status);
  const isRetrasado = status === 'Retrasado';

  // Fechas por paso desde historial
  const dateByStatus = {};
  history.forEach(h => {
    if (!dateByStatus[h.to_status]) dateByStatus[h.to_status] = h.created_date;
  });

  if (isClosed) {
    const cfg = TERMINAL_STEPS[status];
    return (
      <div className="rounded-xl p-3 mb-3 flex items-center gap-3"
        style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}40` }}>
        <span className="text-xl">{cfg.icon}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: cfg.color }}>{status}</p>
          {dateByStatus[status] && (
            <p className="text-[10px] mt-0.5" style={{ color: 'hsl(215,20%,50%)' }}>
              {new Date(dateByStatus[status]).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'hsl(222,47%,16%)', border: '1px solid hsl(217,33%,22%)' }}>
      <p className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'hsl(215,20%,45%)' }}>Ciclo de vida</p>
      <div className="flex items-start gap-0">
        {LIFECYCLE_STEPS.map((step, i) => {
          const done    = activeIdx > i;
          const active  = activeIdx === i || (isRetrasado && step.key === 'En Proceso');
          const pending = !done && !active;
          const color   = done || active ? step.color : '#374151';
          const date    = dateByStatus[step.key];
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all"
                  style={{
                    background: done ? `${step.color}30` : active ? `${step.color}20` : '#1f2937',
                    border: `2px solid ${color}`,
                    boxShadow: active ? `0 0 8px ${step.color}60` : undefined,
                  }}>
                  {done ? '\u2713' : <span style={{ fontSize: 13 }}>{step.icon}</span>}
                </div>
                <span className="text-[9px] mt-1 text-center leading-tight px-0.5" style={{ color: done || active ? '#e5e7eb' : '#4b5563' }}>
                  {step.key}
                </span>
                {date && (done || active) && (
                  <span className="text-[8px] text-center leading-tight" style={{ color: 'hsl(215,20%,45%)' }}>
                    {new Date(date).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short' })}
                  </span>
                )}
                {isRetrasado && step.key === 'En Proceso' && (
                  <span className="text-[8px] font-bold" style={{ color: '#f87171' }}>\u26a0 Retrasado</span>
                )}
              </div>
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div className="h-0.5 flex-1 mx-0.5 mt-3.5 shrink-0 transition-all"
                  style={{ background: done ? step.color : '#1f2937' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function DetailModal({ request, history = [], worklogs = [], onClose, user }) {
  const [tab, setTab] = useState('resumen');
  const [wlHours, setWlHours] = useState('');
  const [wlDesc, setWlDesc]   = useState('');
  const [wlSaving, setWlSaving] = useState(false);
  const queryClient = useQueryClient();
  const canManage = user?.role === 'admin' || user?.role === 'support';

  const fmtDate = (d) => d ? new Date(d).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : '\u2014';
  const fmtDateOnly = (d) => d ? new Date(d).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
  }) : '\u2014';

  const handleAddWorklog = async (e) => {
    e.preventDefault();
    if (!wlHours || !wlDesc.trim()) return;
    setWlSaving(true);
    try {
      await base44.entities.RequestWorkLog.create({
        request_id: request.id,
        user_id: user?.email,
        user_name: user?.full_name || user?.display_name || user?.email,
        hours: parseFloat(wlHours),
        description: wlDesc.trim(),
        logged_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['worklogs', request.id] });
      toast.success('Tiempo registrado');
      setWlHours('');
      setWlDesc('');
    } catch (err) {
      console.error('[DetailModal] worklog error:', err);
      toast.error('Error al registrar tiempo.');
    } finally {
      setWlSaving(false);
    }
  };

  const normalizeStatus = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const extractLinks = (text = '') => (text.match(/https?:\/\/[^\s|)]+/g) || []);
  const evidenceHistory = history.filter(h => normalizeStatus(h?.to_status) === 'en validacion');

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
          {request.requester_name} • {request.department_names?.join(', ') || '—'} • {fmtDate(request.created_date)}
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
        <div>
        <LifecycleBar status={request.status} history={history} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {[
            ['Tipo', request.request_type || '—'],
            ['Origen', request.origin ? `${ORIGIN_ICONS[request.origin] || ''} ${request.origin}` : '—'],
            ['Dificultad', request.level || '—'],
            ['Asignado a', request.assigned_to_name || '—'],
            ['Compromiso', fmtDateOnly(request.estimated_due)],
            ['Estimado (h)', request.estimated_hours != null ? request.estimated_hours + 'h' : '—'],
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
              <span className="font-semibold text-white">{fmtDate(request.approved_at)}</span>
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
                      {h.by_user_name || 'Sistema'} · {fmtDate(h.created_date)}
                    </p>
                  </div>
                ))}
                {history.length > 5 && (
                  <p className="text-[11px] text-blue-300">{"Ver pestaña \"Historial\" para el detalle completo."}</p>
                )}
              </div>
            )}
          </div>
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
                <p className="text-gray-500 mt-0.5">{h.by_user_name} · {fmtDate(h.created_date)}</p>
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

// ---- BLOCKED MODAL ----
const BLOCKED_CFG = {
  'En Espera':            { color: '#fbbf24', bg: 'hsl(38,80%,28%)',  icon: '⏸',  placeholder: 'Ej: Esperando respuesta del proveedor, pendiente de aprobación de área...' },
  'Requiere Información': { color: '#fb923c', bg: 'hsl(25,80%,28%)',  icon: '⚠️', placeholder: 'Ej: El solicitante necesita especificar los equipos afectados, credenciales, etc.' },
  'Retrasado':            { color: '#f87171', bg: 'hsl(0,60%,32%)',   icon: '🕐', placeholder: 'Ej: Bloqueado por dependencia externa, recurso no disponible, revisión de terceros...' },
};

export function BlockedModal({ request, targetStatus, user, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const cfg = BLOCKED_CFG[targetStatus] || BLOCKED_CFG['En Espera'];

  const handleSave = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const { error: blockedError } = await supabase.rpc('record_status_change', {
        p_request_id:   request.id,
        p_to_status:    targetStatus,
        p_note:         reason.trim(),
        p_by_user_id:   user?.email || '',
        p_by_user_name: user?.full_name || user?.email || '',
      });
      if (blockedError) throw blockedError;
      if (request.requester_id && request.requester_id !== user?.email) {
        const notifTitle = {
          'En Espera': '⏸ Tu solicitud está en espera',
          'Requiere Información': '⚠️ Tu solicitud requiere información',
          'Retrasado': '🕐 Tu solicitud se marcó como retrasada',
        }[targetStatus] || `Estado: ${targetStatus}`;
        await base44.entities.Notification.create({
          user_id: request.requester_id,
          type: 'status_change',
          title: notifTitle,
          message: `La solicitud "${request.title}" cambió a "${targetStatus}". Motivo: ${reason}`,
          request_id: request.id,
          request_title: request.title,
          is_read: false,
        });
      }
      if (targetStatus === 'Requiere Información') {
        sendRequiereInfoEmail({ ...request, status: 'Requiere Información' }).catch(() => {});
      }
      toast.success(`Solicitud marcada como "${targetStatus}"`);
      onSaved();
    } catch (err) {
      console.error('[BlockedModal] handleSave error:', err);
      toast.error('Error al cambiar estado. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={`${cfg.icon} Registrar causa — ${targetStatus}`} subtitle="El motivo queda registrado en el historial de la solicitud" onClose={onClose}>
      <div className="space-y-3 mb-4">
        <div className="rounded-lg p-3" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}35` }}>
          <p className="text-xs font-semibold text-white">{request.title}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'hsl(215,20%,55%)' }}>
            {request.status} → <span style={{ color: cfg.color }}>{targetStatus}</span>
          </p>
        </div>
        <div>
          <label className={labelCls}>Motivo del estancamiento *</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            required
            className={inputCls + ' resize-none'}
            style={inputStyle}
            placeholder={cfg.placeholder}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
        <button
          onClick={handleSave}
          disabled={saving || !reason.trim()}
          className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
          style={{ background: cfg.bg }}
        >
          {saving ? '...' : 'Confirmar'}
        </button>
      </div>
    </ModalWrapper>
  );
}

// -- helpers --
function PriorityPill({ p }) {
  const cfg = {
    'P1 — Crítica': 'bg-rose-900/30 text-rose-300',
    'P2 — Alta':    'bg-orange-500/20 text-orange-400',
    'P3 — Media':   'bg-yellow-500/20 text-yellow-400',
    'P4 — Baja':    'bg-green-500/20 text-green-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg[p] || 'bg-gray-500/20 text-gray-400'}`}>{p}</span>;
}

function StatusPill({ s }) {
  const cfg = {
    'Pendiente':            'bg-gray-500/20 text-gray-400',
    'En Proceso':           'bg-blue-500/20 text-blue-400',
    'En Espera':            'bg-amber-500/20 text-amber-400',
    'Requiere Información': 'bg-orange-500/20 text-orange-400',
    'En Validación':        'bg-purple-500/20 text-purple-400',
    'Finalizado':           'bg-green-500/20 text-green-400',
    'Retrasado':            'bg-red-500/20 text-red-400',
    'Cancelado':            'bg-gray-700/20 text-gray-500',
    'Rechazado':            'bg-rose-900/20 text-rose-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg[s] || ''}`}>{s}</span>;
}
