import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

const inputStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' };
const selectCls = "text-xs rounded-lg px-3 py-1.5 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500";
const labelCls = "text-[10px] uppercase font-medium mb-1 block";
const muted = { color: 'hsl(215,20%,45%)' };

// Protocolo Operativo v1.0
const STATUSES = ['Pendiente', 'En Proceso', 'En Espera', 'Requiere Información', 'En Validación', 'Finalizado', 'Retrasado', 'Cancelado', 'Rechazado'];
const REQUEST_TYPES = ['Nueva Implementación', 'Reparación / Bug', 'Mantenimiento', 'Actualización', 'Consulta o Asesoría', 'Integración', 'Optimización', 'Capacitación', 'Reporte o Análisis', 'Soporte Técnico', 'Automatización'];
const LEVELS = ['Fácil', 'Medio', 'Difícil'];
const PRIORITIES = ['P1 — Crítica', 'P2 — Alta', 'P3 — Media', 'P4 — Baja'];

export default function AdvancedFilters({ filters, onFiltersChange, departments = [], users = [], role = 'employee' }) {
  const [expanded, setExpanded] = useState(false);

  const set = (k, v) => onFiltersChange({ ...filters, [k]: v === 'all' ? '' : v });

  const activeCount = [
    filters.status, filters.dept, filters.request_type, filters.level,
    filters.assigned, filters.requester, filters.priority,
    filters.dateFrom, filters.dateTo,
  ].filter(Boolean).length;

  const clearAll = () => onFiltersChange({
    status: '', dept: '', request_type: '', level: '',
    assigned: '', requester: '', priority: '', dateFrom: '', dateTo: '',
  });

  const techUsers = users.filter(u => u.role === 'admin' || u.role === 'support');

  return (
    <div className="rounded-xl mb-4" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' }}>
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium hover:bg-white/5 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'hsl(217,91%,60%)' }} />
          <span className="text-white font-semibold">Filtros avanzados</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'hsl(217,91%,35%)', color: 'white' }}>
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); clearAll(); }}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded hover:bg-white/10"
              style={{ color: 'hsl(215,20%,55%)' }}
            >
              <X className="w-2.5 h-2.5" /> Limpiar
            </button>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" style={muted} /> : <ChevronDown className="w-3.5 h-3.5" style={muted} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border-t" style={{ borderColor: 'hsl(217,33%,18%)' }}>
          {/* Date range */}
          <div className="pt-3">
            <label className={labelCls} style={muted}>Fecha desde</label>
            <input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)}
              className="w-full text-xs rounded-lg px-3 py-1.5 outline-none" style={inputStyle} />
          </div>
          <div className="pt-3">
            <label className={labelCls} style={muted}>Fecha hasta</label>
            <input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)}
              className="w-full text-xs rounded-lg px-3 py-1.5 outline-none" style={inputStyle} />
          </div>

          {/* Status */}
          <div className="pt-3">
            <label className={labelCls} style={muted}>Estado</label>
            <select value={filters.status || 'all'} onChange={e => set('status', e.target.value)} className={`w-full ${selectCls}`} style={inputStyle}>
              <option value="all">Todos</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Priority */}
          <div className="pt-3">
            <label className={labelCls} style={muted}>Prioridad</label>
            <select value={filters.priority || 'all'} onChange={e => set('priority', e.target.value)} className={`w-full ${selectCls}`} style={inputStyle}>
              <option value="all">Todas</option>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Tipo */}
          <div className="pt-3">
            <label className={labelCls} style={muted}>Tipo de solicitud</label>
            <select value={filters.request_type || 'all'} onChange={e => set('request_type', e.target.value)} className={`w-full ${selectCls}`} style={inputStyle}>
              <option value="all">Todos</option>
              {REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Nivel */}
          <div className="pt-3">
            <label className={labelCls} style={muted}>Dificultad</label>
            <select value={filters.level || 'all'} onChange={e => set('level', e.target.value)} className={`w-full ${selectCls}`} style={inputStyle}>
              <option value="all">Todas</option>
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          {/* Dept */}
          {departments.length > 0 && (
            <div className="pt-3">
              <label className={labelCls} style={muted}>Departamento</label>
              <select value={filters.dept || 'all'} onChange={e => set('dept', e.target.value)} className={`w-full ${selectCls}`} style={inputStyle}>
                <option value="all">Todos</option>
                {departments.map(d => <option key={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {/* Assigned — admin/support/superadmin only */}
          {(role === 'admin' || role === 'support') && (
            <div className="pt-3">
              <label className={labelCls} style={muted}>Asignado a</label>
              <select value={filters.assigned || 'all'} onChange={e => set('assigned', e.target.value)} className={`w-full ${selectCls}`} style={inputStyle}>
                <option value="all">Todos</option>
                {techUsers.map(u => <option key={u.email} value={u.email}>{u.full_name || u.email}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}