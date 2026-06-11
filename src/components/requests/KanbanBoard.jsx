import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { sendFinalizadaEmail, sendEnProcesoEmail, sendRequiereInfoEmail } from '@/services/emailNotifications';
import { getSLAInfo, SEMAPHORE_COLOR } from '@/lib/slaUtils';
import EvidenceModal from './EvidenceModal';
import {
  ClassifyModal,
  AssignModal,
  RejectModal,
  DetailModal,
  BlockedModal,
} from './RequestModals';

// Protocolo Operativo v1.0 — 9 estados
const COLUMNS = [
  { key: 'Pendiente',            label: 'Pendiente',            color: '#9ca3af', bg: 'hsl(220,15%,18%)' },
  { key: 'En Proceso',           label: 'En Proceso',           color: '#60a5fa', bg: 'hsl(217,60%,18%)' },
  { key: 'En Espera',            label: 'En Espera',            color: '#fbbf24', bg: 'hsl(38,80%,18%)' },
  { key: 'Requiere Información', label: 'Requiere Info.',       color: '#fb923c', bg: 'hsl(25,80%,18%)' },
  { key: 'En Validación',        label: 'En Validación',        color: '#c084fc', bg: 'hsl(270,60%,20%)' },
  { key: 'Finalizado',           label: 'Finalizado',           color: '#4ade80', bg: 'hsl(142,60%,16%)' },
  { key: 'Retrasado',            label: 'Retrasado',            color: '#f87171', bg: 'hsl(0,60%,18%)' },
  { key: 'Cancelado',            label: 'Cancelado',            color: '#6b7280', bg: 'hsl(220,15%,15%)' },
  { key: 'Rechazado',            label: 'Rechazado',            color: '#fb7185', bg: 'hsl(345,60%,18%)' },
];

const PRIORITY_COLORS = {
  'P1 — Crítica': { bg: 'hsl(345,70%,22%)', text: '#fb7185' },
  'P2 — Alta':    { bg: 'hsl(20,84%,22%)',  text: '#fb923c' },
  'P3 — Media':   { bg: 'hsl(38,80%,20%)',  text: '#fbbf24' },
  'P4 — Baja':    { bg: 'hsl(142,60%,18%)', text: '#4ade80' },
};

// Transiciones válidas — Protocolo Operativo v1.0
const TRANSITIONS = {
  'Pendiente':            ['En Proceso', 'En Espera', 'Requiere Información', 'Rechazado', 'Cancelado'],
  'En Proceso':           ['En Espera', 'Requiere Información', 'En Validación', 'Retrasado', 'Cancelado'],
  'En Espera':            ['En Proceso', 'En Validación', 'Cancelado'],
  'Requiere Información': ['En Proceso', 'En Validación', 'Cancelado'],
  'En Validación':        ['Finalizado', 'En Proceso'],
  'Retrasado':            ['En Proceso', 'En Validación', 'Cancelado'],
  'Finalizado':           [],
  'Cancelado':            [],
  'Rechazado':            [],
};

