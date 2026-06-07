import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { DetailModal } from './RequestModals';

const muted = 'hsl(215,20%,55%)';
const PRIORITY_COLORS = {
  'P1 — Crítica': { bg: 'hsl(345,70%,22%)', text: '#fb7185' },
  'P2 — Alta':    { bg: 'hsl(20,84%,22%)',  text: '#fb923c' },
  'P3 — Media':   { bg: 'hsl(38,80%,20%)',  text: '#fbbf24' },
  'P4 — Baja':    { bg: 'hsl(142,60%,18%)', text: '#4ade80' },
};
const STATUS_COLORS = {
  'Pendiente':            '#9ca3af',
  'En Proceso':           '#60a5fa',
  'En Espera':            '#fbbf24',
  'Requiere Información': '#fb923c',
  'En Validación':        '#c084fc',
  'Finalizado':           '#4ade80',
  'Retrasado':            '#f87171',
  'Cancelado':            '#6b7280',
  'Rechazado':            '#fb7185',
};

export default function RequestsTable({ requests, user, users, onRefresh }) {
  const [detailReq, setDetailReq] = useState(null);
  const [history, setHistory] = useState([]);
  const [worklogs, setWorklogs] = useState([]);

  const openDetail = async (req) => {
    const [h, w] = await Promise.all([
      base44.entities.RequestHistory.filter({ request_id: req.id }, '-created_date'),
      base44.entities.Worklog.filter({ request_id: req.id }, '-created_date'),
    ]);
    setHistory(h);
    setWorklogs(w);
    setDetailReq(req);
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)', color: muted }}>
        No hay solicitudes con los filtros seleccionados.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(217,33%,18%)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr style={{ background: 'hsl(222,47%,10%)', borderBottom: '1px solid hsl(217,33%,20%)' }}>
                {['Título', 'Solicitante', 'Tipo', 'Nivel', 'Prioridad', 'Estado', 'Técnico asignado', 'Creado', 'Actualizado', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((req, i) => {
                const pc = PRIORITY_COLORS[req.priority] || PRIORITY_COLORS.Media;
                const statusColor = STATUS_COLORS[req.status] || '#94a3b8';
                return (
                  <tr key={req.id}
                    style={{
                      background: i % 2 === 0 ? 'hsl(222,47%,12%)' : 'hsl(222,47%,11%)',
                      borderBottom: '1px solid hsl(217,33%,16%)',
                    }}
                    className="hover:brightness-110 transition-all cursor-pointer"
                    onClick={() => openDetail(req)}
                  >
                    <td className="px-3 py-2.5 font-medium text-white max-w-[200px]">
                      <span className="truncate block" title={req.title}>{req.title}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: muted }}>{req.requester_name || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: muted }}>{req.request_type || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: muted }}>{req.level || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                        style={{ background: pc.bg, color: pc.text }}>{req.priority}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-semibold" style={{ color: statusColor }}>{req.status}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'hsl(217,91%,70%)' }}>
                      {req.assigned_to_name || <span style={{ color: 'hsl(215,20%,35%)' }}>Sin asignar</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: muted }}>
                      {req.created_date ? new Date(req.created_date).toLocaleDateString('es') : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: muted }}>
                      {req.updated_date ? new Date(req.updated_date).toLocaleDateString('es') : '—'}
                    </td>
                    <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); openDetail(req); }}>
                      <button className="px-2.5 py-1 rounded text-xs font-medium hover:opacity-80 whitespace-nowrap"
                        style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,80%)' }}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailReq && (
        <DetailModal
          request={detailReq}
          history={history}
          worklogs={worklogs}
          onClose={() => setDetailReq(null)}
          user={user}
        />
      )}
    </>
  );
}