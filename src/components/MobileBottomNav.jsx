import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { FileText, AlertTriangle, BarChart2, BookOpen, Menu, History } from 'lucide-react';

export default function MobileBottomNav({ onMenuOpen }) {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingInc, setPendingInc] = useState(0);

  const role = user?.role || 'employee';
  const isStaff = role === 'admin' || role === 'support';
  const canAccessRequests = role === 'admin' || role === 'support' || role === 'jefe' || role === 'auditor';

  useEffect(() => {
    if (!user?.email) return;
    const fetch = () => {
      base44.entities.Incident
        .filter({ status: 'Pendiente' })
        .then(d => setPendingInc((d || []).length))
        .catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [user?.email]);

  const items = [
    ...(canAccessRequests ? [{ path: '/Requests', Icon: FileText, label: 'Solicitudes' }] : []),
    { path: '/Incidents',   Icon: AlertTriangle,  label: 'Incidencias', badge: pendingInc },
    ...(isStaff || role === 'auditor'
      ? [{ path: '/Analysis', Icon: BarChart2, label: 'Análisis' }]
      : [{ path: '/KnowledgeBase', Icon: BookOpen, label: 'Base KB' }]
    ),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t"
      style={{ background: 'hsl(222,47%,9%)', borderColor: 'hsl(217,33%,16%)' }}
    >
      <div
        className="flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map(({ path, Icon, label, badge }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));
          return (
            <Link
              key={path + label}
              to={path}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors relative"
              style={{
                minHeight: 56,
                color: isActive ? 'hsl(217,91%,70%)' : 'hsl(215,20%,55%)',
              }}
            >
              {isActive && (
                <div
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full"
                  style={{ background: 'hsl(217,91%,60%)' }}
                />
              )}
              <div className="relative">
                <Icon className="w-6 h-6" />
                {badge > 0 && (
                  <span
                    className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{ background: 'hsl(0,84%,50%)' }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        {/* Empleados: Historial propio | Staff: Menú lateral */}
        {role === 'employee' ? (
          (() => {
            const isActive = location.pathname === '/UserHistory';
            return (
              <Link
                to="/UserHistory"
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors relative"
                style={{ minHeight: 56, color: isActive ? 'hsl(217,91%,70%)' : 'hsl(215,20%,55%)' }}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: 'hsl(217,91%,60%)' }} />
                )}
                <History className="w-6 h-6" />
                <span className="text-xs font-medium leading-none">Historial</span>
              </Link>
            );
          })()
        ) : (
          <button
            onClick={onMenuOpen}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors active:bg-white/5"
            style={{ minHeight: 56, color: 'hsl(215,20%,55%)' }}
          >
            <Menu className="w-6 h-6" />
            <span className="text-xs font-medium leading-none">Menú</span>
          </button>
        )}
      </div>
    </nav>
  );
}
