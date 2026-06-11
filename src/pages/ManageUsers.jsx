import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { UserPlus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const selectCls = inputCls + " cursor-pointer";
const labelCls = "text-xs font-medium text-gray-400 mb-1 block";
const modalStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' };
const cardStyle = { background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' };

/** @type {Record<string, string>} */
const ROLE_LABELS = { admin: 'Administrador', support: 'Soporte', employee: 'Empleado', jefe: 'Jefe de Depto.', auditor: 'Auditor', user: 'Usuario' };
const AVATAR_COLORS = ['bg-pink-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-cyan-500', 'bg-red-500', 'bg-yellow-500'];

function getAvatarColor(str) {
  return AVATAR_COLORS[(str?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function getInitials(u) {
  const name = u.display_name || u.full_name;
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (u.email || '?').slice(0, 2).toUpperCase();
}

function getDisplayName(u) {
  return u.display_name || u.full_name || 'Sin nombre';
}

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [newForm, setNewForm] = useState({ email: '', role: 'employee' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const navigate = useNavigate();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [data, deps] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Department.filter({ is_active: true }),
      ]);
      setUsers(data);
      setDepartments(deps);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const activeUsers   = useMemo(() => users.filter(u => u.is_active !== false), [users]);
  const inactiveUsers = useMemo(() => users.filter(u => u.is_active === false), [users]);

  const filtered = useMemo(() => {
    let list = showInactive ? inactiveUsers : activeUsers;
    if (filterRole !== 'all') list = list.filter(u => u.role === filterRole);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(u =>
        (u.display_name || u.full_name || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [users, search, filterRole, showInactive, activeUsers, inactiveUsers]);

  // KPI counts (solo activos)
  const roleCounts = useMemo(() => {
    const map = {};
    activeUsers.forEach(u => { map[u.role] = (map[u.role] || 0) + 1; });
    return map;
  }, [users]);

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await base44.entities.User.update(editUser.id, {
        role: editUser.role,
        display_name: editUser.display_name,
        department_id: editUser.department_id || null,
      });
      toast.success('Usuario actualizado');
      setEditUser(null);
      loadUsers();
    } catch {
      toast.error('Error al actualizar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!newForm.email) return;
    setSaving(true);
    try {
      const platformRole = (newForm.role === 'admin' || newForm.role === 'superadmin') ? 'admin' : 'user';
      await base44.users.inviteUser(newForm.email, platformRole);
      toast.success('Invitación enviada');
      setShowNew(false);
      setTimeout(loadUsers, 1500);
    } catch {
      toast.error('Error al invitar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id) => {
    const target = users.find(u => u.id === id);
    try {
      await base44.entities.User.update(id, { is_active: false });
      toast.success(`${target?.full_name || target?.email || 'Usuario'} desactivado`);
      setDeleteId(null);
      loadUsers();
    } catch {
      toast.error('Error al desactivar usuario');
    }
  };

  const handleReactivate = async (id) => {
    const target = users.find(u => u.id === id);
    try {
      await base44.entities.User.update(id, { is_active: true });
      toast.success(`${target?.full_name || target?.email || 'Usuario'} reactivado`);
      loadUsers();
    } catch {
      toast.error('Error al reactivar usuario');
    }
  };

  const handleDelete = async (id) => {
    const target = users.find(u => u.id === id);
    const nombre = target?.full_name || target?.email || 'usuario';
    try {
      await base44.entities.User.delete(id);
      toast.success(`Usuario ${nombre} eliminado permanentemente`);
      setDeleteId(null);
      loadUsers();
    } catch {
      toast.error('Error al eliminar usuario');
    }
  };

  const setE = (k, v) => setEditUser(u => ({ ...u, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Gestión de Usuarios</h2>
          {inactiveUsers.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'hsl(215,20%,45%)' }}>
              {activeUsers.length} activos · {inactiveUsers.length} desactivados
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {inactiveUsers.length > 0 && (
            <button onClick={() => setShowInactive(v => !v)}
              className="px-3 py-2 rounded-lg text-xs font-medium hover:opacity-80"
              style={showInactive
                ? { background: 'hsl(38,60%,20%)', color: '#fbbf24', border: '1px solid hsl(38,60%,35%)' }
                : { background: 'hsl(222,47%,16%)', color: 'hsl(215,20%,60%)', border: '1px solid hsl(217,33%,22%)' }}>
              {showInactive ? '← Activos' : `Desactivados (${inactiveUsers.length})`}
            </button>
          )}
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90" style={{ background: 'hsl(217,91%,45%)' }}>
            <UserPlus className="w-4 h-4" /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* KPI row */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { label: 'Total', value: users.length, key: 'all' },
            { label: 'Admin', value: roleCounts.admin || 0, key: 'admin' },
            { label: 'Soporte', value: roleCounts.support || 0, key: 'support' },
            { label: 'Auditor', value: roleCounts.auditor || 0, key: 'auditor' },
            { label: 'Jefe', value: roleCounts.jefe || 0, key: 'jefe' },
            { label: 'Empleado', value: roleCounts.employee || 0, key: 'employee' },
          ].map(k => (
            <button key={k.key} onClick={() => setFilterRole(filterRole === k.key ? 'all' : k.key)}
              className="rounded-xl p-3 text-left transition-opacity hover:opacity-80"
              style={{ background: filterRole === k.key ? 'hsl(217,91%,22%)' : 'hsl(222,47%,12%)', border: `1px solid ${filterRole === k.key ? 'hsl(217,91%,40%)' : 'hsl(217,33%,18%)'}` }}>
              <p className="text-[10px]" style={{ color: 'hsl(215,20%,55%)' }}>{k.label}</p>
              <p className="text-xl font-bold text-white">{k.value}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {!loading && users.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'hsl(215,20%,45%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o email..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' }} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">Cargando usuarios...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No se encontraron usuarios. Asegúrate de tener rol administrador.</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">Sin resultados para "{search}".</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(u => {
            const initials = getInitials(u);
            const color = getAvatarColor(u.email || u.id);
            const roleLabel = (ROLE_LABELS[u.role] || 'Usuario');
            const dept = departments.find(d => d.id === u.department_id);
            const deptName = dept?.name || u.department || '';
            return (
              <div key={u.id} className="rounded-xl p-4 flex items-start gap-3"
                style={{ ...cardStyle, opacity: u.is_active === false ? 0.65 : 1 }}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${color}`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{getDisplayName(u)}</p>
                    {u.is_active === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                        style={{ background: 'hsl(38,60%,18%)', color: '#fbbf24' }}>Inactivo</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{roleLabel}{deptName ? ` · ${deptName}` : ''}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <button onClick={() => navigate(`/UserHistory?email=${encodeURIComponent(u.email)}`)}
                      className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(217,33%,20%)', color: 'hsl(215,20%,70%)' }}>
                      Historial
                    </button>
                    {u.is_active !== false ? (
                      <>
                        <button onClick={() => setEditUser({ ...u })}
                          className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                          style={{ background: 'hsl(217,33%,25%)', color: 'hsl(215,20%,80%)' }}>
                          Editar
                        </button>
                        <button onClick={() => setDeleteId(u.id)}
                          className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                          style={{ background: 'hsl(38,60%,20%)', color: '#fbbf24' }}>
                          Desactivar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleReactivate(u.id)}
                          className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                          style={{ background: 'hsl(142,50%,18%)', color: '#4ade80' }}>
                          Reactivar
                        </button>
                        <button onClick={() => setDeleteId(u.id)}
                          className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                          style={{ background: 'hsl(0,60%,24%)', color: '#f87171' }}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New User Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl p-6 w-full max-w-md" style={modalStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Invitar Usuario</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Correo electrónico</label>
                <input value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} type="email" placeholder="correo@ejemplo.com" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Rol inicial</label>
                <select value={newForm.role} onChange={e => setNewForm(f => ({ ...f, role: e.target.value }))} className={selectCls} style={inputStyle}>
                  <option value="employee">Empleado</option>
                  <option value="support">Soporte</option>
                  <option value="auditor">Auditor</option>
                  <option value="jefe">Jefe de Depto.</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <p className="text-xs" style={{ color: 'hsl(215,20%,45%)' }}>Se enviará una invitación por correo. El usuario podrá configurar su nombre al entrar.</p>
            </div>
            <button onClick={handleInvite} disabled={saving || !newForm.email} className="w-full mt-4 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: 'hsl(217,91%,50%)' }}>
              {saving ? 'Enviando...' : 'Enviar invitación'}
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl p-6 w-full max-w-md" style={modalStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Editar Usuario</h3>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nombre en el sistema</label>
                <input value={editUser.display_name || ''} onChange={e => setE('display_name', e.target.value)} className={inputCls} style={inputStyle} placeholder="Nombre personalizado" />
                <p className="text-[10px] mt-1" style={{ color: 'hsl(215,20%,45%)' }}>Independiente del nombre de Google/SSO</p>
              </div>
              <div>
                <label className={labelCls}>Email (solo lectura)</label>
                <input value={editUser.email || ''} disabled className={inputCls + ' opacity-40 cursor-not-allowed'} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Rol</label>
                <select value={editUser.role || 'employee'} onChange={e => setE('role', e.target.value)} className={selectCls} style={inputStyle}>
                  <option value="employee">Empleado</option>
                  <option value="support">Soporte</option>
                  <option value="auditor">Auditor</option>
                  <option value="jefe">Jefe de Depto.</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Departamento</label>
                <select value={editUser.department_id || ''} onChange={e => setE('department_id', e.target.value)} className={selectCls} style={inputStyle}>
                  <option value="">Sin departamento</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
              <button onClick={handleUpdate} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50" style={{ background: 'hsl(217,91%,50%)' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate / Delete confirm */}
      {deleteId && (() => {
        const target = users.find(u => u.id === deleteId);
        const isInactive = target?.is_active === false;
        const nombre = target?.full_name || target?.email || 'este usuario';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="rounded-xl p-6 w-full max-w-sm" style={modalStyle}>
              <h3 className="text-base font-semibold text-white mb-2">
                {isInactive ? 'Eliminar permanentemente' : 'Desactivar usuario'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {isInactive
                  ? `¿Eliminar a ${nombre} de forma permanente? Esta acción no se puede deshacer.`
                  : `¿Desactivar a ${nombre}? No podrá acceder al sistema. Podrás reactivarlo cuando quieras.`}
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
                <button
                  onClick={() => isInactive ? handleDelete(deleteId) : handleDeactivate(deleteId)}
                  className="px-4 py-2 text-sm rounded-lg text-white font-medium"
                  style={{ background: isInactive ? 'hsl(0,70%,40%)' : 'hsl(38,70%,35%)' }}>
                  {isInactive ? 'Eliminar' : 'Desactivar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}