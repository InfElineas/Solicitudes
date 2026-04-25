import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };

export default function Departments() {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
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
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Department.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-departments'] }); setEditId(null); toast.success('Actualizado'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Department.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-departments'] }); setDeleteConfirmId(null); toast.success('Departamento eliminado'); },
  });

  // Stats per department
  const deptStats = departments.map(d => ({
    name: d.name,
    total: requests.filter(r => r.department_names?.includes(d.name)).length,
  }));

  // Avg resolution time per dept
  const deptResolution = departments.map(d => {
    const finished = requests.filter(r => r.department_names?.includes(d.name) && r.status === 'Finalizada' && r.completion_date && r.created_date);
    const avg = finished.length
      ? finished.reduce((sum, r) => sum + (new Date(r.completion_date) - new Date(r.created_date)), 0) / finished.length / (1000 * 60 * 60)
      : 0;
    return { name: d.name, horas: Math.round(avg * 10) / 10 };
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-xl font-bold text-white">Departamentos</h2>

      {/* Create */}
      <form onSubmit={e => { e.preventDefault(); if (newName.trim()) createMutation.mutate(newName.trim()); }}
        className="flex gap-3 p-4 rounded-xl" style={cardStyle}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nombre del nuevo departamento..."
          className={inputCls}
          style={inputStyle}
        />
        <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg text-white text-sm font-medium shrink-0 hover:opacity-90" style={{ background: 'hsl(217,91%,45%)' }}>
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* List */}
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando departamentos...</div>
        ) : departments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay departamentos aún.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(217,33%,18%)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(215,20%,45%)' }}>Nombre</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(215,20%,45%)' }}>Estado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(215,20%,45%)' }}>Solicitudes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => {
                const count = requests.filter(r => r.department_names?.includes(dept.name)).length;
                return (
                  <tr key={dept.id} style={{ borderBottom: '1px solid hsl(217,33%,16%)' }}>
                    <td className="px-4 py-3">
                      {editId === dept.id ? (
                        <div className="flex items-center gap-2">
                          <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus className={inputCls + ' max-w-xs'} style={inputStyle} />
                          <button onClick={() => updateMutation.mutate({ id: dept.id, data: { name: editName } })}><Check className="w-4 h-4 text-green-400" /></button>
                          <button onClick={() => setEditId(null)}><X className="w-4 h-4 text-red-400" /></button>
                        </div>
                      ) : (
                        <span className={`font-medium ${dept.is_active ? 'text-white' : 'text-gray-500 line-through'}`}>{dept.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => updateMutation.mutate({ id: dept.id, data: { is_active: !dept.is_active } })}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${dept.is_active ? 'text-green-400' : 'text-gray-500'}`}
                        style={{ background: dept.is_active ? 'hsl(142,60%,15%)' : 'hsl(217,33%,20%)' }}
                      >
                        {dept.is_active ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">{count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditId(dept.id); setEditName(dept.name); }}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirmId(dept.id)}
                          className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Charts */}
      {departments.length > 0 && (
        <>
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-sm font-semibold text-white mb-1">Distribución de Solicitudes por Departamento</h3>
            {deptStats.every(d => d.total === 0) ? (
              <p className="text-xs text-gray-500 mt-2">Sin datos para graficar.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white', fontSize: 12 }} />
                  <Bar dataKey="total" fill="hsl(217,91%,50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-sm font-semibold text-white mb-0.5">Tiempo promedio de resolución de solicitud por departamento</h3>
            <p className="text-xs mb-3" style={{ color: 'hsl(215,20%,55%)' }}>Total de departamentos: {departments.length}</p>
            {deptResolution.every(d => d.horas === 0) ? (
              <p className="text-xs text-gray-500">Sin datos disponibles.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={deptResolution} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} label={{ value: 'h', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white', fontSize: 12 }} formatter={(v) => [`${v}h`, 'Prom. horas']} />
                  <Bar dataKey="horas" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' }}>
            <h3 className="text-base font-semibold text-white mb-2">Eliminar departamento</h3>
            <p className="text-sm text-gray-400 mb-4">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} className="px-4 py-2 text-sm rounded-lg text-white font-medium" style={{ background: 'hsl(0,70%,40%)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}