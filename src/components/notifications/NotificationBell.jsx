import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCheck, X, MessageSquare, UserCheck } from 'lucide-react';

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();
  /** @type {React.MutableRefObject<Set<string>>} */
  const seenIds = useRef(new Set());
  const permissionRequested = useRef(false);

  const unread = notifications.filter(n => !n.is_read).length;

  // Request browser notification permission once
  useEffect(() => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /** Fire a browser push notification if permission granted */
  const firePush = (/** @type {any} */ n) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(n.title || 'Nueva notificación', {
        body: n.message || '',
        icon: '/favicon.ico',
        tag: n.id, // prevents duplicate if browser deduplicates
      });
    } catch {}
  };

  const load = () => {
    if (!user?.email) return;
    base44.entities.Notification.filter({ user_id: user.email }, '-created_date', 30)
      .then((/** @type {any[]} */ data) => {
        setNotifications(data);

        // On first load just seed seenIds without firing notifications
        if (seenIds.current.size === 0) {
          data.forEach(n => seenIds.current.add(n.id));
          return;
        }

        // On subsequent polls: fire push for any new unread notification
        data.forEach(n => {
          if (!seenIds.current.has(n.id)) {
            seenIds.current.add(n.id);
            if (!n.is_read) firePush(n);
          }
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // Poll every 30s for new notifications
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user?.email]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.is_read);
    await Promise.all(unreadItems.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
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

  const TypeIcon = ({ type }) => type === 'assigned'
    ? <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
    : <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />;

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
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: 'hsl(217,91%,50%)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 320, background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,22%)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid hsl(217,33%,20%)' }}>
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs hover:text-white transition-colors" style={{ color: 'hsl(215,20%,55%)' }}>
                <CheckCheck className="w-3.5 h-3.5" /> Marcar todo leído
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(215,20%,35%)' }} />
                <p className="text-xs" style={{ color: 'hsl(215,20%,45%)' }}>Sin notificaciones</p>
              </div>
            ) : notifications.map(n => (
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
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'hsl(215,20%,55%)' }}>{n.message}</p>
                  {n.request_title && (
                    <p className="text-[10px] mt-0.5 truncate text-blue-400">{n.request_title}</p>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: 'hsl(215,20%,40%)' }}>
                    {n.created_date ? new Date(n.created_date).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                  </p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: 'hsl(217,91%,55%)' }} />}
                <button onClick={e => remove(e, n)} className="text-gray-600 hover:text-red-400 transition-colors mt-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}