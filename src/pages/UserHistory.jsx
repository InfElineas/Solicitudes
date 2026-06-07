import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, AlertTriangle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };
const muted = 'hsl(215,20%,55%)';

const STATUS_COLORS = {
  // Solicitudes — Protocolo v1.0
  'Pendiente': '#9ca3af', 'En Proceso': '#60a5fa', 'En Espera': '#fbbf24',
  'Requiere Información': '#fb923c', 'En Validación': '#c084fc',
  'Finalizado': '#4ade80', 'Retrasado': '#f87171', 'Cancelado': '#6b7280', 'Rechazado': '#fb7185',
  // Incidencias
  'En atención': '#3b82f6', 'Resuelto': '#4ade80', 'No reproducible': '#94a3b8',
};

export default function UserHistory() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('requests');

  // Get target user from URL params
  const params = new URLSearchParams(window.location.search);
  const targetEmail = params.get('email');

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const isAdminViewing = (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && targetEmail;
  const viewEmail = targetEmail || currentUser?.email;

  const { data: requests = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['user-requests', viewEmail],
    queryFn: () => base44.entities.Request.filter({ requester_id: viewEmail, is_deleted: false }, '-created_date', 100),
    enabled: !!viewEmail,
  });

  const { data: incidents = [], isLoading: loadingInc } = useQuery({
    queryKey: ['user-incidents', viewEmail],
    queryFn: () => base44.entities.Incident.filter({ reporter_email: viewEmail }, '-created_date', 100),
    enabled: !!viewEmail,
  });

  const tabStyle = (t) => ({
    color: activeTab === t ? 'white' : muted,
    borderBottom: activeTab === t ? '2px solid hsl(217,91%,60%)' : '2px solid transparent',
    paddingBottom: 8,
    cursor: 'pointer',
    fontWeight: activeTab === t ? 700 : 400,
    fontSize: 13,
    background: 'none',
    border: 'none',
    outline: 'none',
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/Requests" className="flex items-center gap-1 text-xs hover:text-white transition-colors" style={{ color: muted }}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Historial de actividad</h1>
          {targetEmail && <p className="text-xs mt-0.5" style={{ color: muted }}>Usuario: {targetEmail}</p>}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
          <FileText className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-white">{requests.length}</p>
            <p className="text-xs" style={{ color: muted }}>Solicitudes realizadas</p>
          </div>
        </div>
        <div className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-white">{incidents.length}</p>
            <p className="text-xs" style={{ color: muted }}>Incidencias registradas</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: 'hsl(217,33%,18%)' }}>
        <button style={tabStyle('requests')} onClick={() => setActiveTab('requests')}>
          Solicitudes ({requests.length})
        </button>
        <button style={tabStyle('incidents')} onClick={() => setActiveTab('incidents')}>
          Incidencias ({incidents.length})
        </button>
      </div>

      {activeTab === 'requests' && (
        loadingReqs ? (
          <div className="text-center py-10" style={{ color: muted }}>Cargando...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={{ ...cardStyle, color: muted }}>Sin solicitudes registradas</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(217,33%,18%)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'hsl(222,47%,10%)', borderBottom: '1px solid hsl(217,33%,20%)' }}>
                  {['Título', 'Tipo', 'Prioridad', 'Estado', 'Técnico asignado', 'Fecha'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium" style={{ color: muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((req, i) => (
                  <tr key={req.id} style={{ background: i % 2 === 0 ? 'hsl(222,47%,12%)' : 'hsl(222,47%,11%)', borderBottom: '1px solid hsl(217,33%,16%)' }}>
                    <td className="px-3 py-2.5 font-medium text-white max-w-[220px]">
                      <span className="truncate block" title={req.title}>{req.title}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: muted }}>{req.request_type || '—'}</td>
                    <td className="px-3 py-2.5" style={{ color: muted }}>{req.priority || '—'}</td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: STATUS_COLORS[req.status] || '#94a3b8' }}>{req.status}</td>
                    <td className="px-3 py-2.5" style={{ color: 'hsl(217,91%,70%)' }}>{req.assigned_to_name || <span style={{ color: 'hsl(215,20%,35%)' }}>Sin asignar</span>}</td>
                    <td className="px-3 py-2.5" style={{ color: muted }}>
                      {req.created_date ? new Date(req.created_date).toLocaleDateString('es') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'incidents' && (
        loadingInc ? (
          <div className="text-center py-10" style={{ color: muted }}>Cargando...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={{ ...cardStyle, color: muted }}>Sin incidencias registradas</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(217,33%,18%)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'hsl(222,47%,10%)', borderBottom: '1px solid hsl(217,33%,20%)' }}>
                  {['Herramienta', 'Categoría', 'Impacto', 'Estado', 'Técnico', 'Fecha'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium" style={{ color: muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc, i) => (
                  <tr key={inc.id} style={{ background: i % 2 === 0 ? 'hsl(222,47%,12%)' : 'hsl(222,47%,11%)', borderBottom: '1px solid hsl(217,33%,16%)' }}>
                    <td className="px-3 py-2.5 font-medium text-white">{inc.tool_name}</td>
                    <td className="px-3 py-2.5" style={{ color: muted }}>{inc.category || '—'}</td>
                    <td className="px-3 py-2.5" style={{ color: muted }}>{inc.impact?.split(' - ')[0] || '—'}</td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: STATUS_COLORS[inc.status] || '#94a3b8' }}>{inc.status}</td>
                    <td className="px-3 py-2.5" style={{ color: 'hsl(217,91%,70%)' }}>{inc.assigned_to_name || <span style={{ color: 'hsl(215,20%,35%)' }}>Sin asignar</span>}</td>
                    <td className="px-3 py-2.5" style={{ color: muted }}>
                      {inc.created_date ? new Date(inc.created_date).toLocaleDateString('es') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}