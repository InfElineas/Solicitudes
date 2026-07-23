import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import {
  Bell, CheckCheck, X, MessageSquare, UserCheck, Shield,
  AlertTriangle, Clock, Trash2, CheckCircle2, Info,
} from 'lucide-react';

// ── Sonido ─────────────────────────────────────────────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [660, 0.15]].forEach(([freq, delay]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    });
  } catch {}
}

// ── Tiempo relativo ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7)  return `hace ${d} días`;
  return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

// ── Config de tipos ────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  assigned:      { icon: UserCheck,     color: '#60a5fa', bg: 'hsl(217,60%,20%)', label: 'Asignación' },
  status_change: { icon: AlertTriangle, color: '#fbbf24', bg: 'hsl(38,60%,18%)',  label: 'Estado'     },
  guardia_turno: { icon: Shield,        color: '#4ade80', bg: 'hsl(142,50%,16%)', label: 'Guardia'    },
  resolved:      { icon: CheckCircle2,  color: '#4ade80', bg: 'hsl(142,50%,16%)', label: 'Resuelto'   },
  comment:       { icon: MessageSquare, color: '#c084fc', bg: 'hsl(270,50%,20%)', label: 'Comentario' },
  info:          { icon: Info,          color: '#94a3b8', bg: 'hsl(217,33%,18%)', label: 'Info'       },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.info;
}

// ── Icono con fondo de color ───────────────────────────────────────────────────
function TypeBadge({ type }) {
  const cfg = getTypeConfig(type);
  const Icon = cfg.icon;
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: cfg.bg }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
    </div>
  );
}

