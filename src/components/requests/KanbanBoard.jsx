import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { sendFinalizadaEmail } from '@/services/emailNotifications';
import EvidenceModal from './EvidenceModal';
import {
  ClassifyModal,
  AssignModal,
  RejectModal,
  DetailModal,
} from './RequestModals';

const COLUMNS = [
  { key: 'Pendiente', label: 'Pendiente', color: '#fbbf24', bg: 'hsl(38,80%,18%)' },
  { key: 'En progreso', label: 'En progreso', color: '#60a5fa', bg: 'hsl(217,60%,18%)' },
  { key: 'En revisión', label: 'En revisión', color: '#c084fc', bg: 'hsl(270,60%,20%)' },
  { key: 'Finalizada', label: 'Finalizada', color: '#4ade80', bg: 'hsl(142,60%,16%)' },
  { key: 'Rechazada', label: 'Rechazada', color: '#f87171', bg: 'hsl(0,60%,18%)' },
];

const PRIORITY_COLORS = {
  Alta: { bg: 'hsl(0,84%,22%)', text: '#f87171' },
  Media: { bg: 'hsl(38,80%,20%)', text: '#fbbf24' },
  Baja: { bg: 'hsl(142,60%,18%)', text: '#4ade80' },
};

// Valid status transitions — En progreso cannot go directly to Finalizada
const TRANSITIONS = {
  Pendiente: ['En progreso', 'Rechazada'],
  'En progreso': ['En revisión', 'Rechazada'],
  'En revisión': ['Finalizada', 'En progreso', 'Rechazada'],
  Finalizada: [],
  Rechazada: [],
};

function KanbanCard({ req, index, user, users, onRefresh }) {
  const [modal, setModal] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [history, setHistory] = useState([]);
  const [worklogs, setWorklogs] = useState([]);

  const pc = PRIORITY_COLORS[req.priority] || PRIORITY_COLORS.Media;
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
              <AssignModal request={req} users={users} onClose={() => setModal(null)} onSaved={saved} />
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
  const role = user?.role || 'employee';
  const canManage = role === 'admin' || role === 'support';

  // Group requests by status
  const columns = COLUMNS.reduce((acc, col) => {
    acc[col.key] = requests.filter(r => r.status === col.key);
    return acc;
  }, {});

  const performMove = async (req, newStatus, oldStatus) => {
    const extra = {};
    if (newStatus === 'Finalizada') {
      extra.completion_date = new Date().toISOString();
      if (req.started_at) {
        extra.actual_hours = parseFloat(((new Date() - new Date(req.started_at)) / 3600000).toFixed(2));
      }
    }
    if (newStatus === 'En progreso' && !req.started_at) {
      extra.started_at = new Date().toISOString();
    }
    await base44.entities.Request.update(req.id, { status: newStatus, ...extra });
    await base44.entities.RequestHistory.create({
      request_id: req.id,
      from_status: oldStatus,
      to_status: newStatus,
      note: 'Movido via tablero Kanban',
      by_user_id: user?.email,
      by_user_name: user?.full_name || user?.email,
    });
    if (req.requester_id && req.requester_id !== user?.email) {
      const titles = { 'En revisión': '🔍 Tu solicitud está en revisión', 'Finalizada': '✅ Tu solicitud fue finalizada', 'Rechazada': '❌ Tu solicitud fue rechazada', 'En progreso': '🔧 Tu solicitud está en progreso' };
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
    if (newStatus === 'Finalizada') {
      sendFinalizadaEmail({ ...req, status: 'Finalizada', ...extra });
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

    // Return to development from review is restricted to requester or admin.
    if (oldStatus === 'En revisión' && newStatus === 'En progreso') {
      const isRequester = req.requester_id === user?.email;
      const isAdmin = role === 'admin';
      if (!isRequester && !isAdmin) {
        toast.error('Solo el solicitante o administración puede devolver a desarrollo');
        return;
      }
    }

    // Require evidence when moving to En revisión
    if (newStatus === 'En revisión') {
      setPendingEvidenceReq(req);
      setPendingDest({ newStatus, oldStatus });
      return;
    }

    await performMove(req, newStatus, oldStatus);
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
