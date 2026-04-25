import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const selectCls = inputCls + " cursor-pointer";
const labelCls = "text-xs font-medium text-gray-400 mb-1 block";
const modalStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' };
const cardStyle = { background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' };

/** @type {Record<string, string>} */
const ROLE_LABELS = { admin: 'Administrador', support: 'Soporte', employee: 'Empleado', jefe: 'Jefe de Depto.', user: 'Usuario' };
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
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [newForm, setNewForm] = useState({ email: '', role: 'employee' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const loadUsers = async () => {
    setLoading(true);
    const data = await base44.entities.User.list();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);
    await base44.entities.User.update(editUser.id, {
      role: editUser.role,
      display_name: editUser.display_name,
    });
    toast.success('Usuario actualizado');
    setSaving(false);
    setEditUser(null);
    loadUsers();
  };

  const handleInvite = async () => {
    if (!newForm.email) return;
    setSaving(true);
    const platformRole = (newForm.role === 'admin' || newForm.role === 'superadmin') ? 'admin' : 'user';
    await base44.users.inviteUser(newForm.email, platformRole);
    toast.success('Invitación enviada');
    setSaving(false);
    setShowNew(false);
    setTimeout(loadUsers, 1500);
  };

  const handleDelete = async (id) => {
    await base44.entities.User.delete(id);
    toast.success('Usuario eliminado');
    setDeleteId(null);
    loadUsers();
  };

  const setE = (k, v) => setEditUser(u => ({ ...u, [k]: v }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Gestión de Usuarios</h2>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90" style={{ background: 'hsl(217,91%,45%)' }}>
          <UserPlus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Cargando usuarios...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No se encontraron usuarios. Asegúrate de tener rol administrador.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {users.map(u => {
            const initials = getInitials(u);
            const color = getAvatarColor(u.email || u.id);
            const roleLabel = (ROLE_LABELS[u.role] || 'Usuario');
            return (
              <div key={u.id} className="rounded-xl p-4 flex items-start gap-3" style={cardStyle}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${color}`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{getDisplayName(u)}</p>
                  <p className="text-xs text-gray-400">{roleLabel}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <button onClick={() => navigate(`/UserHistory?email=${encodeURIComponent(u.email)}`)}
                      className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(217,33%,20%)', color: 'hsl(215,20%,70%)' }}>
                      Historial
                    </button>
                    <button onClick={() => setEditUser({ ...u })}
                      className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(217,33%,25%)', color: 'hsl(215,20%,80%)' }}>
                      Editar
                    </button>
                    <button onClick={() => setDeleteId(u.id)}
                      className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(0,60%,30%)', color: '#f87171' }}>
                      Eliminar
                    </button>
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
                  <option value="jefe">Jefe de Depto.</option>
                  <option value="admin">Administrador</option>
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

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl p-6 w-full max-w-sm" style={modalStyle}>
            <h3 className="text-base font-semibold text-white mb-2">Eliminar usuario</h3>
            <p className="text-sm text-gray-400 mb-4">Esta acción no puede deshacerse.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm rounded-lg text-white font-medium" style={{ background: 'hsl(0,70%,40%)' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}