function KanbanCard({ req, index, user, users, onRefresh }) {
  const [modal, setModal] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [history, setHistory] = useState([]);
  const [worklogs, setWorklogs] = useState([]);

  const pc = PRIORITY_COLORS[req.priority] || PRIORITY_COLORS['P3 — Media'];
  const sla = getSLAInfo(req);
  const saved = () => { setModal(null); onRefresh(); };

  const openDetail = async (e) => {
    e.stopPropagation();
    const [h, w] = await Promise.all([
      base44.entities.RequestHistory.filter({ request_id: req.id }, '-created_date'),
      base44.entities.Worklog.filter({ request_id: req.id }, '-created_date'),
    ]);
    setHistory(h);
    setWorklogs(w);
    setModal('detail');
  };

  return (
    <Draggable draggableId={req.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="rounded-xl p-3 mb-2 cursor-grab active:cursor-grabbing select-none transition-shadow"
          style={{
            background: snapshot.isDragging ? 'hsl(222,47%,20%)' : 'hsl(222,47%,15%)',
            border: `1px solid ${snapshot.isDragging ? 'hsl(217,91%,40%)' : 'hsl(217,33%,22%)'}`,
            boxShadow: snapshot.isDragging ? '0 8px 25px rgba(0,0,0,0.4)' : undefined,
            ...provided.draggableProps.style,
          }}
          onClick={(e) => openDetail(e)}
        >
          {/* Priority badge */}
          <div className="flex items-start justify-between gap-1 mb-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: pc.bg, color: pc.text }}>
              {req.priority}
            </span>
            {req.level && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,65%)' }}>
                N{req.level}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-xs font-semibold text-white leading-snug mb-1.5 line-clamp-2">{req.title}</p>

          {/* Meta */}
          <div className="text-[10px] space-y-0.5" style={{ color: 'hsl(215,20%,50%)' }}>
            {req.assigned_to_name && (
              <p className="truncate">👤 {req.assigned_to_name}</p>
            )}
            {req.department_names?.length > 0 && (
              <p className="truncate">🏢 {req.department_names.join(', ')}</p>
            )}
            {req.estimated_due && (
              <p>📅 {new Date(req.estimated_due).toLocaleDateString('es')}</p>
            )}
          </div>

          {/* SLA bar */}
          {sla.semaphore !== 'closed' && sla.semaphore !== 'unknown' && (
            <div className="mt-1.5 space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-semibold" style={{ color: SEMAPHORE_COLOR[sla.semaphore] }}>
                  {sla.semaphore === 'breached' ? '⚠ Vencida' : `${sla.pct}%`}
                </span>
                <span className="text-[9px]" style={{ color: 'hsl(215,20%,40%)' }}>{sla.label}</span>
              </div>
              <div className="w-full rounded-full h-0.5" style={{ background: 'hsl(217,33%,25%)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${sla.pct ?? 100}%`, background: SEMAPHORE_COLOR[sla.semaphore] }} />
              </div>
            </div>
          )}

          {/* Modals */}
          {showEvidence && (
            <div onClick={e => e.stopPropagation()}>
              <EvidenceModal request={req} user={user} onClose={() => setShowEvidence(false)} onSaved={() => { setShowEvidence(false); onRefresh(); }} />
            </div>
          )}
          {modal === 'detail' && (
            <div onClick={e => e.stopPropagation()}>
              <DetailModal request={req} history={history} worklogs={worklogs} onClose={() => setModal(null)} user={user} />
            </div>
          )}
          {modal === 'classify' && (
            <div onClick={e => e.stopPropagation()}>
              <ClassifyModal request={req} onClose={() => setModal(null)} onSaved={saved} user={user} />
            </div>
          )}
          {modal === 'assign' && (
            <div onClick={e => e.stopPropagation()}>
              <AssignModal request={req} users={users} onClose={() => setModal(null)} onSaved={saved} user={user} />
            </div>
          )}
          {modal === 'reject' && (
            <div onClick={e => e.stopPropagation()}>
              <RejectModal request={req} onClose={() => setModal(null)} onSaved={saved} user={user} />
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

export default function KanbanBoard({ requests, user, users, onRefresh }) {
  const [pendingEvidenceReq, setPendingEvidenceReq] = useState(null);
  const [pendingDest, setPendingDest] = useState(null);
  const [pendingBlockedReq, setPendingBlockedReq] = useState(null);
  const [pendingBlockedStatus, setPendingBlockedStatus] = useState(null);
  const role = user?.role || 'employee';
  const canManage = role === 'admin' || role === 'support';

  // Group requests by status
  const columns = COLUMNS.reduce((acc, col) => {
    acc[col.key] = requests.filter(r => r.status === col.key);
    return acc;
  }, {});

  const performMove = async (req, newStatus, oldStatus) => {
    const extra = {};
    if (newStatus === 'Finalizado') {
      extra.completion_date = new Date().toISOString();
      if (req.started_at) {
        extra.actual_hours = parseFloat(((new Date() - new Date(req.started_at)) / 3600000).toFixed(2));
      }
    }
    if (newStatus === 'En Proceso' && !req.started_at) {
      extra.started_at = new Date().toISOString();
    }
    const { error: moveError } = await supabase.rpc('record_status_change', {
      p_request_id:      req.id,
      p_to_status:       newStatus,
      p_note:            'Movido via tablero Kanban',
      p_by_user_id:      user?.email || '',
      p_by_user_name:    user?.full_name || user?.email || '',
      p_started_at:      extra.started_at || null,
      p_completion_date: extra.completion_date || null,
      p_actual_hours:    extra.actual_hours || null,
    });
    if (moveError) throw moveError;
    if (req.requester_id && req.requester_id !== user?.email) {
      const titles = { 'En Validación': '🔍 Tu solicitud está en validación', 'Finalizado': '✅ Tu solicitud fue finalizada', 'Rechazado': '❌ Tu solicitud fue rechazada', 'En Proceso': '🔧 Tu solicitud está en proceso', 'Requiere Información': '⚠️ Tu solicitud requiere información', 'Cancelado': '🚫 Tu solicitud fue cancelada' };
      base44.entities.Notification.create({
        user_id: req.requester_id,
        type: 'status_change',
        title: titles[newStatus] || `Estado cambiado a ${newStatus}`,
        message: `La solicitud "${req.title}" fue movida a "${newStatus}".`,
        request_id: req.id,
        request_title: req.title,
        is_read: false,
      });
    }
    if (newStatus === 'Finalizado') {
      sendFinalizadaEmail({ ...req, status: 'Finalizado', ...extra }).catch(e => console.warn('sendFinalizadaEmail:', e));
    }
    if (newStatus === 'En Proceso') {
      sendEnProcesoEmail({ ...req, status: 'En Proceso', ...extra }).catch(e => console.warn('sendEnProcesoEmail:', e));
    }
    if (newStatus === 'Requiere Información') {
      sendRequiereInfoEmail({ ...req, status: 'Requiere Información' }).catch(e => console.warn('sendRequiereInfoEmail:', e));
    }
    toast.success(`Solicitud movida a "${newStatus}"`);
    onRefresh();
  };

  const onDragEnd = async (result) => {
    if (!canManage) {
      toast.error('No tienes permiso para mover solicitudes');
      return;
    }
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;
    const allowed = TRANSITIONS[oldStatus] || [];

    if (!allowed.includes(newStatus)) {
      toast.error(`No se puede mover de "${oldStatus}" a "${newStatus}"`);
      return;
    }

    const req = requests.find(r => r.id === draggableId);
    if (!req) return;

    // Devolver a proceso desde validación: solo solicitante o admin
    if (oldStatus === 'En Validación' && newStatus === 'En Proceso') {
      const isRequester = req.requester_id === user?.email;
      const isAdmin = role === 'admin';
      if (!isRequester && !isAdmin) {
        toast.error('Solo el solicitante o administración puede devolver a En Proceso');
        return;
      }
    }

    // Requerir evidencia al mover a En Validación
    if (newStatus === 'En Validación') {
      setPendingEvidenceReq(req);
      setPendingDest({ newStatus, oldStatus });
      return;
    }

    // Requerir motivo al mover a estados de bloqueo
    if (newStatus === 'En Espera' || newStatus === 'Requiere Información' || newStatus === 'Retrasado') {
      setPendingBlockedReq(req);
      setPendingBlockedStatus(newStatus);
      return;
    }

    try {
      await performMove(req, newStatus, oldStatus);
    } catch (err) {
      console.error('[KanbanBoard] onDragEnd error:', err);
      toast.error('Error al mover la solicitud');
      onRefresh();
    }
  };

  return (
    <>
    {pendingEvidenceReq && (
      <EvidenceModal
        request={pendingEvidenceReq}
        user={user}
        onClose={() => { setPendingEvidenceReq(null); setPendingDest(null); }}
        onSaved={() => { setPendingEvidenceReq(null); setPendingDest(null); onRefresh(); }}
      />
    )}
    {pendingBlockedReq && (
      <BlockedModal
        request={pendingBlockedReq}
        targetStatus={pendingBlockedStatus}
        user={user}
        onClose={() => { setPendingBlockedReq(null); setPendingBlockedStatus(null); }}
        onSaved={() => { setPendingBlockedReq(null); setPendingBlockedStatus(null); onRefresh(); }}
      />
    )}
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
        {COLUMNS.map(col => {
          const cards = columns[col.key] || [];
          return (
            <div key={col.key} className="flex flex-col shrink-0 rounded-xl overflow-hidden" style={{ width: 260, background: 'hsl(222,47%,10%)', border: '1px solid hsl(217,33%,18%)' }}>
              {/* Column header */}
              <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid hsl(217,33%,18%)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                  <span className="text-xs font-semibold text-white">{col.label}</span>
                </div>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>
                  {cards.length}
                </span>
              </div>

              {/* Droppable area */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 p-2 transition-colors"
                    style={{
                      background: snapshot.isDraggingOver ? 'hsl(217,33%,14%)' : undefined,
                      minHeight: 80,
                    }}
                  >
                    {cards.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-16 rounded-lg text-xs" style={{ border: '1px dashed hsl(217,33%,25%)', color: 'hsl(215,20%,35%)' }}>
                        Sin solicitudes
                      </div>
                    )}
                    {cards.map((req, idx) => (
                      <KanbanCard key={req.id} req={req} index={idx} user={user} users={users} onRefresh={onRefresh} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
    </>
  );
}
