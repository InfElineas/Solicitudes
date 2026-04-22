import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, CheckCircle2, Clock, Wrench, X, Paperclip, Loader2, MessageSquare, BookOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ChatSection from '../components/requests/ChatSection';

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

function ReportForm({ user, activos, kbArticles, onClose, onSaved }) {
  const [form, setFormState] = useState({
    tool_name: '', category: '', description: '', impact: '',
    reporter_name: user?.full_name || '', reporter_email: user?.email || '',
    department: user?.department || '',
    activo_id: '', activo_nombre: '',
  });
  const [showSuggestion, setShowSuggestion] = useState(null);

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
  const fileRef = useRef();

  const set = (k, v) => setFormState(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    const pending = files.map(f => ({ name: f.name, uploading: true, url: null }));
    setAttachments(prev => [...prev, ...pending]);
    for (const f of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setAttachments(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(x => x.name === f.name && x.uploading);
        if (idx !== -1) updated[idx] = { name: f.name, url: file_url, uploading: false };
        return updated;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (attachments.some(a => a.uploading)) return;
    setSaving(true);
    const file_urls = attachments.filter(a => a.url).map(a => a.url);

    // La RPC detecta automáticamente al técnico de guardia y asigna
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
      setSaving(false);
      return;
    }

    // Notificar al técnico si fue auto-asignado por guardia
    if (result?.auto_assigned && result?.assigned_to) {
      await base44.entities.Notification.create({
        user_id: result.assigned_to,
        type: 'assigned',
        title: '🚨 Nueva incidencia asignada por guardia',
        message: `Se te asignó la incidencia "${form.tool_name}" automáticamente por estar de guardia.`,
        is_read: false,
      });
    }

    setSaving(false);
    onSaved();
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 my-8" style={cardStyle} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Reportar Incidencia
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

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

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Herramienta afectada *</label>
              <input required value={form.tool_name} onChange={e => set('tool_name', e.target.value)}
                placeholder="Ej: Excel, SAP, Impresora HP..."
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Activo del inventario (opcional)</label>
              <select value={form.activo_id} onChange={e => {
                const a = activos.find(x => x.id === e.target.value);
                set('activo_id', e.target.value);
                set('activo_nombre', a?.nombre || '');
                if (a) set('tool_name', a.nombre);
              }} className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer" style={inputStyle}>
                <option value="">Seleccionar activo...</option>
                {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
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
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Departamento</label>
              <input value={form.department} onChange={e => set('department', e.target.value)}
                placeholder="Tu departamento"
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
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
              {attachments.map((a, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'hsl(217,33%,18%)', color: a.uploading ? 'hsl(215,20%,50%)' : '#4ade80' }}>
                  {a.uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                  {a.name}
                  {!a.uploading && (
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
              style={{ color: muted, border: '1px solid hsl(217,33%,22%)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || attachments.some(a => a.uploading)}
              className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              style={{ background: 'hsl(217,91%,40%)', color: 'white' }}>
              {saving ? 'Enviando...' : 'Reportar incidencia'}
            </button>
          </div>
        </form>
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
        {tab === 'chat' && <ChatSection entityType="incident" entityId={incident.id} user={user} />}
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

  const setF = (k, v) => setFormState(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    const updates = { ...form };
    if (form.status === 'Resuelto' && !incident.resolved_at) {
      updates.resolved_at = new Date().toISOString();
      if (incident.created_date) {
        updates.resolution_hours = parseFloat(((new Date() - new Date(incident.created_date)) / 3600000).toFixed(1));
      }
    }
    // Set assigned_to_name from techs
    const tech = techs.find(t => t.email === form.assigned_to);
    if (tech) updates.assigned_to_name = tech.full_name || tech.email;
    await base44.entities.Incident.update(incident.id, updates);
    setSaving(false);
    onSaved();
  };

  const inputStyle2 = {
    background: 'hsl(222,47%,13%)',
    border: '1px solid hsl(217,33%,22%)',
    color: 'hsl(210,40%,90%)',
    outline: 'none',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4 my-8" style={cardStyle} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Gestionar incidencia</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
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
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm hover:bg-white/10"
            style={{ color: muted, border: '1px solid hsl(217,33%,22%)' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'hsl(217,91%,40%)', color: 'white' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Incidents() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [managing, setManaging] = useState(null);
  const [chatIncident, setChatIncident] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const isAdmin = user?.role === 'admin';
  const isStaff = isAdmin || user?.role === 'support';

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-created_date', 200),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: activos = [] } = useQuery({
    queryKey: ['activos'],
    queryFn: () => base44.entities.Activo.list('-created_date', 500),
    initialData: [],
  });

  const { data: kbArticles = [] } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: () => base44.entities.KnowledgeBase.list('-created_date', 200),
    initialData: [],
  });

  const techs = users.filter(u => u.role === 'admin' || u.role === 'support');

  const myIncidents = isStaff ? incidents : incidents.filter(i => i.created_by === user?.email);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return myIncidents;
    return myIncidents.filter(i => i.status === statusFilter);
  }, [myIncidents, statusFilter]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['incidents'] });

  const handleDelete = async (inc) => {
    if (!window.confirm(`¿Eliminar la incidencia "${inc.tool_name}"? Esta acción no se puede deshacer.`)) return;
    await base44.entities.Incident.delete(inc.id);
    toast.success('Incidencia eliminada');
    refresh();
  };

  const selectStyle = { background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' };

  const pendingCount = myIncidents.filter(i => i.status === 'Pendiente').length;
  const inProgressCount = myIncidents.filter(i => i.status === 'En atención').length;
  const resolvedCount = myIncidents.filter(i => i.status === 'Resuelto').length;

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
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ background: 'hsl(217,91%,40%)', color: 'white' }}
        >
          <Plus className="w-4 h-4" /> Reportar incidencia
        </button>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Pendientes', count: pendingCount, color: '#fbbf24', icon: Clock },
          { label: 'En atención', count: inProgressCount, color: '#3b82f6', icon: Wrench },
          { label: 'Resueltas', count: resolvedCount, color: '#4ade80', icon: CheckCircle2 },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
            <Icon className="w-5 h-5 shrink-0" style={{ color }} />
            <div>
              <p className="text-2xl font-bold" style={{ color }}>{count}</p>
              <p className="text-xs" style={{ color: muted }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="all">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
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
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => setChatIncident(inc)}
                    className="px-3 py-2 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1 min-h-[36px]"
                    style={{ background: 'hsl(217,33%,18%)', color: 'hsl(215,20%,60%)' }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                  {isStaff && (
                    <button
                      onClick={() => setManaging(inc)}
                      className="px-3 py-2 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity min-h-[36px]"
                      style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' }}
                    >
                      Gestionar
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
        <ReportForm user={user} activos={activos} kbArticles={kbArticles} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refresh(); }} />
      )}
      {managing && (
        <ResolveModal incident={managing} techs={techs} onClose={() => setManaging(null)} onSaved={() => { setManaging(null); refresh(); }} />
      )}
      {chatIncident && user && (
        <IncidentDetailModal incident={chatIncident} user={user} onClose={() => setChatIncident(null)} />
      )}
    </div>
  );
}