import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X, Building2, FileText, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };

const DEPT_COLORS = [
  'hsl(217,91%,38%)',
  'hsl(270,60%,38%)',
  'hsl(142,55%,28%)',
  'hsl(38,80%,36%)',
  'hsl(0,60%,36%)',
  'hsl(196,70%,34%)',
  'hsl(320,55%,36%)',
  'hsl(160,55%,28%)',
];

export default function Departments() {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [dlg, setDlg] = useState({ open: false });
  const qc = useQueryClient();

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['all-departments'],
    queryFn: () => base44.entities.Department.list('-created_date'),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['requests-dept'],
    queryFn: () => base44.entities.Request.filter({ is_deleted: false }, '-created_date', 500),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Department.create({ name, is_active: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-departments'] }); setNewName(''); toast.success('Departamento creado'); },
    onError: () => toast.error('Error al crear departamento'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Department.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-departments'] }); setEditId(null); toast.success('Actualizado'); },
    onError: () => toast.error('Error al actualizar departamento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Department.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-departments'] }); setDlg({ open: false }); toast.success('Departamento eliminado'); },
    onError: () => toast.error('Error al eliminar departamento'),
  });

  const statsMap = useMemo(() => {
    const map = {};
    departments.forEach(d => {
      const reqs = requests.filter(r => r.department_names?.includes(d.name));
      const finished = reqs.filter(r => r.status === 'Finalizado' && r.completion_date && r.created_date);
      const avg = finished.length
        ? finished.reduce((s, r) => s + (new Date(r.completion_date) - new Date(r.created_date)), 0) / finished.length / 3600000
        : 0;
      map[d.id] = { count: reqs.length, avg: Math.round(avg * 10) / 10 };
    });
    return map;
  }, [departments, requests]);

  const maxCount = useMemo(() => Math.max(...Object.values(statsMap).map(s => s.count), 1), [statsMap]);
  const activeCount = departments.filter(d => d.is_active).length;

  const deptStats = departments.map(d => ({ name: d.name, total: statsMap[d.id]?.count || 0 }));
  const deptResolution = departments.map(d => ({ name: d.name, horas: statsMap[d.id]?.avg || 0 }));

  return (
    <div className="space-y-5 max-w-5xl">
      <h2 className="text-xl font-bold text-white">Departamentos</h2>

      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: departments.length, icon: Building2, color: 'hsl(217,91%,45%)' },
          { label: 'Activos', value: activeCount, icon: Check, color: 'hsl(142,55%,40%)' },
          { label: 'Solicitudes', value: requests.length, icon: FileText, color: 'hsl(38,80%,45%)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl px-4 py-3 flex items-center gap-3" style={cardStyle}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: s.color + '28' }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-[10px]" style={{ color: 'hsl(215,20%,50%)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Crear departamento */}
      <form onSubmit={e => { e.preventDefault(); if (newName.trim()) createMutation.mutate(newName.trim()); }}
        className="flex gap-2 p-4 rounded-xl" style={cardStyle}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nombre del nuevo departamento..."
          className={inputCls}
          style={inputStyle}
        />
        <button type="submit" disabled={createMutation.isPending || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity"
          style={{ background: 'hsl(217,91%,45%)' }}>
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </form>

      {/* Cards */}
      {isLoading ? (
        <div className="rounded-xl p-8 text-center text-gray-500" style={cardStyle}>Cargando departamentos...</div>
      ) : departments.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={cardStyle}>
          <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(215,20%,25%)' }} />
          <p className="text-sm" style={{ color: 'hsl(215,20%,45%)' }}>No hay departamentos aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {departments.map((dept, i) => {
            const stats = statsMap[dept.id] || { count: 0, avg: 0 };
            const color = DEPT_COLORS[i % DEPT_COLORS.length];
            const pct = Math.round((stats.count / maxCount) * 100);
            const isEditing = editId === dept.id;
            return (
              <div key={dept.id} className="rounded-xl p-4 transition-all"
                style={{ ...cardStyle, border: isEditing ? '1px solid hsl(217,91%,45%)' : undefined }}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: color }}>
                    {dept.name[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                          className="flex-1 px-2 py-1 rounded-lg text-sm text-white outline-none"
                          style={inputStyle} />
                        <button onClick={() => { if (editName.trim()) updateMutation.mutate({ id: dept.id, data: { name: editName.trim() } }); }}
                          className="p-1.5 rounded-lg" style={{ background: 'hsl(142,55%,18%)' }}>
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="p-1.5 rounded-lg" style={{ background: 'hsl(0,55%,20%)' }}>
                          <X className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white truncate">{dept.name}</p>
                        <button
                          onClick={() => updateMutation.mutate({ id: dept.id, data: { is_active: !dept.is_active } })}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 transition-colors"
                          style={{
                            background: dept.is_active ? 'hsl(142,55%,14%)' : 'hsl(217,33%,20%)',
                            color: dept.is_active ? '#4ade80' : 'hsl(215,20%,45%)',
                            border: `1px solid ${dept.is_active ? 'hsl(142,55%,26%)' : 'hsl(217,33%,28%)'}`,
                          }}>
                          {dept.is_active ? '● Activo' : '○ Inactivo'}
                        </button>
                      </div>
                    )}

                    {!isEditing && (
                      <>
                        {/* Mini stats */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'hsl(222,47%,16%)' }}>
                            <p className="text-base font-bold text-white">{stats.count}</p>
                            <p className="text-[10px]" style={{ color: 'hsl(215,20%,50%)' }}>Solicitudes</p>
                          </div>
                          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'hsl(222,47%,16%)' }}>
                            <p className="text-base font-bold text-white">{stats.avg > 0 ? `${stats.avg}h` : '—'}</p>
                            <p className="text-[10px]" style={{ color: 'hsl(215,20%,50%)' }}>Prom. cierre</p>
                          </div>
                        </div>

                        {/* Bar relativa */}
                        <div className="mt-2.5 h-1 rounded-full" style={{ background: 'hsl(222,47%,22%)' }}>
                          <div className="h-1 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: color }} />
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-end gap-1 mt-3">
                          <button onClick={() => { setEditId(dept.id); setEditName(dept.name); }}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: 'hsl(215,20%,55%)' }} title="Renombrar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDlg({
                            open: true,
                            msg: `¿Eliminar el departamento "${dept.name}"? Esta acción no se puede deshacer.`,
                            id: dept.id,
                          })}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            style={{ color: 'hsl(215,20%,55%)' }} title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      {departments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-sm font-semibold text-white mb-3">Solicitudes por departamento</h3>
            {deptStats.every(d => d.total === 0) ? (
              <p className="text-xs" style={{ color: 'hsl(215,20%,40%)' }}>Sin datos para graficar.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={deptStats} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white', fontSize: 11 }} />
                  <Bar dataKey="total" fill="hsl(217,91%,50%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-sm font-semibold text-white mb-3">Tiempo promedio de cierre (h)</h3>
            {deptResolution.every(d => d.horas === 0) ? (
              <p className="text-xs" style={{ color: 'hsl(215,20%,40%)' }}>Sin datos disponibles.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={deptResolution} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white', fontSize: 11 }} formatter={(v) => [`${v}h`, 'Prom. horas']} />
                  <Bar dataKey="horas" fill="hsl(38,92%,50%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={dlg.open}
        title="Eliminar departamento"
        message={dlg.msg}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => deleteMutation.mutate(dlg.id)}
        onCancel={() => setDlg({ open: false })}
      />
    </div>
  );
}
