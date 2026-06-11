import { useState, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';
import { base44 } from '@/api/base44Client';
import { Camera, Lock, Building2, Save, X, Eye, EyeOff, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const labelCls = "text-xs font-medium text-gray-400 mb-1 block";

const AVATAR_COLORS = ['bg-pink-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-cyan-500', 'bg-red-500', 'bg-yellow-500'];

/** @param {{ user: any, departments?: any[], onClose: () => void, onSaved?: (updated: any) => void, onLogout?: () => void }} props */
export default function UserProfileModal({ user, departments = [], onClose, onSaved, onLogout }) {
  const [tab, setTab] = useState('profile');
  const [name, setName] = useState(user?.display_name || user?.full_name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef(/** @type {HTMLInputElement|null} */ (null));

  const initials = name
    ? name.split(' ').map((/** @type {string} */ n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase();
  const avatarColor = AVATAR_COLORS[(user?.email?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

  const handleAvatarUpload = async (/** @type {import('react').ChangeEvent<HTMLInputElement>} */ e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('El archivo no puede superar 5MB'); return; }
    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('URL no retornada');
      setAvatarUrl(file_url);
      toast.success('Imagen cargada');
    } catch {
      toast.error('Error al subir imagen');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error('El nombre no puede estar vacío'); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ display_name: name.trim(), department, avatar_url: avatarUrl })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Perfil actualizado');
      onSaved?.({ display_name: name.trim(), full_name: name.trim(), department, avatar_url: avatarUrl });
    } catch (/** @type {any} */ err) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Contraseña actualizada correctamente');
      setNewPassword(''); setConfirmPassword('');
    } catch (/** @type {any} */ err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'profile', label: 'Perfil', icon: '👤' },
    { key: 'password', label: 'Contraseña', icon: '🔐' },
    { key: 'department', label: 'Departamento', icon: '🏢' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl sm:rounded-xl w-full max-w-md shadow-2xl overflow-y-auto"
        style={{ background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)', maxHeight: '92dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(217,33%,30%)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-3 sm:pt-5 pb-4 border-b" style={{ borderColor: 'hsl(217,33%,22%)' }}>
          <h3 className="text-base font-semibold text-white">Mi Perfil</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Avatar section */}
        <div className="flex flex-col items-center py-5 border-b" style={{ borderColor: 'hsl(217,33%,22%)' }}>
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold ${avatarColor}`}>
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity"
              style={{ background: 'hsl(217,91%,50%)' }}
              title="Cambiar foto"
            >
              <Camera className="w-3 h-3" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          {uploadingAvatar && <p className="text-xs mt-2" style={{ color: 'hsl(215,20%,55%)' }}>Subiendo imagen...</p>}
          <p className="text-sm font-semibold text-white mt-2">{user?.full_name || 'Sin nombre'}</p>
          <p className="text-xs" style={{ color: 'hsl(215,20%,55%)' }}>{user?.email}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'hsl(217,33%,22%)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === t.key ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* PROFILE TAB */}
          {tab === 'profile' && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nombre en el sistema</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Tu nombre en la plataforma" />
                <p className="text-[10px] mt-1" style={{ color: 'hsl(215,20%,45%)' }}>Este nombre se mostrará en toda la app (no modifica tu cuenta de Google).</p>
              </div>
              <div>
                <label className={labelCls}>Nombre de cuenta</label>
                <input value={user?.full_name || ''} disabled
                  className={inputCls + ' opacity-40 cursor-not-allowed'} style={inputStyle}
                  title="Nombre sincronizado desde tu cuenta de acceso (solo lectura)" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input value={user?.email || ''} disabled
                  className={inputCls + ' opacity-50 cursor-not-allowed'} style={inputStyle} />
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={handleSaveProfile} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60 hover:opacity-90"
                  style={{ background: 'hsl(217,91%,50%)' }}>
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {/* PASSWORD TAB */}
          {tab === 'password' && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nueva contraseña</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className={inputCls + ' pr-10'} style={inputStyle} placeholder="Mínimo 6 caracteres" />
                  <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Confirmar contraseña</label>
                <input type={showPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Repite la contraseña" />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400">Las contraseñas no coinciden</p>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={handleChangePassword} disabled={saving || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 hover:opacity-90"
                  style={{ background: 'hsl(217,91%,50%)' }}>
                  <Lock className="w-3.5 h-3.5" /> {saving ? 'Actualizando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          )}

          {/* DEPARTMENT TAB */}
          {tab === 'department' && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Departamento actual</label>
                {departments.length > 0 ? (
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className={inputCls + ' cursor-pointer'} style={inputStyle}>
                    <option value="">Sin departamento</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                ) : (
                  <input value={department} onChange={e => setDepartment(e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="Nombre de departamento" />
                )}
              </div>
              {department && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'hsl(217,91%,15%)', border: '1px solid hsl(217,91%,25%)' }}>
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-300">{department}</span>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={handleSaveProfile} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60 hover:opacity-90"
                  style={{ background: 'hsl(217,91%,50%)' }}>
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cerrar sesión — acceso rápido en mobile */}
        {onLogout && (
          <div className="px-6 pb-5 pt-0 sm:hidden">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'hsl(0,40%,18%)', color: '#fca5a5', border: '1px solid hsl(0,40%,28%)' }}
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