// ── Ruta de navegación según tipo ─────────────────────────────────────────────
function resolveRoute(n) {
  if (n.request_id) return '/Requests';
  if (n.type === 'guardia_turno') return '/Guards';
  return null;
}

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState('all'); // 'all' | 'unread'
  const [hoveredId, setHoveredId] = useState(null);
  const ref               = useRef();
  const seenIds           = useRef(new Set());
  const permissionAsked   = useRef(false);
  const navigate          = useNavigate();

  const unread = notifications.filter(n => !n.is_read).length;
  const visible = tab === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  // ── Permisos browser ──────────────────────────────────────────────────────
  useEffect(() => {
    if (permissionAsked.current) return;
    permissionAsked.current = true;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── Push browser ──────────────────────────────────────────────────────────
  const firePush = async (n) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const opts = { body: n.message || '', icon: '/favicon.png', tag: n.id };
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(n.title || 'Nueva notificación', {
          ...opts, badge: '/favicon.png', requireInteraction: false,
        });
      } else {
        new Notification(n.title || 'Nueva notificación', opts);
      }
    } catch {}
  };

  // ── Nueva notificación ────────────────────────────────────────────────────
  const handleNew = useCallback((n) => {
    if (seenIds.current.has(n.id)) return;
    seenIds.current.add(n.id);
    if (!n.is_read) { firePush(n); playNotificationSound(); }
  }, []);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.email) return;
    try {
      const data = await base44.entities.Notification.filter(
        { user_id: user.email }, '-created_date', 50,
      );
      const isFirstLoad = seenIds.current.size === 0;
      // Issue 2: clear and repopulate so the Set stays bounded
      seenIds.current.clear();
      data.forEach(n => seenIds.current.add(n.id));
      setNotifications(data);
      if (!isFirstLoad) {
        data.forEach(handleNew);
      }
    } catch {}
  }, [user?.email, handleNew]);

  // ── Realtime + poll ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.email) return;
    let channel;
    // Issue 1: subscribe only after initial load to avoid duplicates during fetch window
    load().then(() => {
      channel = supabase
        .channel(`notif-${user.email}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.email}`,
        }, (payload) => {
          const n = payload.new;
          if (seenIds.current.has(n.id)) return;
          setNotifications(prev =>
            prev.find(x => x.id === n.id) ? prev : [n, ...prev].slice(0, 50),
          );
          handleNew(n);
        })
        .subscribe();
    });
    const interval = setInterval(load, 60_000);
    return () => { channel?.unsubscribe(); clearInterval(interval); };
  }, [user?.email]);

  // ── Cerrar al click fuera ─────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const markRead = async (n) => {
    if (n.is_read) return;
    await base44.entities.Notification.update(n.id, { is_read: true }).catch(() => {});
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
  };

  const markAllRead = async () => {
    const pending = notifications.filter(n => !n.is_read);
    await Promise.all(pending.map(n =>
      base44.entities.Notification.update(n.id, { is_read: true }).catch(() => {}),
    ));
    // Issue 3: mark all local items read; unread derived from this state will become 0,
    // covering also any unloaded notifications updated by the DB call.
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const remove = async (e, n) => {
    e.stopPropagation();
    await base44.entities.Notification.delete(n.id).catch(() => {});
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  };

  const clearAll = async () => {
    await Promise.all(notifications.map(n =>
      base44.entities.Notification.delete(n.id).catch(() => {}),
    ));
    setNotifications([]);
  };

  const handleClick = async (n) => {
    await markRead(n);
    const route = resolveRoute(n);
    if (route) { setOpen(false); navigate(route); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={ref}>
      {/* Campana */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        style={{ color: open ? 'white' : 'hsl(215,20%,55%)', width: 44, height: 44 }}
        title="Notificaciones"
      >
        <Bell className={`w-5 h-5 transition-transform ${unread > 0 ? 'animate-[wiggle_1.5s_ease-in-out_infinite]' : ''}`} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: '#ef4444' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-11 z-50 rounded-xl shadow-2xl flex flex-col"
          style={{
            width: 360,
            maxHeight: 520,
            background: 'hsl(222,47%,11%)',
            border: '1px solid hsl(217,33%,22%)',
          }}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid hsl(217,33%,18%)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">
                Notificaciones
                {unread > 0 && (
                  <span
                    className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'hsl(0,70%,22%)', color: '#f87171' }}
                  >
                    {unread} nueva{unread !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] hover:bg-white/10 transition-colors"
                    style={{ color: 'hsl(215,20%,55%)' }}
                    title="Marcar todo como leído"
                  >
                    <CheckCheck className="w-3 h-3" /> Todo leído
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    style={{ color: 'hsl(215,20%,45%)' }}
                    title="Limpiar todo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1">
              {[
                { id: 'all',    label: 'Todas' },
                { id: 'unread', label: `No leídas${unread > 0 ? ` (${unread})` : ''}` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: tab === t.id ? 'hsl(217,91%,30%)' : 'transparent',
                    color: tab === t.id ? 'white' : 'hsl(215,20%,50%)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {visible.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(215,20%,25%)' }} />
                <p className="text-xs" style={{ color: 'hsl(215,20%,40%)' }}>
                  {tab === 'unread' ? 'Todo al día ✓' : 'Sin notificaciones'}
                </p>
              </div>
            ) : (
              visible.map(n => {
                const route = resolveRoute(n);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors group"
                    style={{
                      borderBottom: '1px solid hsl(217,33%,15%)',
                      background: hoveredId === n.id ? 'hsl(217,33%,16%)' : !n.is_read ? 'hsl(217,50%,13%)' : 'transparent',
                      cursor: route ? 'pointer' : 'default',
                    }}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <TypeBadge type={n.type} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold leading-snug" style={{ color: n.is_read ? 'hsl(215,20%,70%)' : 'white' }}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span
                            className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                            style={{ background: '#3b82f6' }}
                          />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-[11px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'hsl(215,20%,50%)' }}>
                          {n.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-2.5 h-2.5" style={{ color: 'hsl(215,20%,35%)' }} />
                        <span className="text-[10px]" style={{ color: 'hsl(215,20%,40%)' }}>
                          {timeAgo(n.created_date)}
                        </span>
                        {route && (
                          <span className="text-[10px]" style={{ color: 'hsl(217,91%,55%)' }}>
                            Ver →
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={e => remove(e, n)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:text-red-400 focus:text-red-400 transition-all mt-0.5 shrink-0"
                      style={{ color: 'hsl(215,20%,40%)' }}
                      title="Eliminar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-2 text-center"
              style={{ borderTop: '1px solid hsl(217,33%,18%)' }}
            >
              <span className="text-[10px]" style={{ color: 'hsl(215,20%,35%)' }}>
                {notifications.length} notificación{notifications.length !== 1 ? 'es' : ''} · últimas 50
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
