import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { AlertTriangle, Plus, CheckCircle2, Clock, Wrench, X, Paperclip, Loader2, MessageSquare, BookOpen, Trash2, Repeat2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ChatSection from '../components/requests/ChatSection';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };
const muted = 'hsl(215,20%,55%)';
const inputStyle = {
  background: 'hsl(222,47%,13%)',
  border: '1px solid hsl(217,33%,22%)',
  color: 'hsl(210,40%,90%)',
  outline: 'none',
};

const IMPACT_COLORS = {
  'Crítico - No puedo trabajar': '#f87171',
  'Alto - Trabajo muy afectado': '#fb923c',
  'Medio - Trabajo parcialmente afectado': '#fbbf24',
  'Bajo - Pequeña molestia': '#4ade80',
};
const STATUS_COLORS = {
  'Pendiente': '#fbbf24',
  'En atención': '#3b82f6',
  'Resuelto': '#4ade80',
  'No reproducible': '#94a3b8',
};

const CATEGORIES = ['Hardware', 'Software', 'Red / Conectividad', 'Acceso / Permisos', 'Impresora / Periférico', 'Correo / Comunicación', 'Otro'];
const IMPACTS = ['Crítico - No puedo trabajar', 'Alto - Trabajo muy afectado', 'Medio - Trabajo parcialmente afectado', 'Bajo - Pequeña molestia'];
const STATUSES = ['Pendiente', 'En atención', 'Resuelto', 'No reproducible'];

function Badge({ label, color }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: `${color}22`, color }}>
      {label}
    </span>
  );
}

