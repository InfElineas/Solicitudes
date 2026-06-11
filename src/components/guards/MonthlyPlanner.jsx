import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

const muted = 'hsl(215,20%,55%)';
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)', color: 'white', outline: 'none' };
const inputCls = "w-full px-3 py-2 rounded-lg text-sm";
const labelCls = "text-xs font-medium text-gray-400 mb-1 block";

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function MonthlyPlanner({ techs, user, onClose, onSaved }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [techId, setTechId] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [tipo, setTipo] = useState('normal');
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [mode, setMode] = useState('days'); // 'days' | 'weekdays'
  const [selectedWeekdays, setSelectedWeekdays] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const daysInMonth = useMemo(() => {
    const days = [];
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    // Padding
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(d);
    return days;
  }, [year, month]);

  const toggleDay = (d) => {
    if (!d) return;
    setSelectedDays(prev => {
      const n = new Set(prev);
      n.has(d) ? n.delete(d) : n.add(d);
      return n;
    });
  };

  const toggleWeekday = (w) => {
    setSelectedWeekdays(prev => {
      const n = new Set(prev);
      n.has(w) ? n.delete(w) : n.add(w);
      return n;
    });
  };

  // Compute which days to create guards for
  const computeTargetDays = () => {
    if (mode === 'days') return Array.from(selectedDays).sort((a, b) => a - b);
    // weekdays mode: find all days in month matching selected weekdays
    const last = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let d = 1; d <= last; d++) {
      const wd = new Date(year, month, d).getDay();
      if (selectedWeekdays.has(wd)) result.push(d);
    }
    return result;
  };

  const handleCreate = async () => {
    if (!techId) { toast.error('Selecciona un técnico'); return; }
    const days = computeTargetDays();
    if (days.length === 0) { toast.error('Selecciona al menos un día'); return; }
    setSaving(true);
    const tech = techs.find(t => t.email === techId);
    const techName = tech?.display_name || tech?.full_name || techId;

    const guardias = days.map(d => {
      const inicio = new Date(year, month, d, ...shiftStart.split(':').map(Number));
      const fin = new Date(year, month, d, ...shiftEnd.split(':').map(Number));
      return {
        tecnico_id: techId,
        tecnico_nombre: techName,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        tipo,
        estado: 'programada',
        creada_por: user?.email,
        creada_por_nombre: user?.display_name || user?.full_name || user?.email,
      };
    });

    try {
      await base44.entities.Guardia.bulkCreate(guardias);

      // Notify tech
      await base44.entities.Notification.create({
        user_id: techId,
        type: 'assigned',
        title: '🛡️ Guardias programadas',
        message: `Se programaron ${days.length} guardia(s) de ${tipo} para ti en ${new Date(year, month).toLocaleString('es', { month: 'long', year: 'numeric' })}.`,
        is_read: false,
      });

      toast.success(`${days.length} guardia(s) creada(s) correctamente`);
      onSaved();
    } catch (err) {
      console.error('[MonthlyPlanner] bulkCreate error:', err);
      toast.error('Error al crear guardias. Algunas pueden no haberse guardado.');
    } finally {
      setSaving(false);
    }
  };

  const monthName = new Date(year, month).toLocaleString('es', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-2xl my-8" style={{ background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Planificación mensual de guardias</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Config row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Técnico *</label>
            <select value={techId} onChange={e => setTechId(e.target.value)} className={inputCls + " cursor-pointer"} style={inputStyle}>
              <option value="">Seleccionar técnico...</option>
              {techs.map(t => <option key={t.email} value={t.email}>{t.display_name || t.full_name || t.email}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Hora inicio</label>
            <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Hora fin</label>
            <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Tipo de guardia</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls + " cursor-pointer"} style={inputStyle}>
              <option value="normal">Normal</option>
              <option value="urgencia">Urgencia</option>
              <option value="fin_de_semana">Fin de semana</option>
            </select>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setMode('days')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: mode === 'days' ? 'hsl(217,91%,35%)' : 'hsl(217,33%,20%)', color: mode === 'days' ? 'white' : muted }}>
            Días específicos
          </button>
          <button onClick={() => setMode('weekdays')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: mode === 'weekdays' ? 'hsl(217,91%,35%)' : 'hsl(217,33%,20%)', color: mode === 'weekdays' ? 'white' : muted }}>
            Días de semana fijos
          </button>
        </div>

        {mode === 'weekdays' && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {WEEKDAYS.map((wd, i) => (
              <button key={i} onClick={() => toggleWeekday(i)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: selectedWeekdays.has(i) ? 'hsl(217,91%,30%)' : 'hsl(217,33%,20%)', color: selectedWeekdays.has(i) ? 'white' : muted, border: selectedWeekdays.has(i) ? '1px solid hsl(217,91%,50%)' : '1px solid transparent' }}>
                {wd}
              </button>
            ))}
          </div>
        )}

        {/* Month navigator */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { const d = new Date(year, month - 1); setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDays(new Set()); setSelectedWeekdays(new Set()); }}
            className="p-1.5 rounded hover:bg-white/10"><ChevronLeft className="w-4 h-4 text-gray-400" /></button>
          <span className="text-sm font-semibold text-white capitalize">{monthName}</span>
          <button onClick={() => { const d = new Date(year, month + 1); setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDays(new Set()); setSelectedWeekdays(new Set()); }}
            className="p-1.5 rounded hover:bg-white/10"><ChevronRight className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Calendar grid */}
        {mode === 'days' && (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(w => <div key={w} className="text-center text-[10px] font-medium py-1" style={{ color: muted }}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {daysInMonth.map((d, i) => {
                const isSelected = d && selectedDays.has(d);
                const isPast = d && new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <button key={i} onClick={() => !isPast && toggleDay(d)} disabled={!d || isPast}
                    className="aspect-square rounded-lg text-xs font-medium transition-colors disabled:opacity-0"
                    style={{
                      background: isSelected ? 'hsl(217,91%,35%)' : d ? 'hsl(222,47%,18%)' : 'transparent',
                      color: isSelected ? 'white' : isPast ? 'hsl(215,20%,35%)' : 'hsl(215,20%,75%)',
                      border: isSelected ? '1px solid hsl(217,91%,55%)' : '1px solid transparent',
                      cursor: d && !isPast ? 'pointer' : 'default',
                    }}>
                    {d || ''}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mb-4" style={{ color: muted }}>{selectedDays.size} día(s) seleccionado(s)</p>
          </>
        )}

        {mode === 'weekdays' && (
          <p className="text-xs mb-4" style={{ color: muted }}>
            Se crearán guardias para todos los <strong className="text-white">{Array.from(selectedWeekdays).map(w => WEEKDAYS[w]).join(', ') || '—'}</strong> del mes de <span className="text-white capitalize">{monthName}</span> ({computeTargetDays().length} días).
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button onClick={handleCreate} disabled={saving || computeTargetDays().length === 0}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: 'hsl(217,91%,45%)', opacity: (saving || computeTargetDays().length === 0) ? 0.5 : undefined }}>
            {saving ? 'Creando...' : `Crear ${computeTargetDays().length} guardia(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}