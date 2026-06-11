import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Clock, X, AlertTriangle, RefreshCw, Ban, Edit3, Calendar, User, Trash2, ArrowUpDown, BarChart2 } from 'lucide-react';
import MonthlyPlanner from '../components/guards/MonthlyPlanner';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { toast } from 'sonner';

const inputStyle  = { background: 'hsl(222,47%,16%)', border: '1px solid hsl(217,33%,26%)', color: 'white', outline: 'none' };
const cardStyle   = { background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' };
const modalStyle  = { background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)' };
const labelCls    = 'text-xs font-medium text-gray-400 mb-1 block';
const inputCls    = 'w-full px-3 py-2 rounded-lg text-sm outline-none';
const muted       = 'hsl(215,20%,55%)';

const ESTADO_COLORS = {
  programada: { bg: 'hsl(217,60%,18%)', text: '#60a5fa',  label: 'Programada' },
  activa:     { bg: 'hsl(142,60%,16%)', text: '#4ade80',  label: 'Activa' },
  finalizada: { bg: 'hsl(217,33%,18%)', text: '#94a3b8',  label: 'Finalizada' },
  cancelada:  { bg: 'hsl(0,50%,18%)',   text: '#f87171',  label: 'Cancelada' },
  reemplazada:{ bg: 'hsl(38,60%,18%)',  text: '#fbbf24',  label: 'Reemplazada' },
};

/**
 * Una guardia está "en turno" si su horario cubre el momento actual,
 * independientemente de si su estado es 'activa' o 'programada'.
 * No se requiere activación manual.
 */
function isOnDutyNow(g) {
  if (g.estado === 'cancelada' || g.estado === 'finalizada' || g.estado === 'reemplazada') return false;
  const now = new Date();
  return new Date(g.inicio) <= now && new Date(g.fin) >= now;
}

function getActiveGuardia(guardias) {
  return guardias.find(isOnDutyNow) || null;
}

// ── GuardiaForm ───────────────────────────────────────────────
function GuardiaForm({ guardia, techs, user, guardias, onClose, onSaved }) {
  const isEdit = !!guardia;
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    tecnico_id:    guardia?.tecnico_id    || '',
    inicio:        guardia?.inicio?.slice(0, 16) || localNow,
    fin:           guardia?.fin?.slice(0, 16)    || '',
    tipo:          guardia?.tipo          || 'normal',
    observaciones: guardia?.observaciones || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedTech = techs.find(t => t.email === form.tecnico_id);

  // Atajos rápidos para fin de turno
  const setShift = (hours) => {
    if (!form.inicio) return;
    const fin = new Date(new Date(form.inicio).getTime() + hours * 3600000);
    set('fin', new Date(fin.getTime() - fin.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    if (!form.tecnico_id || !form.inicio || !form.fin) {
      toast.error('Completa técnico, inicio y fin');
      return;
    }
    const inicio = new Date(form.inicio);
    const fin = new Date(form.fin);
    if (isNaN(inicio) || isNaN(fin)) {
      toast.error('Las fechas de inicio y fin no son válidas');
      return;
    }
    if (fin <= inicio) {
      toast.error('La fecha de fin debe ser posterior al inicio');
      return;
    }
    if (!isEdit) {
      const overlapping = guardias.filter(g =>
        g.tecnico_id === form.tecnico_id &&
        g.estado !== 'cancelada' && g.estado !== 'finalizada' && g.estado !== 'reemplazada' &&
        new Date(g.inicio) < fin && new Date(g.fin) > inicio
      );
      if (overlapping.length > 0) {
        toast.error('El técnico ya tiene una guardia en ese horario');
        return;
      }
    }
    setSaving(true);
    const payload = {
      tecnico_id:     form.tecnico_id,
      tecnico_nombre: selectedTech?.full_name || selectedTech?.email || form.tecnico_id,
      inicio:         new Date(form.inicio).toISOString(),
      fin:            new Date(form.fin).toISOString(),
      tipo:           form.tipo,
      observaciones:  form.observaciones,
      // El estado ya no se gestiona manualmente — se deduce del horario
      estado: isEdit ? (guardia.estado === 'cancelada' ? 'cancelada' : 'programada') : 'programada',
    };
    if (isEdit) {
      await base44.entities.Guardia.update(guardia.id, payload);
      await base44.entities.Notification.create({
        user_id: form.tecnico_id, type: 'status_change',
        title: '🛡️ Guardia modificada',
        message: `Tu guardia del ${new Date(form.inicio).toLocaleString('es')} al ${new Date(form.fin).toLocaleString('es')} fue modificada.`,
        is_read: false,
      });
    } else {
      await base44.entities.Guardia.create({
        ...payload,
        creada_por:        user?.email,
        creada_por_nombre: user?.full_name || user?.email,
      });
      await base44.entities.Notification.create({
        user_id: form.tecnico_id, type: 'assigned',
        title: '🛡️ Fuiste asignado a una guardia',
        message: `Tienes guardia ${form.tipo} del ${new Date(form.inicio).toLocaleString('es')} al ${new Date(form.fin).toLocaleString('es')}.`,
        is_read: false,
      });
    }
    setSaving(false);
    toast.success(isEdit ? 'Guardia actualizada' : 'Guardia creada');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">{isEdit ? 'Editar guardia' : 'Nueva guardia'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Técnico de guardia *</label>
            <select value={form.tecnico_id} onChange={e => set('tecnico_id', e.target.value)}
              className={inputCls + ' cursor-pointer'} style={inputStyle}>
              <option value="">Seleccionar técnico...</option>
              {techs.map(t => <option key={t.email} value={t.email}>{t.full_name || t.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Inicio del turno *</label>
              <input type="datetime-local" value={form.inicio} onChange={e => set('inicio', e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Fin del turno *</label>
              <input type="datetime-local" value={form.fin} onChange={e => set('fin', e.target.value)}
                className={inputCls} style={inputStyle} />
              {/* Atajos rápidos */}
              <div className="flex gap-1.5 mt-1.5">
                {[8, 12, 24].map(h => (
                  <button key={h} type="button" onClick={() => setShift(h)}
                    className="text-[10px] px-2 py-0.5 rounded hover:opacity-80"
                    style={{ background: 'hsl(217,33%,22%)', color: muted }}>
                    +{h}h
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tipo de turno</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
              className={inputCls + ' cursor-pointer'} style={inputStyle}>
              <option value="normal">Normal</option>
              <option value="urgencia">Urgencia</option>
              <option value="fin_de_semana">Fin de semana</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
              rows={2} className={inputCls + ' resize-none'} style={inputStyle}
              placeholder="Notas adicionales..." />
          </div>
          <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: 'hsl(217,60%,14%)', color: '#60a5fa' }}>
            💡 La guardia se activa automáticamente al llegar la hora de inicio. No se requiere activación manual.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: 'hsl(217,91%,45%)' }}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear guardia'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ReplaceTechModal ──────────────────────────────────────────
function ReplaceTechModal({ guardia, techs, user, onClose, onSaved }) {
  const [newTechId, setNewTechId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReplace = async () => {
    if (!newTechId) { toast.error('Selecciona un técnico'); return; }
    setSaving(true);
    const tech = techs.find(t => t.email === newTechId);
    await base44.entities.Guardia.update(guardia.id, {
      estado: 'reemplazada',
      reemplazado_por_id:     newTechId,
      reemplazado_por_nombre: tech?.full_name || tech?.email,
      observaciones: (guardia.observaciones || '') + ` [Reemplazado por ${tech?.full_name || newTechId}: ${note}]`,
    });
    await base44.entities.Guardia.create({
      tecnico_id:        newTechId,
      tecnico_nombre:    tech?.full_name || tech?.email,
      inicio:            guardia.inicio,
      fin:               guardia.fin,
      tipo:              guardia.tipo || 'normal',
      estado:            'programada',
      observaciones:     `Reemplazo de ${guardia.tecnico_nombre}. ${note}`,
      creada_por:        user?.email,
      creada_por_nombre: user?.full_name || user?.email,
    });
    await base44.entities.Notification.create({
      user_id: newTechId, type: 'assigned',
      title: '🔄 Asignado como reemplazo de guardia',
      message: `Reemplazas a ${guardia.tecnico_nombre} (${new Date(guardia.inicio).toLocaleString('es')} - ${new Date(guardia.fin).toLocaleString('es')}).`,
      is_read: false,
    });
    await base44.entities.Notification.create({
      user_id: guardia.tecnico_id, type: 'status_change',
      title: '🔄 Tu guardia fue reemplazada',
      message: `${tech?.full_name || newTechId} te reemplaza en tu guardia. ${note}`,
      is_read: false,
    });
    setSaving(false);
    toast.success('Guardia reemplazada');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-sm" style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-1">Reemplazar técnico</h3>
        <p className="text-xs mb-4" style={{ color: muted }}>Guardia de {guardia.tecnico_nombre}</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nuevo técnico *</label>
            <select value={newTechId} onChange={e => setNewTechId(e.target.value)}
              className={inputCls + ' cursor-pointer'} style={inputStyle}>
              <option value="">Seleccionar...</option>
              {techs.filter(t => t.email !== guardia.tecnico_id).map(t => (
                <option key={t.email} value={t.email}>{t.full_name || t.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Motivo</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="Ej: vacaciones, enfermedad..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button onClick={handleReplace} disabled={saving || !newTechId}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: 'hsl(38,80%,35%)' }}>
            {saving ? '...' : 'Reemplazar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function formatRange(g) {
  const ini = new Date(g.inicio).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fin = new Date(g.fin).toLocaleString('es',   { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${ini} → ${fin}`;
}
function duration(g) {
  const h = (new Date(g.fin) - new Date(g.inicio)) / 3600000;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}
function isToday(g) {
  const today = new Date();
  const ini   = new Date(g.inicio);
  return ini.getDate() === today.getDate() && ini.getMonth() === today.getMonth() && ini.getFullYear() === today.getFullYear();
}
function isFuture(g)  { return new Date(g.inicio) > new Date(); }
function isPast(g)    { return new Date(g.fin) < new Date(); }

// ── Cobertura 24/7 — Mejora D ─────────────────────────────────
// Muestra los próximos 7 días como grilla de 24h.
// Cada celda (4h) se colorea según cobertura.
const DAYS_AHEAD = 7;
const BLOCK_HOURS = 4; // granularidad de la grilla
const BLOCKS = 24 / BLOCK_HOURS; // 6 bloques por día

function CoverageHeatmap({ guardias }) {
  const now = new Date();
  // Construir días
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Para cada bloque (día × franja), calcular qué guardias lo cubren
  const getCoverage = (dayStart, blockIdx) => {
    const from = new Date(dayStart.getTime() + blockIdx * BLOCK_HOURS * 3600000);
    const to   = new Date(from.getTime() + BLOCK_HOURS * 3600000);
    return guardias.filter(g => {
      if (g.estado === 'cancelada' || g.estado === 'finalizada' || g.estado === 'reemplazada') return false;
      return new Date(g.inicio) < to && new Date(g.fin) > from;
    });
  };

  const blockLabel = (i) => {
    const h = i * BLOCK_HOURS;
    return `${String(h).padStart(2, '0')}h`;
  };

  const uncoveredGaps = days.reduce((acc, day) => {
    for (let b = 0; b < BLOCKS; b++) {
      if (getCoverage(day, b).length === 0) acc++;
    }
    return acc;
  }, 0);
  const totalBlocks = DAYS_AHEAD * BLOCKS;
  const coveragePct = Math.round(((totalBlocks - uncoveredGaps) / totalBlocks) * 100);

  return (
    <div className="rounded-xl p-4" style={{ background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-white">Cobertura 24/7 — próximos 7 días</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'hsl(215,20%,50%)' }}>
            Cada bloque = {BLOCK_HOURS}h · Verde = cubierto · Rojo = sin guardia
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: coveragePct >= 80 ? '#4ade80' : coveragePct >= 50 ? '#fbbf24' : '#f87171' }}>
            {coveragePct}%
          </p>
          <p className="text-[10px]" style={{ color: 'hsl(215,20%,50%)' }}>cobertura</p>
        </div>
      </div>

      {/* Grilla */}
      <div className="overflow-x-auto">
        <table className="w-full text-[9px]" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th className="w-14 text-left pb-1 font-medium" style={{ color: 'hsl(215,20%,50%)' }}>Día</th>
              {Array.from({ length: BLOCKS }, (_, i) => (
                <th key={i} className="text-center pb-1 font-medium" style={{ color: 'hsl(215,20%,50%)' }}>
                  {blockLabel(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, di) => {
              const isToday = di === 0;
              const dayLabel = day.toLocaleDateString('es', { weekday: 'short', day: '2-digit' });
              return (
                <tr key={di}>
                  <td className="pr-2 py-0.5 font-medium whitespace-nowrap" style={{ color: isToday ? '#60a5fa' : 'hsl(215,20%,65%)' }}>
                    {dayLabel}{isToday ? ' ●' : ''}
                  </td>
                  {Array.from({ length: BLOCKS }, (_, bi) => {
                    const covered = getCoverage(day, bi);
                    const isCurrent = (() => {
                      const from = new Date(day.getTime() + bi * BLOCK_HOURS * 3600000);
                      const to   = new Date(from.getTime() + BLOCK_HOURS * 3600000);
                      return now >= from && now < to;
                    })();
                    const bg = covered.length > 0
                      ? covered.length >= 2 ? 'hsl(142,70%,22%)' : 'hsl(142,60%,18%)'
                      : 'hsl(0,50%,16%)';
                    const border = isCurrent ? '2px solid #60a5fa' : '1px solid hsl(217,33%,14%)';
                    const title = covered.length > 0
                      ? covered.map(g => g.tecnico_nombre).join(', ')
                      : 'Sin cobertura';
                    return (
                      <td key={bi} className="py-0.5 px-0.5" title={title}>
                        <div className="h-5 rounded-sm transition-all hover:opacity-80 flex items-center justify-center"
                          style={{ background: bg, border, minWidth: 28 }}>
                          {covered.length >= 2 && (
                            <span style={{ color: '#4ade80', fontSize: 8 }}>{covered.length}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {[
          { color: 'hsl(142,60%,18%)', label: '1 técnico' },
          { color: 'hsl(142,70%,22%)', label: '2+ técnicos' },
          { color: 'hsl(0,50%,16%)',   label: 'Sin guardia' },
          { color: 'transparent', border: '2px solid #60a5fa', label: 'Ahora' },
        ].map(({ color, border, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: color, border: border || '1px solid hsl(217,33%,22%)' }} />
            <span style={{ color: 'hsl(215,20%,50%)', fontSize: 9 }}>{label}</span>
          </div>
        ))}
      </div>

      {uncoveredGaps > 0 && (
        <p className="text-[10px] mt-2 px-2 py-1 rounded" style={{ background: 'hsl(0,50%,14%)', color: '#fca5a5' }}>
          ⚠ {uncoveredGaps} bloque(s) de {BLOCK_HOURS}h sin cobertura en los próximos 7 días
        </p>
      )}
    </div>
  );
}

function SelfAssignModal({ user, guardias, onClose, onSaved }) {
  const now = new Date();
  const pad = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [inicio, setInicio] = React.useState(pad(now));
  const [fin, setFin] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const setShift = (hours) => {
    if (!inicio) return;
    const f = new Date(new Date(inicio).getTime() + hours * 3600000);
    setFin(pad(f));
  };

  const handleSave = async () => {
    if (!inicio || !fin) { toast.error('Indica inicio y fin del turno'); return; }
    const inicioDate = new Date(inicio);
    const finDate = new Date(fin);
    if (isNaN(inicioDate) || isNaN(finDate)) {
      toast.error('Las fechas de inicio y fin no son válidas');
      return;
    }
    if (finDate <= inicioDate) { toast.error('El fin debe ser posterior al inicio'); return; }
    const overlapping = guardias.filter(g =>
      g.tecnico_id === user?.email &&
      g.estado !== 'cancelada' && g.estado !== 'finalizada' && g.estado !== 'reemplazada' &&
      new Date(g.inicio) < finDate && new Date(g.fin) > inicioDate
    );
    if (overlapping.length > 0) {
      toast.error('El técnico ya tiene una guardia en ese horario');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Guardia.create({
        tecnico_id: user.email,
        tecnico_nombre: user.full_name || user.email,
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        tipo: 'voluntaria',
        estado: 'programada',
        creada_por: user.email,
        creada_por_nombre: user.full_name || user.email,
      });
      toast.success('Turno registrado correctamente');
      onSaved();
    } catch (err) {
      toast.error('Error al registrar el turno');
      console.error('[SelfAssign]', err);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-6 space-y-4" style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" /> Cubrirme para turno
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Inicio del turno</label>
            <input type="datetime-local" value={inicio} onChange={e => setInicio(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] self-center" style={{ color: muted }}>Duración rápida:</span>
            {[4, 6, 8, 12].map(h => (
              <button key={h} onClick={() => setShift(h)}
                className="text-xs px-2.5 py-1 rounded hover:opacity-80"
                style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>
                +{h}h
              </button>
            ))}
          </div>
          <div>
            <label className={labelCls}>Fin del turno</label>
            <input type="datetime-local" value={fin} onChange={e => setFin(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-lg hover:bg-white/10" style={{ color: muted }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 text-sm font-bold rounded-lg text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: 'hsl(217,91%,45%)' }}>
            {saving ? 'Guardando...' : 'Confirmar turno'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Guards() {
  const [user, setUser]               = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [editGuardia, setEditGuardia] = useState(null);
  const [replaceGuardia, setReplaceGuardia] = useState(null);
  const [showPast, setShowPast]       = useState(false);
  const [selected, setSelected]       = useState(new Set());
  const [sortDir, setSortDir]         = useState('desc');
  const [showSelfAssign, setShowSelfAssign] = useState(false);
  const [dlg, setDlg] = useState({ open: false, msg: '', confirmLabel: 'Confirmar', onOk: null });
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const role       = user?.role || 'employee';
  const canManage  = role === 'admin';
  const isSupport  = role === 'support';
  const isAuditor  = role === 'auditor';
  const isTech     = canManage || isSupport || isAuditor;

  const { data: guardias = [], isLoading } = useQuery({
    queryKey: ['guardias'],
    queryFn:  () => base44.entities.Guardia.list('-inicio', 300),
    refetchInterval: 60000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn:  () => base44.entities.User.filter({ is_active: true }),
    initialData: [],
  });

  const techs = allUsers.filter(u => u.role === 'support' || u.department?.toLowerCase() === 'soporte');

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-guards-stats'],
    queryFn:  () => base44.entities.Incident.list('-created_date', 500),
    initialData: [],
    enabled: isTech,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['guardias'] });
    setShowForm(false);
    setEditGuardia(null);
    setReplaceGuardia(null);
  };

  // Auto-finalizar guardias cuyo horario ya terminó
  useEffect(() => {
    if (!guardias.length || !canManage) return;
    const toFinalize = guardias.filter(g =>
      g.estado !== 'finalizada' && g.estado !== 'cancelada' && isPast(g)
    );
    if (!toFinalize.length) return;
    Promise.all(toFinalize.map(g =>
      base44.entities.Guardia.update(g.id, { estado: 'finalizada' })
    )).then(() => qc.invalidateQueries({ queryKey: ['guardias'] }));
  }, [guardias, canManage]);

  const activeGuardia = useMemo(() => getActiveGuardia(guardias), [guardias]);

  // Separar por categoría temporal
  const active   = useMemo(() => guardias.filter(isOnDutyNow), [guardias]);
  const upcoming = useMemo(() => guardias.filter(g =>
    isFuture(g) && g.estado !== 'cancelada' && g.estado !== 'reemplazada' && g.estado !== 'finalizada'
  ), [guardias]);
  const past     = useMemo(() => guardias.filter(g =>
    isPast(g) || g.estado === 'finalizada' || g.estado === 'cancelada' || g.estado === 'reemplazada'
  ), [guardias]);

  // Mis guardias (para técnicos de soporte)
  const myUpcoming = useMemo(() =>
    upcoming.filter(g => g.tecnico_id === user?.email),
    [upcoming, user]
  );
  const myActive = useMemo(() =>
    active.find(g => g.tecnico_id === user?.email),
    [active, user]
  );

  const uncoveredIn48h = useMemo(() => {
    if (!isTech) return 0;
    const now = new Date();
    let count = 0;
    for (let i = 0; i < 12; i++) {
      const blockStart = new Date(now.getTime() + i * 4 * 3600000);
      const blockEnd   = new Date(blockStart.getTime() + 4 * 3600000);
      const covered = [...active, ...upcoming].some(g =>
        new Date(g.inicio) < blockEnd && new Date(g.fin) > blockStart
      );
      if (!covered) count++;
    }
    return count;
  }, [active, upcoming, isTech]);

  const incidentsPerGuardia = useMemo(() => {
    if (!incidents.length) return {};
    const map = {};
    guardias.forEach(g => {
      if (!g.fin) return;
      const start = new Date(g.inicio);
      const end   = new Date(g.fin);
      map[g.id] = incidents.filter(i => {
        const d = new Date(i.created_date);
        return d >= start && d <= end && i.assigned_to === g.tecnico_id;
      });
    });
    return map;
  }, [guardias, incidents]);

  const techStats = useMemo(() => {
    const map = {};
    past.forEach(g => {
      const incs = incidentsPerGuardia[g.id] || [];
      if (!map[g.tecnico_id]) {
        map[g.tecnico_id] = { name: g.tecnico_nombre, shifts: 0, totalIncs: 0, resolvedIncs: 0, totalMinutes: 0, minuteCount: 0 };
      }
      map[g.tecnico_id].shifts++;
      map[g.tecnico_id].totalIncs += incs.length;
      map[g.tecnico_id].resolvedIncs += incs.filter(i => i.status === 'Resuelto' || i.status === 'Cerrado').length;
      incs.forEach(i => {
        if (i.resolved_date && i.created_date) {
          const mins = Math.round((new Date(i.resolved_date) - new Date(i.created_date)) / 60000);
          if (mins > 0 && mins < 1440) {
            map[g.tecnico_id].totalMinutes += mins;
            map[g.tecnico_id].minuteCount++;
          }
        }
      });
    });
    return Object.values(map)
      .map(ts => ({ ...ts, avgMinutes: ts.minuteCount > 0 ? Math.round(ts.totalMinutes / ts.minuteCount) : 0 }))
      .sort((a, b) => b.totalIncs - a.totalIncs);
  }, [past, incidentsPerGuardia]);

  const guardStatsTotal = useMemo(() => {
    const total    = techStats.reduce((s, ts) => s + ts.totalIncs, 0);
    const resolved = techStats.reduce((s, ts) => s + ts.resolvedIncs, 0);
    return {
      total,
      resolved,
      pct:         total > 0 ? Math.round(resolved / total * 100) : 0,
      avgPerShift: past.length > 0 ? (total / past.length).toFixed(1) : '0',
    };
  }, [techStats, past]);

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectSection = (ids) => setSelected(prev => {
    const next = new Set(prev);
    const allIn = ids.every(id => next.has(id));
    if (allIn) ids.forEach(id => next.delete(id));
    else ids.forEach(id => next.add(id));
    return next;
  });

  const sortFn = (arr) => [...arr].sort((a, b) => {
    const d = new Date(a.inicio) - new Date(b.inicio);
    return sortDir === 'desc' ? -d : d;
  });

  const handleBulkDelete = () => {
    const count = selected.size;
    setDlg({
      open: true,
      msg: `¿Eliminar permanentemente ${count} guardia(s) seleccionada(s)?`,
      confirmLabel: 'Eliminar',
      onOk: async () => {
        await Promise.all([...selected].map(id => base44.entities.Guardia.delete(id)));
        toast.success(`${count} guardia(s) eliminadas`);
        setSelected(new Set());
        qc.invalidateQueries({ queryKey: ['guardias'] });
      },
    });
  };

  const handleCancel = (g) => {
    setDlg({
      open: true,
      msg: '¿Cancelar esta guardia? Esta acción notificará al técnico asignado.',
      confirmLabel: 'Cancelar guardia',
      onOk: async () => {
        await base44.entities.Guardia.update(g.id, { estado: 'cancelada' });
        await base44.entities.Notification.create({
          user_id: g.tecnico_id, type: 'status_change',
          title: '🚫 Guardia cancelada',
          message: `Tu guardia del ${new Date(g.inicio).toLocaleString('es')} fue cancelada.`,
          is_read: false,
        });
        toast.success('Guardia cancelada');
        refresh();
      },
    });
  };

  const selectStyle = { background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' };

  // ── Tarjeta de guardia ──────────────────────────────────────
  function GuardiaCard({ g }) {
    const estadoCfg = ESTADO_COLORS[g.estado] || ESTADO_COLORS.programada;
    const onDuty    = isOnDutyNow(g);
    return (
      <div className="rounded-xl p-4" style={{ ...cardStyle, border: onDuty ? '1px solid hsl(142,60%,28%)' : cardStyle.border }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {canManage && (
            <input type="checkbox" checked={selected.has(g.id)}
              onChange={() => toggleSelect(g.id)}
              onClick={e => e.stopPropagation()}
              className="mt-1 cursor-pointer shrink-0"
              style={{ accentColor: '#3b82f6', width: '14px', height: '14px' }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <User className="w-3.5 h-3.5 shrink-0" style={{ color: onDuty ? '#4ade80' : muted }} />
              <span className="text-sm font-semibold text-white">{g.tecnico_nombre}</span>
              {onDuty && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse"
                  style={{ background: 'hsl(142,60%,16%)', color: '#4ade80' }}>
                  ● EN TURNO
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: estadoCfg.bg, color: estadoCfg.text }}>
                {estadoCfg.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'hsl(217,33%,20%)', color: muted }}>
                {g.tipo}
              </span>
            </div>
            <p className="text-xs text-white/80 flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" /> {formatRange(g)} · {duration(g)}
            </p>
            {g.reemplazado_por_nombre && (
              <p className="text-xs mt-0.5" style={{ color: '#fbbf24' }}>
                🔄 Reemplazado por: {g.reemplazado_por_nombre}
              </p>
            )}
            {g.observaciones && (
              <p className="text-xs mt-0.5 italic" style={{ color: muted }}>{g.observaciones}</p>
            )}
            {isTech && (incidentsPerGuardia[g.id]?.length > 0) && (
              <span className="inline-flex items-center gap-1 text-[10px] mt-1 px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(217,60%,18%)', color: '#60a5fa' }}>
                <BarChart2 className="w-2.5 h-2.5" />
                {incidentsPerGuardia[g.id].length} incidencia{incidentsPerGuardia[g.id].length !== 1 ? 's' : ''} en turno
              </span>
            )}
            <p className="text-[10px] mt-1" style={{ color: muted }}>
              Creado por {g.creada_por_nombre || g.creada_por} · {new Date(g.created_date).toLocaleDateString('es')}
            </p>
          </div>
          {canManage && g.estado !== 'cancelada' && g.estado !== 'finalizada' && g.estado !== 'reemplazada' && (
            <div className="flex gap-1.5 flex-wrap shrink-0">
              {(onDuty || isFuture(g)) && (
                <button onClick={() => setReplaceGuardia(g)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                  style={{ background: 'hsl(38,50%,18%)', color: '#fbbf24' }}>
                  <RefreshCw className="w-3 h-3" /> Reemplazar
                </button>
              )}
              <button onClick={() => setEditGuardia(g)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>
                <Edit3 className="w-3 h-3" /> Editar
              </button>
              <button onClick={() => handleCancel(g)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                style={{ background: 'hsl(0,50%,20%)', color: '#f87171' }}>
                <Ban className="w-3 h-3" /> Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" /> Sistema de Guardias
          </h1>
          <p className="text-xs mt-0.5" style={{ color: muted }}>
            El técnico de guardia recibe incidencias automáticamente según su horario
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>
            <ArrowUpDown className="w-4 h-4" />
            {sortDir === 'desc' ? 'Más reciente primero' : 'Más antigua primero'}
          </button>
          {isTech && uncoveredIn48h > 0 && (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
              style={{ background: 'hsl(0,50%,20%)', color: '#f87171' }}>
              ⚠ {uncoveredIn48h} bloque{uncoveredIn48h !== 1 ? 's' : ''} sin cubrir (48h)
            </span>
          )}
          {isSupport && !myActive && (
            <button onClick={() => setShowSelfAssign(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              style={{ background: 'hsl(142,33%,18%)', color: '#4ade80' }}>
              <Shield className="w-4 h-4" /> Cubrirme
            </button>
          )}
          {canManage && (
            <>
              <button onClick={() => setShowPlanner(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
                style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>
                <Calendar className="w-4 h-4" /> Planificar mes
              </button>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                style={{ background: 'hsl(217,91%,45%)' }}>
                <Plus className="w-4 h-4" /> Nueva guardia
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Barra de selección masiva ── */}
      {canManage && selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl flex-wrap gap-2"
          style={{ background: 'hsl(217,60%,14%)', border: '1px solid hsl(217,60%,28%)' }}>
          <span className="text-sm font-medium" style={{ color: '#60a5fa' }}>
            {selected.size} guardia(s) seleccionada(s)
          </span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set())}
              className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/10"
              style={{ color: 'hsl(215,20%,65%)' }}>
              Cancelar selección
            </button>
            <button onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium hover:opacity-90"
              style={{ background: 'hsl(0,50%,20%)', color: '#f87171' }}>
              <Trash2 className="w-3.5 h-3.5" /> Eliminar {selected.size}
            </button>
          </div>
        </div>
      )}

      {/* ── Banner: estado actual ── */}
      {activeGuardia ? (
        <div className="rounded-xl p-4 flex items-center gap-3 flex-wrap"
          style={{ background: 'hsl(142,50%,10%)', border: '1px solid hsl(142,60%,22%)' }}>
          <Shield className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-green-300">Técnico en turno ahora</p>
            <p className="text-xs text-green-400/80">
              🔧 {activeGuardia.tecnico_nombre} · {formatRange(activeGuardia)} · {duration(activeGuardia)}
            </p>
            <p className="text-[10px] mt-0.5 text-green-500/70">
              Las nuevas incidencias se asignan automáticamente a este técnico
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-bold"
            style={{ background: 'hsl(142,60%,18%)', color: '#4ade80' }}>
            EN TURNO
          </span>
        </div>
      ) : (
        <div className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'hsl(38,50%,10%)', border: '1px solid hsl(38,60%,22%)' }}>
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-300">Sin técnico de guardia ahora</p>
            <p className="text-xs" style={{ color: 'hsl(38,60%,55%)' }}>
              Las incidencias nuevas quedarán en estado "Pendiente" hasta ser asignadas manualmente.
              {canManage && ' Crea una guardia para el horario actual.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Cobertura 24/7 (solo admin/tech) ── */}
      {isTech && <CoverageHeatmap guardias={[...active, ...upcoming]} />}

      {/* ── Estadísticas de incidencias en guardias ── */}
      {isTech && past.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Incidencias atendidas en guardias</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
              style={{ background: 'hsl(217,60%,18%)', color: '#60a5fa' }}>
              {past.length} turno{past.length !== 1 ? 's' : ''} registrado{past.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-3 text-center" style={{ background: 'hsl(217,60%,14%)', border: '1px solid hsl(217,60%,22%)' }}>
              <p className="text-xl font-bold text-white">{guardStatsTotal.total}</p>
              <p className="text-[10px] mt-0.5" style={{ color: muted }}>Total incidencias</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'hsl(217,60%,14%)', border: '1px solid hsl(217,60%,22%)' }}>
              <p className="text-xl font-bold text-white">{guardStatsTotal.avgPerShift}</p>
              <p className="text-[10px] mt-0.5" style={{ color: muted }}>Promedio / turno</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'hsl(142,60%,12%)', border: '1px solid hsl(142,60%,22%)' }}>
              <p className="text-xl font-bold text-green-400">{guardStatsTotal.pct}%</p>
              <p className="text-[10px] mt-0.5" style={{ color: muted }}>Resueltas</p>
            </div>
          </div>
          {techStats.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: muted }}>Rendimiento por técnico</p>
              {techStats.map(ts => (
                <div key={ts.name} className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: 'hsl(217,33%,16%)', border: '1px solid hsl(217,33%,22%)' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background: 'hsl(217,91%,25%)', color: '#60a5fa' }}>
                    {(ts.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{ts.name}</p>
                    <p className="text-[10px]" style={{ color: muted }}>
                      {ts.shifts} turno{ts.shifts !== 1 ? 's' : ''} · {ts.resolvedIncs}/{ts.totalIncs} resueltas
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: ts.totalIncs > 0 ? '#60a5fa' : muted }}>
                      {ts.totalIncs}
                    </p>
                    {ts.avgMinutes > 0 && (
                      <p className="text-[10px]" style={{ color: muted }}>
                        ~{ts.avgMinutes < 60 ? `${ts.avgMinutes}m` : `${(ts.avgMinutes / 60).toFixed(1)}h`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mi turno (para técnicos de soporte) ── */}
      {isSupport && (
        <div className="space-y-2">
          {myActive && (
            <div className="rounded-xl p-4" style={{ background: 'hsl(142,50%,10%)', border: '1px solid hsl(142,60%,22%)' }}>
              <p className="text-xs font-bold text-green-400 uppercase tracking-wide mb-1">🟢 Estás de guardia ahora</p>
              <p className="text-sm text-white font-semibold">{formatRange(myActive)}</p>
              <p className="text-xs mt-0.5" style={{ color: muted }}>
                Tipo: {myActive.tipo} · Duración: {duration(myActive)}
              </p>
            </div>
          )}
          {myUpcoming.length > 0 && (
            <div className="rounded-xl p-4" style={cardStyle}>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Tus próximas guardias</p>
              {myUpcoming.slice(0, 3).map(g => (
                <div key={g.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0"
                  style={{ borderColor: 'hsl(217,33%,20%)' }}>
                  <span className="text-white/80">{formatRange(g)}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px]"
                    style={{ background: 'hsl(217,60%,18%)', color: '#60a5fa' }}>
                    {duration(g)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Guardias en turno ahora (admin view) ── */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-500">Cargando guardias...</div>
      ) : (
        <div className="space-y-4">
          {/* Activas ahora */}
          {active.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"
                style={{ color: '#4ade80' }}>
                {canManage && (
                  <input type="checkbox"
                    checked={active.every(g => selected.has(g.id))}
                    onChange={() => selectSection(active.map(g => g.id))}
                    className="cursor-pointer"
                    style={{ accentColor: '#3b82f6', width: '13px', height: '13px' }}
                  />
                )}
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                En turno ahora ({active.length})
              </h2>
              <div className="space-y-2">{sortFn(active).map(g => <GuardiaCard key={g.id} g={g} />)}</div>
            </section>
          )}

          {/* Próximas */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"
                style={{ color: '#60a5fa' }}>
                {canManage && (
                  <input type="checkbox"
                    checked={upcoming.every(g => selected.has(g.id))}
                    onChange={() => selectSection(upcoming.map(g => g.id))}
                    className="cursor-pointer"
                    style={{ accentColor: '#3b82f6', width: '13px', height: '13px' }}
                  />
                )}
                Próximas guardias ({upcoming.length})
              </h2>
              <div className="space-y-2">{sortFn(upcoming).map(g => <GuardiaCard key={g.id} g={g} />)}</div>
            </section>
          )}

          {/* Sin ninguna guardia */}
          {active.length === 0 && upcoming.length === 0 && past.length === 0 && (
            <div className="text-center py-16 rounded-xl text-gray-500" style={cardStyle}>
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay guardias registradas</p>
              {canManage && <p className="text-xs mt-1">Crea la primera guardia con el botón de arriba</p>}
            </div>
          )}

          {/* Historial (colapsable) */}
          {past.length > 0 && (
            <section>
              <div className="flex items-center gap-2">
                {canManage && showPast && (
                  <input type="checkbox"
                    checked={past.every(g => selected.has(g.id))}
                    onChange={() => selectSection(past.map(g => g.id))}
                    className="cursor-pointer"
                    style={{ accentColor: '#3b82f6', width: '13px', height: '13px' }}
                  />
                )}
                <button onClick={() => setShowPast(p => !p)}
                  className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-80"
                  style={{ color: muted }}>
                  <span>{showPast ? '▾' : '▸'} Historial ({past.length})</span>
                </button>
              </div>
              {showPast && (
                <div className="space-y-2 mt-2">
                  {sortFn(past).map(g => <GuardiaCard key={g.id} g={g} />)}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Modals */}
      {showSelfAssign && (
        <SelfAssignModal user={user} guardias={guardias} onClose={() => setShowSelfAssign(false)} onSaved={() => { setShowSelfAssign(false); refresh(); }} />
      )}
      {showForm && (
        <GuardiaForm techs={techs} user={user} guardias={guardias} onClose={() => setShowForm(false)} onSaved={refresh} />
      )}
      {editGuardia && (
        <GuardiaForm guardia={editGuardia} techs={techs} user={user} guardias={guardias} onClose={() => setEditGuardia(null)} onSaved={refresh} />
      )}
      {replaceGuardia && (
        <ReplaceTechModal guardia={replaceGuardia} techs={techs} user={user}
          onClose={() => setReplaceGuardia(null)} onSaved={refresh} />
      )}
      {showPlanner && (
        <MonthlyPlanner techs={techs} user={user}
          onClose={() => setShowPlanner(false)}
          onSaved={() => { setShowPlanner(false); refresh(); }} />
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