function ReportForm({ user, activos, kbArticles, incidents, onClose, onSaved }) {
  const { updateUser } = useAuth();
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-active'],
    queryFn: () => base44.entities.Department.filter({ is_active: true }),
    initialData: [],
  });
  const [form, setFormState] = useState({
    tool_name: '', category: '', description: '', impact: '',
    reporter_name: user?.display_name || user?.full_name || '', reporter_email: user?.email || '',
    department: user?.department || '',
  });
  const [showSuggestion, setShowSuggestion] = useState(null);

  // Calcula reincidencias del mismo departamento en los últimos 30 días
  const deptRecurrences = useMemo(() => {
    if (!form.department || !incidents?.length) return 0;
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    return incidents.filter(i =>
      i.department === form.department &&
      new Date(i.created_date).getTime() > cutoff &&
      i.status !== 'Resuelto'
    ).length;
  }, [form.department, incidents]);

  const kbSuggestions = useMemo(() => {
    if (!form.category && !form.tool_name) return [];
    return kbArticles.filter(a =>
      a.is_published !== false && (
        (form.category && a.category === form.category) ||
        (form.tool_name && a.title?.toLowerCase().includes(form.tool_name.toLowerCase())) ||
        (form.tool_name && a.tags?.some(t => t.toLowerCase().includes(form.tool_name.toLowerCase())))
      )
    ).slice(0, 3);
  }, [form.category, form.tool_name, kbArticles]);
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [copiedConf, setCopiedConf] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setFormState(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const pending = files.map(f => ({ name: f.name, uploading: true, url: null }));
    setAttachments(prev => [...prev, ...pending]);
    for (const f of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setAttachments(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(x => x.name === f.name && x.uploading);
          if (idx !== -1) updated[idx] = { name: f.name, url: file_url, uploading: false };
          return updated;
        });
      } catch (err) {
        console.error('[Incidents] UploadFile error:', err);
        toast.error(`Error al subir "${f.name}". Verifica tu conexión e inténtalo de nuevo.`);
        setAttachments(prev => prev.filter(x => !(x.name === f.name && x.uploading)));
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (attachments.some(a => a.uploading)) return;
    setSaving(true);
    const file_urls = attachments.filter(a => a.url).map(a => a.url);

    try {
      const { data: result, error: rpcError } = await supabase.rpc('create_incident', {
        p_tool_name:      form.tool_name,
        p_category:       form.category,
        p_description:    form.description,
        p_impact:         form.impact,
        p_reporter_name:  form.reporter_name  || null,
        p_reporter_email: form.reporter_email || null,
        p_department:     form.department     || null,
        p_activo_id:      form.activo_id      || null,
        p_activo_nombre:  form.activo_nombre  || null,
        p_file_urls:      file_urls,
        p_created_by:     user?.email || null,
      });

      if (rpcError) {
        console.error('[Incidents] create_incident rpc error:', rpcError.message);
        toast.error('No se pudo registrar la incidencia. Inténtalo de nuevo.');
        setSaving(false);
        return;
      }

      // Notificar al técnico (non-critical — no debe bloquear la confirmación)
      if (result?.auto_assigned && result?.assigned_to) {
        base44.entities.Notification.create({
          user_id: result.assigned_to,
          type: 'assigned',
          title: '🚨 Nueva incidencia asignada por guardia',
          message: `Se te asignó la incidencia "${form.tool_name}" automáticamente por estar de guardia.`,
          is_read: false,
        }).catch(e => console.warn('[Incidents] notification error (non-critical):', e));
      }

      // Generar token público para seguimiento sin login
      let publicToken = null;
      let incidentId = result?.id || null;
      try {
        if (!incidentId) {
          // Fallback: buscar incidencia más reciente del usuario con el mismo tool_name
          const filterCriteria = user?.email
            ? { created_by: user.email, tool_name: form.tool_name }
            : {};
          const recent = await base44.entities.Incident.filter(
            filterCriteria,
            '-created_date',
            1,
          );
          if (recent?.length > 0) incidentId = recent[0].id;
        }
        if (incidentId) {
          publicToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
          await base44.entities.Incident.update(incidentId, { public_token: publicToken });
        }
      } catch (tokenErr) {
        console.warn('[Incidents] public_token generation failed (non-critical):', tokenErr);
      }

      // Si el usuario no tenía departamento definido, guardarlo en su perfil
      if (!user?.department && form.department && user?.id) {
        base44.entities.User.update(user.id, { department: form.department })
          .then(() => updateUser({ department: form.department }))
          .catch(e => console.warn('[Incidents] dept profile update failed:', e));
      }

      setConfirmed({ id: incidentId, publicToken, toolName: form.tool_name });
      onSaved();
    } catch (err) {
      console.error('[Incidents] handleSubmit error:', err);
      toast.error('Error de conexión. Verifica tu red e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (confirmed) {
    const trackUrl = confirmed.publicToken
      ? `${window.location.origin}/track-incident/${confirmed.publicToken}`
      : null;
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6" style={cardStyle} onClick={e => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'hsl(142,60%,18%)' }}>✅</div>
            <div>
              <p className="text-white font-semibold text-base">¡Incidencia registrada!</p>
              {confirmed.id && (
                <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,55%)' }}>
                  Ticket <span className="font-mono font-bold text-white">#{confirmed.id.slice(-8).toUpperCase()}</span>
                </p>
              )}
            </div>
            <p className="text-sm" style={{ color: 'hsl(215,20%,65%)' }}>
              Tu incidencia fue registrada exitosamente. Un técnico la revisará a la brevedad.
              {trackUrl ? ' Guarda el enlace para ver el estado en cualquier momento:' : ''}
            </p>
            {trackUrl && (
              <div className="w-full rounded-xl p-3 text-xs font-mono break-all" style={{ background: 'hsl(222,47%,18%)', color: '#60a5fa', border: '1px solid hsl(217,33%,28%)' }}>
                {trackUrl}
              </div>
            )}
            <div className="flex gap-2 w-full pt-1">
              {trackUrl && (
                <button
                  onClick={() => { navigator.clipboard.writeText(trackUrl); setCopiedConf(true); setTimeout(() => setCopiedConf(false), 2000); }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: copiedConf ? 'hsl(142,60%,20%)' : 'hsl(217,33%,22%)', color: copiedConf ? '#4ade80' : 'hsl(215,20%,80%)' }}>
                  {copiedConf ? '✓ Enlace copiado' : '🔗 Copiar enlace'}
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'hsl(217,91%,50%)' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:p-4 sm:overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col sm:my-8"
        style={{ ...cardStyle, maxHeight: '92dvh' }} onClick={e => e.stopPropagation()}>

        {/* Header fijo */}
        <div className="flex items-center justify-between shrink-0 px-5 pt-5 pb-3"
          style={{ borderBottom: '1px solid hsl(217,33%,20%)' }}>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Reportar Incidencia
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Contenido scrollable */}
        <form id="new-incident-form" onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* KB Suggestions */}
          {kbSuggestions.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'hsl(217,60%,12%)', border: '1px solid hsl(217,60%,25%)' }}>
              <p className="text-xs font-semibold text-blue-300 flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5" /> Soluciones sugeridas de la Base de Conocimientos
              </p>
              {kbSuggestions.map(a => (
                <button key={a.id} type="button" onClick={() => setShowSuggestion(a)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg mb-1 text-xs hover:opacity-80 transition-opacity"
                  style={{ background: 'hsl(217,33%,20%)', color: '#93c5fd' }}>
                  📄 {a.title}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Herramienta afectada *</label>
              <input required value={form.tool_name} onChange={e => set('tool_name', e.target.value)}
                placeholder="Ej: Excel, SAP, Impresora HP..."
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Categoría *</label>
              <select required value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer" style={inputStyle}>
                <option value="">Seleccionar...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Impacto en tu trabajo *</label>
            <select required value={form.impact} onChange={e => set('impact', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer" style={inputStyle}>
              <option value="">Seleccionar...</option>
              {IMPACTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Descripción del problema *</label>
            <textarea required value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Describe qué pasó, cuándo empezó y qué estabas haciendo..."
              className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Tu nombre</label>
              <input value={form.reporter_name} onChange={e => set('reporter_name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>
                Departamento
                {!user?.department && <span className="ml-1 text-[10px]" style={{ color: 'hsl(38,80%,55%)' }}>· Se guardará en tu perfil</span>}
              </label>
              <select
                value={form.department}
                onChange={e => set('department', e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={inputStyle}
              >
                <option value="">Seleccionar departamento...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Adjuntar evidencia (imagen, PDF, reporte)</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80 transition-opacity"
                style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' }}>
                <Paperclip className="w-3.5 h-3.5" /> Adjuntar archivo
              </button>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx,.csv" className="hidden" onChange={handleFiles} />
              {attachments.map((a) => (
                <span key={a.name} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'hsl(217,33%,18%)', color: a.uploading ? 'hsl(215,20%,50%)' : '#4ade80' }}>
                  {a.uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                  {a.name}
                  {!a.uploading && (
                    <button type="button" onClick={() => setAttachments(prev => prev.filter(x => x.name !== a.name))}
                      className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Alerta de reincidencia — Regla 6 */}
          {deptRecurrences >= 2 && (
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: 'hsl(0,60%,14%)', border: '1px solid hsl(0,60%,28%)' }}>
              <Repeat2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#f87171' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: '#fca5a5' }}>
                  Patrón de reincidencia en tu departamento
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'hsl(0,40%,60%)' }}>
                  Tu departamento tiene {deptRecurrences} incidencias activas este mes. El equipo de soporte ya fue notificado para investigar la causa raíz.
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Botones fijos al fondo */}
        <div className="shrink-0 px-5 pt-3 pb-5 flex gap-2"
          style={{ borderTop: '1px solid hsl(217,33%,20%)' }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
            style={{ color: muted, border: '1px solid hsl(217,33%,22%)' }}>
            Cancelar
          </button>
          <button type="submit" form="new-incident-form"
            disabled={saving || attachments.some(a => a.uploading)}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            style={{ background: 'hsl(217,91%,40%)', color: 'white' }}>
            {saving ? 'Enviando...' : 'Reportar incidencia'}
          </button>
        </div>
      </div>
    </div>

    {/* KB Suggestion Detail */}
    {showSuggestion && (
      <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={() => setShowSuggestion(null)}>
        <div className="w-full max-w-lg rounded-2xl p-6 my-8" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,22%)' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-400" />{showSuggestion.title}</h3>
            <button onClick={() => setShowSuggestion(null)} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="text-sm text-white/80 whitespace-pre-wrap p-3 rounded-lg mb-3" style={{ background: 'hsl(222,47%,8%)' }}>
            {showSuggestion.content}
          </div>
          <button onClick={() => setShowSuggestion(null)} className="w-full py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10">Cerrar</button>
        </div>
      </div>
    )}
    </>
  );
}

function IncidentDetailModal({ incident, user, onClose }) {
  const [tab, setTab] = useState('chat');
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 my-8" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">{incident.tool_name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="flex border-b mb-4" style={{ borderColor: 'hsl(217,33%,22%)' }}>
          <button onClick={() => setTab('chat')} className={`px-3 py-2 text-xs font-medium ${ tab === 'chat' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>💬 Chat</button>
        </div>
        {tab === 'chat' && <ChatSection
          entityType="incident"
          entityId={incident.id}
          user={user}
          participants={[
            incident.reporter_email ? { email: incident.reporter_email, name: incident.reporter_name || incident.reporter_email } : null,
            incident.assigned_to    ? { email: incident.assigned_to,    name: incident.assigned_to_name || incident.assigned_to } : null,
          ].filter(Boolean)}
        />}
      </div>
    </div>
  );
}

function ResolveModal({ incident, techs, onClose, onSaved }) {
  const [form, setFormState] = useState({
    status: incident?.status || 'Pendiente',
    assigned_to: incident?.assigned_to || '',
    assigned_to_name: incident?.assigned_to_name || '',
    resolution_notes: incident?.resolution_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileRef = useRef();

  const setF = (k, v) => setFormState(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const pending = files.map(f => ({ name: f.name, uploading: true, url: null }));
    setAttachments(prev => [...prev, ...pending]);
    for (const f of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setAttachments(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(x => x.name === f.name && x.uploading);
          if (idx !== -1) updated[idx] = { name: f.name, url: file_url, uploading: false };
          return updated;
        });
      } catch (err) {
        console.error('[ResolveModal] UploadFile error:', err);
        toast.error(`Error al subir "${f.name}"`);
        setAttachments(prev => prev.filter(x => !(x.name === f.name && x.uploading)));
      }
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    if (attachments.some(a => a.uploading)) return;
    setSaving(true);
    try {
      const updates = { ...form };
      if (form.status === 'Resuelto' && !incident.resolved_at) {
        updates.resolved_at = new Date().toISOString();
        if (incident.created_date) {
          updates.resolution_hours = parseFloat(((new Date() - new Date(incident.created_date)) / 3600000).toFixed(1));
        }
      }
      const tech = techs.find(t => t.email === form.assigned_to);
      if (tech) updates.assigned_to_name = tech.full_name || tech.email;
      const evidence_urls = attachments.filter(a => a.url).map(a => a.url);
      if (evidence_urls.length > 0) {
        const urlsText = '\n\n📎 Evidencia adjunta:\n' + evidence_urls.map((u, i) => `• Archivo ${i + 1}: ${u}`).join('\n');
        updates.resolution_notes = (updates.resolution_notes || '') + urlsText;
      }
      await base44.entities.Incident.update(incident.id, updates);

      // Notificar asignación manual al técnico
      if (form.assigned_to && form.assigned_to !== incident.assigned_to) {
        base44.entities.Notification.create({
          user_id: form.assigned_to,
          type: 'assigned',
          title: '🚨 Se te asignó una incidencia',
          message: `La incidencia "${incident.tool_name}" ha sido asignada a ti.`,
          is_read: false,
        }).catch(() => {});
      }

      // Notificar al reportero cambios de estado relevantes
      const reporterEmail = incident.reporter_email;
      if (reporterEmail && reporterEmail !== user?.email) {
        if (form.status === 'Resuelto' && incident.status !== 'Resuelto') {
          base44.entities.Notification.create({
            user_id: reporterEmail,
            type: 'resolved',
            title: '✅ Tu incidencia fue resuelta',
            message: `La incidencia "${incident.tool_name}" ha sido marcada como Resuelta.${form.resolution_notes ? ` Notas: ${form.resolution_notes.slice(0, 100)}` : ''}`,
            is_read: false,
          }).catch(() => {});
        } else if (form.status === 'En atención' && incident.status !== 'En atención') {
          base44.entities.Notification.create({
            user_id: reporterEmail,
            type: 'status_change',
            title: '🔧 Tu incidencia está siendo atendida',
            message: `La incidencia "${incident.tool_name}" ahora está en atención.`,
            is_read: false,
          }).catch(() => {});
        }
      }

      toast.success('Incidencia actualizada');
      if (form.status === 'Resuelto' && (incident.impact?.includes('Crítico') || incident.impact?.includes('Alto'))) {
        const params = new URLSearchParams({
          inc_title: incident.tool_name || '',
          inc_category: incident.category || 'Otro',
          inc_description: incident.description || '',
          inc_resolution: form.resolution_notes || '',
        });
        toast('💡 Incidencia crítica resuelta — considera documentar en KB', {
          duration: 8000,
          action: { label: '→ Crear artículo', onClick: () => { window.location.href = `/KnowledgeBase?${params.toString()}`; } },
        });
      }
      onSaved();
    } catch (err) {
      console.error('[ResolveModal] handleSave error:', err);
      toast.error('Error al guardar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  const inputStyle2 = {
    background: 'hsl(222,47%,13%)',
    border: '1px solid hsl(217,33%,22%)',
    color: 'hsl(210,40%,90%)',
    outline: 'none',
  };

  const impactColor = incident?.impact?.includes('Crítico') ? '#f87171'
    : incident?.impact?.includes('Alto') ? '#fb923c'
    : incident?.impact?.includes('Medio') ? '#fbbf24' : '#94a3b8';

  const fmtDate = (d) => d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl my-8" style={cardStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b" style={{ borderColor: 'hsl(217,33%,20%)' }}>
          <h3 className="text-sm font-bold text-white">Gestionar incidencia</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Incident detail (read-only) */}
        <div className="px-5 py-4 space-y-3 border-b" style={{ borderColor: 'hsl(217,33%,20%)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium mb-0.5" style={{ color: muted }}>Herramienta / Sistema afectado</p>
              <p className="text-sm font-semibold text-white truncate">{incident.tool_name || '—'}</p>
            </div>
            <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-full"
              style={{ background: impactColor + '22', color: impactColor, border: `1px solid ${impactColor}44` }}>
              {incident.impact || 'Sin impacto'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <p className="font-medium mb-0.5" style={{ color: muted }}>Categoría</p>
              <p className="text-white">{incident.category || '—'}</p>
            </div>
            <div>
              <p className="font-medium mb-0.5" style={{ color: muted }}>Departamento</p>
              <p className="text-white">{incident.department || '—'}</p>
            </div>
            <div>
              <p className="font-medium mb-0.5" style={{ color: muted }}>Reportado por</p>
              <p className="text-white">{incident.reporter_name || incident.reporter_email || '—'}</p>
            </div>
            <div>
              <p className="font-medium mb-0.5" style={{ color: muted }}>Fecha de apertura</p>
              <p className="text-white">{fmtDate(incident.created_date)}</p>
            </div>
          </div>
          {incident.description && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: muted }}>Descripción</p>
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{incident.description}</p>
            </div>
          )}
          {incident.activo_nombre && (
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: muted }}>Activo relacionado</p>
              <p className="text-xs text-gray-300">{incident.activo_nombre}</p>
            </div>
          )}
          {incident.file_urls?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: muted }}>Archivos adjuntos del reporte</p>
              <div className="flex flex-wrap gap-1.5">
                {incident.file_urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded hover:opacity-80"
                    style={{ background: 'hsl(217,33%,20%)', color: '#93c5fd' }}>
                    <Paperclip className="w-2.5 h-2.5" /> Adjunto {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Management form */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Estado</label>
            <select value={form.status} onChange={e => setF('status', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer" style={inputStyle2}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Asignar técnico</label>
            <select value={form.assigned_to} onChange={e => setF('assigned_to', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer" style={inputStyle2}>
              <option value="">Sin asignar</option>
              {techs.map(t => <option key={t.email} value={t.email}>{t.full_name || t.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Notas de resolución</label>
            <textarea value={form.resolution_notes} onChange={e => setF('resolution_notes', e.target.value)}
              rows={3} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle2}
              placeholder="¿Qué se hizo para resolver?" />
          </div>

          {/* Evidence attachments */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Evidencia de resolución</label>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: '#93c5fd', border: '1px solid hsl(217,33%,28%)' }}>
              <Paperclip className="w-3.5 h-3.5" /> Adjuntar archivo
            </button>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded"
                    style={{ background: 'hsl(217,33%,18%)', color: a.uploading ? muted : '#93c5fd', border: '1px solid hsl(217,33%,26%)' }}>
                    {a.uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    {!a.uploading && (
                      <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                        className="ml-0.5 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {form.status === 'Resuelto' && (incident.impact?.includes('Crítico') || incident.impact?.includes('Alto')) && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs"
              style={{ background: 'hsl(217,60%,14%)', border: '1px solid hsl(217,60%,28%)', color: '#93c5fd' }}>
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              Incidencia de alta criticidad — documenta la solución en la Base de Conocimientos para casos futuros.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm hover:bg-white/10"
            style={{ color: muted, border: '1px solid hsl(217,33%,22%)' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || attachments.some(a => a.uploading)}
            className="flex-1 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'hsl(217,91%,40%)', color: 'white', opacity: (saving || attachments.some(a => a.uploading)) ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Incidents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [managing, setManaging] = useState(null);
  const [chatIncident, setChatIncident] = useState(null);
  const [sp, setSP] = useSearchParams();
  const statusFilter   = sp.get('status') || 'all';
  const recurrentOnly  = sp.get('recurrent') === '1';
  const setStatusFilter  = (val) => setSP(p => { const n = new URLSearchParams(p); val !== 'all' ? n.set('status', val) : n.delete('status'); return n; });
  const setRecurrentOnly = (valOrFn) => setSP(p => { const n = new URLSearchParams(p); const cur = p.get('recurrent') === '1'; const next = typeof valOrFn === 'function' ? valOrFn(cur) : valOrFn; next ? n.set('recurrent', '1') : n.delete('recurrent'); return n; });
  const [dlg, setDlg] = useState({ open: false, msg: '', confirmLabel: 'Confirmar', onOk: null });
  const qc = useQueryClient();

  const isAdmin = user?.role === 'admin';
  const isAuditor = user?.role === 'auditor';
  const isStaff = isAdmin || user?.role === 'support' || isAuditor;
  const canModify = isAdmin || user?.role === 'support';

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', user?.email, isStaff],
    queryFn: () => isStaff
      ? base44.entities.Incident.filter({ is_deleted: false }, '-created_date', 200)
      : base44.entities.Incident.filter({ created_by: user?.email, is_deleted: false }, '-created_date', 200),
    enabled: !!user?.email,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.filter({ is_active: true }),
    initialData: [],
  });

  const { data: activos = [] } = useQuery({
    queryKey: ['activos'],
    queryFn: () => base44.entities.Activo.filter({ is_deleted: false }, '-created_date', 500),
    initialData: [],
  });

  const { data: kbArticles = [] } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: () => base44.entities.KnowledgeBase.filter({ is_deleted: false }, '-created_date', 200),
    initialData: [],
  });

  const techs = users.filter(u => u.role === 'support' || u.department?.toLowerCase() === 'soporte');

  const recurrentCount = incidents.filter(i => (i.recurrence_count || 0) >= 2).length;

  const filtered = useMemo(() => {
    let list = statusFilter === 'all' ? incidents : incidents.filter(i => i.status === statusFilter);
    if (recurrentOnly) list = list.filter(i => (i.recurrence_count || 0) >= 2);
    return list;
  }, [incidents, statusFilter, recurrentOnly]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['incidents'] });

  const handleDelete = (inc) => {
    setDlg({
      open: true,
      msg: `¿Mover la incidencia "${inc.tool_name}" a la papelera? Podrás recuperarla desde Papelera.`,
      confirmLabel: 'Mover a papelera',
      onOk: async () => {
        await base44.entities.Incident.update(inc.id, {
          is_deleted: true,
          deleted_by_name: user?.full_name || user?.email || '',
        });
        if (inc.reporter_email && inc.reporter_email !== user?.email) {
          base44.entities.Notification.create({
            user_id: inc.reporter_email,
            type: 'info',
            title: '🗑️ Tu incidencia fue eliminada',
            message: `La incidencia "${inc.tool_name}" fue movida a la papelera.`,
            is_read: false,
          }).catch(() => {});
        }
        toast.success('Incidencia movida a la papelera');
        refresh();
      },
    });
  };

  const selectStyle = { background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' };

  const pendingCount = incidents.filter(i => i.status === 'Pendiente').length;
  const inProgressCount = incidents.filter(i => i.status === 'En atención').length;
  const resolvedCount = incidents.filter(i => i.status === 'Resuelto').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Incidencias</h1>
          <p className="text-xs mt-0.5" style={{ color: muted }}>
            {isStaff ? 'Gestión y seguimiento de incidencias reportadas' : 'Reporta problemas con tus herramientas de trabajo'}
          </p>
        </div>
        {!isAuditor && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: 'hsl(217,91%,40%)', color: 'white' }}
          >
            <Plus className="w-4 h-4" /> Reportar incidencia
          </button>
        )}
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes',    count: pendingCount,    color: '#fbbf24', icon: Clock },
          { label: 'En atención',   count: inProgressCount, color: '#3b82f6', icon: Wrench },
          { label: 'Resueltas',     count: resolvedCount,   color: '#4ade80', icon: CheckCircle2 },
          { label: 'Reincidentes',  count: recurrentCount,  color: '#f87171', icon: Repeat2, clickable: true },
        ].map(({ label, count, color, icon: Icon, clickable }) => (
          <div key={label}
            className={`rounded-xl p-4 flex items-center gap-3 transition-all ${clickable ? 'cursor-pointer hover:opacity-80' : ''} ${clickable && recurrentOnly ? 'ring-2' : ''}`}
            style={{ ...cardStyle, ...(clickable && recurrentOnly ? { ringColor: color, borderColor: color } : {}) }}
            onClick={clickable ? () => setRecurrentOnly(v => !v) : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" style={{ color }} />
            <div>
              <p className="text-2xl font-bold" style={{ color }}>{count}</p>
              <p className="text-xs" style={{ color: muted }}>{label}</p>
              {clickable && <p className="text-[9px] mt-0.5" style={{ color: recurrentOnly ? color : 'hsl(215,20%,40%)' }}>{recurrentOnly ? 'Filtro activo' : 'Clic para filtrar'}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Banner de alerta de reincidencia masiva */}
      {recurrentCount >= 3 && isStaff && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'hsl(0,60%,15%)', border: '1px solid hsl(0,60%,28%)' }}>
          <Repeat2 className="w-5 h-5 shrink-0" style={{ color: '#f87171' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>
              Patrón de reincidencia detectado
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(0,40%,60%)' }}>
              Hay {recurrentCount} incidencias con {'>'}= 2 reportes en los últimos 30 días. Considera crear una solicitud de mejora permanente.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="all">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setRecurrentOnly(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: recurrentOnly ? 'hsl(0,60%,20%)' : 'hsl(222,47%,13%)',
            border: `1px solid ${recurrentOnly ? 'hsl(0,60%,35%)' : 'hsl(217,33%,22%)'}`,
            color: recurrentOnly ? '#fca5a5' : 'hsl(215,20%,60%)',
          }}>
          <Repeat2 className="w-3 h-3" /> Reincidentes
        </button>
        <span className="text-xs" style={{ color: muted }}>{filtered.length} incidencia(s)</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16" style={{ color: muted }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ ...cardStyle, color: muted }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay incidencias registradas</p>
          {!isStaff && <p className="text-xs mt-1">¡Usa el botón de arriba para reportar un problema!</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inc => (
            <div key={inc.id} className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-white">{inc.tool_name}</span>
                    <Badge label={inc.status} color={STATUS_COLORS[inc.status] || '#94a3b8'} />
                    {inc.impact && <Badge label={inc.impact.split(' - ')[0]} color={IMPACT_COLORS[inc.impact] || '#94a3b8'} />}
                    {inc.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsl(217,33%,20%)', color: muted }}>
                        {inc.category}
                      </span>
                    )}
                    {(inc.recurrence_count || 0) >= 2 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold animate-pulse"
                        style={{ background: 'hsl(0,60%,20%)', color: '#fca5a5', border: '1px solid hsl(0,60%,32%)' }}
                        title={`${inc.recurrence_count} incidencias similares en los últimos 30 días`}>
                        <Repeat2 className="w-2.5 h-2.5" /> Reincidente ×{inc.recurrence_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/70 line-clamp-2">{inc.description}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {inc.reporter_name && <span className="text-[10px]" style={{ color: muted }}>👤 {inc.reporter_name}</span>}
                    {inc.department && <span className="text-[10px]" style={{ color: muted }}>🏢 {inc.department}</span>}
                    {inc.assigned_to_name && <span className="text-[10px]" style={{ color: muted }}>🔧 {inc.assigned_to_name}</span>}
                    <span className="text-[10px]" style={{ color: muted }}>
                      {new Date(inc.created_date).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {inc.resolution_hours && (
                      <span className="text-[10px]" style={{ color: '#4ade80' }}>⏱ Resuelto en {inc.resolution_hours.toFixed(1)}h</span>
                    )}
                  </div>
                  {inc.resolution_notes && (
                    <p className="text-[10px] mt-1 italic" style={{ color: '#4ade80' }}>✓ {inc.resolution_notes}</p>
                  )}
                  {inc.file_urls?.length > 0 && (
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {inc.file_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded hover:opacity-80"
                          style={{ background: 'hsl(217,33%,20%)', color: '#60a5fa' }}>
                          <Paperclip className="w-2.5 h-2.5" /> Adjunto {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  {inc.public_token && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <a
                        href={`${window.location.origin}/track-incident/${inc.public_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                        style={{ background: 'hsl(217,33%,20%)', color: '#60a5fa' }}
                      >
                        🔗 Ver seguimiento
                      </a>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/track-incident/${inc.public_token}`); toast.success('Enlace copiado'); }}
                        className="text-[10px] px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                        style={{ background: 'hsl(217,33%,18%)', color: muted }}
                      >
                        Copiar enlace
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => setChatIncident(inc)}
                    className="px-3 py-2 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1 min-h-[36px]"
                    style={{ background: 'hsl(217,33%,18%)', color: 'hsl(215,20%,60%)' }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                  {canModify && (
                    <button
                      onClick={() => setManaging(inc)}
                      className="px-3 py-2 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity min-h-[36px]"
                      style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' }}
                    >
                      Gestionar
                    </button>
                  )}
                  {canModify && inc.status === 'Resuelto' && (
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          inc_title: inc.tool_name || '',
                          inc_category: inc.category || 'Otro',
                          inc_description: inc.description || '',
                          inc_resolution: inc.resolution_note || '',
                        });
                        navigate(`/KnowledgeBase?${params.toString()}`);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1 min-h-[36px]"
                      style={{ background: 'hsl(217,60%,22%)', color: '#60a5fa' }}
                      title="Crear artículo en la Base de Conocimientos"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> → KB
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(inc)}
                      className="p-2 rounded-lg hover:opacity-80 transition-opacity min-h-[36px] min-w-[36px] flex items-center justify-center"
                      style={{ background: 'hsl(0,50%,20%)', color: '#f87171' }}
                      title="Eliminar incidencia"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && user && (
        <ReportForm user={user} activos={activos} kbArticles={kbArticles} incidents={incidents} onClose={() => setShowForm(false)} onSaved={refresh} />
      )}
      {managing && (
        <ResolveModal incident={managing} techs={techs} onClose={() => setManaging(null)} onSaved={() => { setManaging(null); refresh(); }} />
      )}
      {chatIncident && user && (
        <IncidentDetailModal incident={chatIncident} user={user} onClose={() => setChatIncident(null)} />
      )}
      <ConfirmDialog
        open={dlg.open}
        message={dlg.msg}
        confirmLabel={dlg.confirmLabel}
        onConfirm={() => { const fn = dlg.onOk; setDlg({ open: false, msg: '', confirmLabel: 'Confirmar', onOk: null }); fn?.(); }}
        onCancel={() => setDlg({ open: false, msg: '', confirmLabel: 'Confirmar', onOk: null })}
      />
    </div>
  );
}