import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Package, Plus, Search, AlertTriangle, X, Edit3, Trash2, User, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

const cardStyle = { background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' };
const modalStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' };
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)', color: 'white', outline: 'none' };
const inputCls = "w-full px-3 py-2 rounded-lg text-sm";
const labelCls = "text-xs font-medium text-gray-400 mb-1 block";
const muted = 'hsl(215,20%,55%)';

const TIPOS = ['Hardware', 'Software', 'Licencia', 'Periférico', 'Red', 'Otro'];
const ESTADOS = ['Activo', 'En reparación', 'Dado de baja', 'En préstamo'];

const ESTADO_COLORS = {
  'Activo': { bg: 'hsl(142,60%,16%)', text: '#4ade80' },
  'En reparación': { bg: 'hsl(38,60%,16%)', text: '#fbbf24' },
  'Dado de baja': { bg: 'hsl(0,50%,16%)', text: '#f87171' },
  'En préstamo': { bg: 'hsl(217,60%,18%)', text: '#60a5fa' },
};

const TIPO_COLORS = {
  'Hardware': 'hsl(217,91%,50%)',
  'Software': 'hsl(270,70%,60%)',
  'Licencia': 'hsl(142,60%,45%)',
  'Periférico': 'hsl(38,80%,50%)',
  'Red': 'hsl(195,70%,50%)',
  'Otro': 'hsl(215,20%,55%)',
};

