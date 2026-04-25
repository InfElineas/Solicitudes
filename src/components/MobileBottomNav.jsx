import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { FileText, AlertTriangle, BarChart2, BookOpen, Menu } from 'lucide-react';

export default function MobileBottomNav({ onMenuOpen }) {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingInc, setPendingInc] = useState(0);

  const role = user?.role || 'employee';
  const isStaff = role === 'admin' || role === 'support';
  const canAccessRequests = role === 'admin' || role === 'support' || role === 'jefe';

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.Incident
      .filter({ status: 'Pendiente' })
      .then(d => setPendingInc((d || []).length))
      .catch(() => {});
  }, [user?.email]);

  const items = [
    ...(canAccessRequests ? [{ path: '/Requests', Icon: FileText, label: 'Solicitudes' }] : []),
    { path: '/Incidents',   Icon: AlertTriangle,  label: 'Incidencias', badge: pendingInc },
    ...(isStaff
      ? [{ path: '/Analysis', Icon: BarChart2, label: 'Análisis' }]
      : [{ path: '/KnowledgeBase', Icon: BookOpen, label: 'Base KB' }]
    ),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t safe-area-bottom"
      style={{ background: 'hsl(222,47%,9%)', borderColor: 'hsl(217,33%,16%)' }}
    >
      <div className="flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {items.map(({ path, Icon, label, badge }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path + label}
              to={path}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-colors relative"
              style={{ color: isActive ? 'hsl(217,91%,70%)' : 'hsl(215,20%,55%)' }}
            >
              {isActive && (
                <div
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full"
                  style={{ background: 'hsl(217,91%,60%)' }}
                />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                    style={{ background: 'hsl(0,84%,50%)' }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        {/* Menú — opens sidebar */}
        <button
          onClick={onMenuOpen}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-colors"
          style={{ color: 'hsl(215,20%,55%)' }}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">Menú</span>
        </button>
      </div>
    </nav>
  );
}
