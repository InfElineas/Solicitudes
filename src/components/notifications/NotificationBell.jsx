import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { Bell, CheckCheck, X, MessageSquare, UserCheck, Shield, AlertTriangle } from 'lucide-react';

// ── Sonido de notificación via Web Audio API (sin archivos externos) ──────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Doble tono descendente estilo "ding"
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

// ── Icono según tipo ──────────────────────────────────────────────────────────
function TypeIcon({ type }) {
  if (type === 'assigned')      return <UserCheck    className="w-3.5 h-3.5 text-blue-400   shrink-0" />;
  if (type === 'status_change') return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
  if (type === 'guardia_turno') return <Shield        className="w-3.5 h-3.5 text-green-400  shrink-0" />;
  return                               <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
}

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen]                   = useState(false);
  const ref                               = useRef();
  const seenIds                           = useRef(new Set());
  const permissionAsked                   = useRef(false);

  const unread = notifications.filter(n => !n.is_read).length;

  // ── Solicitar permiso de notificaciones del navegador una vez ─────────────
  useEffect(() => {
    if (permissionAsked.current) return;
    permissionAsked.current = true;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── Mostrar push notification via Service Worker ──────────────────────────
  const firePush = async (n) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(n.title || 'Nueva notificación', {
          body:   n.message || '',
          icon:   '/favicon.png',
          badge:  '/favicon.png',
          tag:    n.id,
          data:   { url: window.location.origin, requestId: n.request_id || null },
          requireInteraction: false,
        });
        return;
      }
      new Notification(n.title || 'Nueva notificación', {
        body: n.message || '',
        icon: '/favicon.png',
        tag:  n.id,
      });
    } catch {}
  };

  // ── Procesar notificación nueva (realtime o poll) ─────────────────────────
  const handleNew = (n) => {
    if (seenIds.current.has(n.id)) return;
    seenIds.current.add(n.id);
    if (!n.is_read) {
      firePush(n);
      playNotificationSound();
    }
  };

  // ── Carga inicial (poll) ──────────────────────────────────────────────────
  const load = async () => {
    if (!user?.email) return;
    try {
      const data = await base44.entities.Notification.filter(
        { user_id: user.email }, '-created_date', 30,
      );
      setNotifications(data);

      // Primera carga: seed seenIds sin disparar sonido/push
      if (seenIds.current.size === 0) {
        data.forEach(n => seenIds.current.add(n.id));
        return;
      }
      data.forEach(handleNew);
    } catch {}
  };

  // ── Suscripción Realtime + poll de respaldo cada 60 s ────────────────────
  useEffect(() => {
    if (!user?.email) return;

    load();

    // Supabase Realtime: llega en <1 s incluso con la pestaña en segundo plano
    // (WebSockets no son limitados por el throttle de timers del navegador)
    const channel = supabase
      .channel(`notif-${user.email}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.email}`,
        },
        (payload) => {
          const n = payload.new;
          setNotifications(prev =>
            prev.find(x => x.id === n.id) ? prev : [n, ...prev].slice(0, 30),
          );
          handleNew(n);
        },
      )
      .subscribe();

    // Poll de respaldo por si el canal se desconecta
    const interval = setInterval(load, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.email]);

  // ── Cerrar al hacer clic fuera ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const markAllRead = async () => {
    const pending = notifications.filter(n => !n.is_read);
    await Promise.all(pending.map(n =>
      base44.entities.Notification.update(n.id, { is_read: true }),
    ));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (n) => {
    if (n.is_read) return;
    await base44.entities.Notification.update(n.id, { is_read: true });
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
  };

  const remove = async (e, n) => {
    e.stopPropagation();
    await base44.entities.Notification.delete(n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        style={{ color: 'hsl(215,20%,55%)' }}
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: 'hsl(217,91%,50%)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 320, background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)' }}
        >
          {/* Encabezado */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid hsl(217,33%,20%)' }}
          >
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs hover:text-white transition-colors"
                style={{ color: 'hsl(215,20%,55%)' }}
              >
                <CheckCheck className="w-3.5 h-3.5" /> Marcar todo leído
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(215,20%,35%)' }} />
                <p className="text-xs" style={{ color: 'hsl(215,20%,45%)' }}>Sin notificaciones</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n)}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                  style={{
                    borderBottom: '1px solid hsl(217,33%,16%)',
                    background: !n.is_read ? 'hsl(217,60%,14%)' : undefined,
                  }}
                >
                  <div className="mt-0.5">
                    <TypeIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug">{n.title}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'hsl(215,20%,55%)' }}>
                      {n.message}
                    </p>
                    {n.request_title && (
                      <p className="text-[10px] mt-0.5 truncate text-blue-400">{n.request_title}</p>
                    )}
                    <p className="text-[10px] mt-1" style={{ color: 'hsl(215,20%,40%)' }}>
                      {n.created_date
                        ? new Date(n.created_date).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
                        : ''}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: 'hsl(217,91%,55%)' }}
                    />
                  )}
                  <button
                    onClick={e => remove(e, n)}
                    className="text-gray-600 hover:text-red-400 transition-colors mt-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