function AssetForm({ activo, users, onClose, onSaved }) {
  const isEdit = !!activo;
  const [form, setForm] = useState({
    nombre: activo?.nombre || '',
    tipo: activo?.tipo || 'Hardware',
    marca: activo?.marca || '',
    modelo: activo?.modelo || '',
    numero_serie: activo?.numero_serie || '',
    estado: activo?.estado || 'Activo',
    assigned_to: activo?.assigned_to || '',
    department: activo?.department || '',
    fecha_adquisicion: activo?.fecha_adquisicion ? activo.fecha_adquisicion.slice(0, 10) : '',
    notas: activo?.notas || '',
    valor: activo?.valor || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const assignedUser = users.find(u => u.email === form.assigned_to);
    const payload = {
      ...form,
      assigned_to_name: assignedUser?.full_name || form.assigned_to || null,
      fecha_adquisicion: form.fecha_adquisicion ? new Date(form.fecha_adquisicion).toISOString() : null,
    };
    if (isEdit) {
      await base44.entities.Activo.update(activo.id, payload);
      toast.success('Activo actualizado');
    } else {
      await base44.entities.Activo.create(payload);
      toast.success('Activo creado');
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg my-8" style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">{isEdit ? 'Editar activo' : 'Nuevo activo'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} className={inputCls} style={inputStyle} placeholder="Ej: Laptop Dell XPS 15" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={inputCls + " cursor-pointer"} style={inputStyle}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)} className={inputCls + " cursor-pointer"} style={inputStyle}>
                {ESTADOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Marca</label>
              <input value={form.marca} onChange={e => set('marca', e.target.value)} className={inputCls} style={inputStyle} placeholder="Dell, HP, Microsoft..." />
            </div>
            <div>
              <label className={labelCls}>Modelo</label>
              <input value={form.modelo} onChange={e => set('modelo', e.target.value)} className={inputCls} style={inputStyle} placeholder="XPS 15, Surface..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Número de serie / Código</label>
            <input value={form.numero_serie} onChange={e => set('numero_serie', e.target.value)} className={inputCls} style={inputStyle} placeholder="SN-12345" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Asignado a</label>
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className={inputCls + " cursor-pointer"} style={inputStyle}>
                <option value="">Sin asignar</option>
                {users.map(u => <option key={u.email} value={u.email}>{u.full_name || u.email}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} className={inputCls} style={inputStyle} placeholder="TI, RRHH..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de adquisición</label>
              <input type="date" value={form.fecha_adquisicion} onChange={e => set('fecha_adquisicion', e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Valor / Precio ($)</label>
              <input type="number" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} className={inputCls} style={inputStyle} placeholder="1500.00" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} className={inputCls + " resize-none"} style={inputStyle} placeholder="Observaciones adicionales..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50" style={{ background: 'hsl(217,91%,45%)' }}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear activo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetDetailModal({ activo, incidents, onClose }) {
  const relatedIncidents = useMemo(() => {
    const seen = new Set();
    return incidents.filter(i => {
      if (seen.has(i.id)) return false;
      const matches = i.activo_id === activo.id ||
        (activo.nombre && i.tool_name?.toLowerCase() === activo.nombre.toLowerCase());
      if (matches) seen.add(i.id);
      return matches;
    });
  }, [incidents, activo]);
  const estadoCfg = ESTADO_COLORS[activo.estado] || ESTADO_COLORS['Activo'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg my-8" style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">{activo.nombre}</h3>
            <p className="text-xs mt-0.5" style={{ color: muted }}>{activo.tipo} {activo.marca ? `· ${activo.marca}` : ''} {activo.modelo ? `${activo.modelo}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          {[
            ['Estado', <span className="px-2 py-0.5 rounded text-xs font-semibold" style={estadoCfg}>{activo.estado}</span>],
            ['Nº Serie', activo.numero_serie || '—'],
            ['Asignado a', activo.assigned_to_name || '—'],
            ['Departamento', activo.department || '—'],
            ['Adquisición', activo.fecha_adquisicion ? new Date(activo.fecha_adquisicion).toLocaleDateString('es') : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <span className="block text-xs mb-0.5" style={{ color: muted }}>{k}</span>
              <span className="font-medium text-white">{v}</span>
            </div>
          ))}
          {activo.notas && (
            <div className="col-span-2">
              <span className="block text-xs mb-0.5" style={{ color: muted }}>Notas</span>
              <span className="text-white text-sm">{activo.notas}</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-semibold text-white">Incidencias relacionadas ({relatedIncidents.length})</span>
            {relatedIncidents.length >= 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'hsl(0,50%,20%)', color: '#f87171' }}>
                ⚠ Falla recurrente
              </span>
            )}
          </div>
          {relatedIncidents.length === 0 ? (
            <p className="text-xs text-gray-500">Sin incidencias registradas para este activo.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {relatedIncidents.slice(0, 10).map(inc => (
                <div key={inc.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: 'hsl(222,47%,18%)' }}>
                  <span className="text-white truncate flex-1">{inc.description?.slice(0, 60)}...</span>
                  <span className="ml-2 shrink-0" style={{ color: inc.status === 'Resuelto' ? '#4ade80' : '#fbbf24' }}>{inc.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Assets() {
  const { user } = useAuth();
  const isAuditor = user?.role === 'auditor';
  const [sp, setSP] = useSearchParams();
  const search      = sp.get('q') || '';
  const filterTipo  = sp.get('tipo') || 'all';
  const filterEstado = sp.get('estado') || 'all';
  const setSearch      = (val) => setSP(p => { const n = new URLSearchParams(p); val ? n.set('q', val) : n.delete('q'); return n; });
  const setFilterTipo  = (val) => setSP(p => { const n = new URLSearchParams(p); val !== 'all' ? n.set('tipo', val) : n.delete('tipo'); return n; });
  const setFilterEstado = (val) => setSP(p => { const n = new URLSearchParams(p); val !== 'all' ? n.set('estado', val) : n.delete('estado'); return n; });
  const [showForm, setShowForm] = useState(false);
  const [editActivo, setEditActivo] = useState(null);
  const [detailActivo, setDetailActivo] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const qc = useQueryClient();

  const { data: activos = [], isLoading } = useQuery({
    queryKey: ['activos'],
    queryFn: () => base44.entities.Activo.filter({ is_deleted: false }, '-created_date', 500),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.filter({ is_deleted: false }, '-created_date', 500),
    initialData: [],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.filter({ is_active: true }),
    initialData: [],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['activos'] });

  const filtered = useMemo(() => {
    let a = activos;
    if (search) {
      const s = search.toLowerCase();
      a = a.filter(x => x.nombre?.toLowerCase().includes(s) || x.marca?.toLowerCase().includes(s) || x.numero_serie?.toLowerCase().includes(s) || x.assigned_to_name?.toLowerCase().includes(s));
    }
    if (filterTipo !== 'all') a = a.filter(x => x.tipo === filterTipo);
    if (filterEstado !== 'all') a = a.filter(x => x.estado === filterEstado);
    return a;
  }, [activos, search, filterTipo, filterEstado]);

  const handleDelete = async (id) => {
    try {
      await base44.entities.Activo.update(id, {
        is_deleted: true,
        deleted_by_name: user?.full_name || user?.email || '',
      });
      qc.invalidateQueries({ queryKey: ['activos'] });
      setDeleteId(null);
      toast.success('Activo movido a la papelera');
    } catch (err) {
      console.error('[Assets] handleDelete error:', err);
      toast.error('Error al mover a papelera');
    }
  };

  // Compute incident count per asset
  const incidentCountById = useMemo(() => {
    const map = {};
    incidents.forEach(i => {
      if (i.activo_id) map[i.activo_id] = (map[i.activo_id] || 0) + 1;
    });
    return map;
  }, [incidents]);

  const selectStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' };

  const csvRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const downloadCSVTemplate = () => {
    const lines = [
      'nombre,tipo,marca,modelo,numero_serie,estado,department,fecha_adquisicion,valor,notas',
      'Laptop Dell XPS 15,Hardware,Dell,XPS 15,SN-12345,Activo,TI,2024-01-15,1500,Equipo de desarrollo',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_activos.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        function parseCSVLine(line) {
          const result = [];
          let cur = '', inQ = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') { inQ = !inQ; }
            else if (line[i] === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
            else { cur += line[i]; }
          }
          result.push(cur.trim());
          return result;
        }
        const lines = evt.target.result.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { toast.error('CSV vacío'); setImporting(false); return; }
        const headers = parseCSVLine(lines[0]).map(h => h.trim());
        const idx = (name) => headers.indexOf(name);
        let skipped = 0;
        const rows = lines.slice(1).map(line => {
          const cols = parseCSVLine(line);
          if (idx('nombre') === -1) { skipped++; return null; }
          const nombreVal = cols[idx('nombre')] || '';
          if (!nombreVal) { skipped++; return null; }
          const rawDate = cols[idx('fecha_adquisicion')];
          const parsedDate = rawDate ? new Date(rawDate) : null;
          const fecha_adquisicion = parsedDate && !isNaN(parsedDate) ? parsedDate.toISOString() : null;
          return {
            nombre: nombreVal,
            tipo: cols[idx('tipo')] || 'Hardware',
            marca: cols[idx('marca')] || '',
            modelo: cols[idx('modelo')] || '',
            numero_serie: cols[idx('numero_serie')] || '',
            estado: cols[idx('estado')] || 'Activo',
            department: cols[idx('department')] || '',
            fecha_adquisicion,
            valor: cols[idx('valor')] ? parseFloat(cols[idx('valor')]) : null,
            notas: cols[idx('notas')] || '',
          };
        }).filter(Boolean);
        if (!rows.length) { toast.error('Sin filas válidas'); setImporting(false); return; }
        await Promise.all(rows.map(row => base44.entities.Activo.create(row)));
        const created = rows.length;
        toast.success(`${created} activo(s) importados${skipped > 0 ? `, ${skipped} filas omitidas` : ''}`);
        refresh();
      } catch (err) {
        toast.error('Error al importar el CSV');
        console.error('[Assets CSV]', err);
      }
      setImporting(false);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const stats = {
    total: activos.length,
    activos: activos.filter(a => a.estado === 'Activo').length,
    reparacion: activos.filter(a => a.estado === 'En reparación').length,
    baja: activos.filter(a => a.estado === 'Dado de baja').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" /> Inventario de Activos
          </h1>
          <p className="text-xs mt-0.5" style={{ color: muted }}>Hardware, software y equipos de la empresa</p>
        </div>
        {!isAuditor && (
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={csvRef} type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
            <button onClick={downloadCSVTemplate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>
              <Download className="w-4 h-4" /> Plantilla CSV
            </button>
            <button onClick={() => csvRef.current?.click()} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>
              <Upload className="w-4 h-4" /> {importing ? 'Importando...' : 'Importar CSV'}
            </button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
              style={{ background: 'hsl(217,91%,45%)' }}>
              <Plus className="w-4 h-4" /> Nuevo activo
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total activos', value: stats.total, color: '#60a5fa' },
          { label: 'Operativos', value: stats.activos, color: '#4ade80' },
          { label: 'En reparación', value: stats.reparacion, color: '#fbbf24' },
          { label: 'Dados de baja', value: stats.baja, color: '#f87171' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={cardStyle}>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: muted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, marca, serie..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' }} />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="all">Todos los tipos</option>
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="all">Todos los estados</option>
          {ESTADOS.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs" style={{ color: muted }}>{filtered.length} activo(s)</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-500">Cargando activos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl text-gray-500" style={cardStyle}>
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay activos registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(a => {
            const estadoCfg = ESTADO_COLORS[a.estado] || ESTADO_COLORS['Activo'];
            const incCount = incidentCountById[a.id] || 0;
            const isRecurring = incCount >= 3;
            return (
              <div key={a.id} className="rounded-xl p-4 flex flex-col gap-2" style={{ ...cardStyle, border: isRecurring ? '1px solid hsl(0,50%,30%)' : cardStyle.border }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">{a.nombre}</span>
                      {isRecurring && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{ background: 'hsl(0,50%,20%)', color: '#f87171' }}>
                          ⚠ Recurrente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: `${TIPO_COLORS[a.tipo]}22`, color: TIPO_COLORS[a.tipo] }}>{a.tipo}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={estadoCfg}>{a.estado}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5 text-xs" style={{ color: muted }}>
                  {(a.marca || a.modelo) && <p>{[a.marca, a.modelo].filter(Boolean).join(' ')}</p>}
                  {a.numero_serie && <p>SN: {a.numero_serie}</p>}
                  {a.assigned_to_name && (
                    <p className="flex items-center gap-1"><User className="w-3 h-3" /> {a.assigned_to_name}</p>
                  )}
                  {a.department && <p>🏢 {a.department}</p>}
                </div>

                {incCount > 0 && (
                  <p className="text-[10px]" style={{ color: incCount >= 3 ? '#f87171' : '#fbbf24' }}>
                    {incCount} incidencia{incCount !== 1 ? 's' : ''} registrada{incCount !== 1 ? 's' : ''}
                  </p>
                )}

                <div className="flex gap-1.5 flex-wrap pt-1">
                  <button onClick={() => setDetailActivo(a)}
                    className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                    style={{ background: 'hsl(217,33%,20%)', color: 'hsl(215,20%,70%)' }}>
                    Ver detalle
                  </button>
                  {!isAuditor && (
                    <button onClick={() => setEditActivo(a)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,75%)' }}>
                      <Edit3 className="w-3 h-3" /> Editar
                    </button>
                  )}
                  {!isAuditor && (
                    <button onClick={() => setDeleteId(a.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(0,50%,20%)', color: '#f87171' }}>
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <AssetForm users={users} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refresh(); }} />
      )}
      {editActivo && (
        <AssetForm activo={editActivo} users={users} onClose={() => setEditActivo(null)} onSaved={() => { setEditActivo(null); refresh(); }} />
      )}
      {detailActivo && (
        <AssetDetailModal activo={detailActivo} incidents={incidents} onClose={() => setDetailActivo(null)} />
      )}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl p-6 w-full max-w-sm" style={modalStyle}>
            <h3 className="text-base font-semibold text-white mb-2">¿Mover activo a la papelera?</h3>
            <p className="text-sm text-gray-400 mb-4">Podrás recuperarlo desde la sección Papelera.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm rounded-lg text-white font-medium" style={{ background: 'hsl(38,70%,35%)' }}>Mover a papelera</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}