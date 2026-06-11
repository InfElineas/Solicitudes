import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2, AlertTriangle, Clock, Archive } from 'lucide-react';
import { restoreFromTrash } from '../components/services/requestService';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };
const inputStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' };

const PRIORITY_COLORS = {
  'Crítica': { bg: 'hsl(0,60%,20%)',   text: '#f87171' },
  'Alta':    { bg: 'hsl(25,60%,20%)',  text: '#fb923c' },
  'Media':   { bg: 'hsl(38,60%,18%)',  text: '#fbbf24' },
  'Baja':    { bg: 'hsl(217,33%,20%)', text: 'hsl(215,20%,60%)' },
};

function urgencyColor(days) {
  if (days <= 3) return '#f87171';
  if (days <= 7) return '#fbbf24';
  return 'hsl(215,20%,50%)';
}

export default function Trash() {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [dlg, setDlg] = useState({ open: false });
  const qc = useQueryClient();

  const { data: rawTrash = [], isLoading } = useQuery({
    queryKey: ['trash'],
    queryFn: () => base44.entities.RequestTrash.list('-created_date'),
  });
  const trashItems = rawTrash.filter(Boolean);

  const { data: rawActivos = [] } = useQuery({
    queryKey: ['trash-activos'],
    queryFn: () => base44.entities.Activo.filter({ is_deleted: true }, '-updated_date'),
  });
  const { data: rawKB = [] } = useQuery({
    queryKey: ['trash-kb'],
    queryFn: () => base44.entities.KnowledgeBase.filter({ is_deleted: true }, '-updated_date'),
  });
  const { data: rawIncidents = [] } = useQuery({
    queryKey: ['trash-incidents'],
    queryFn: () => base44.entities.Incident.filter({ is_deleted: true }, '-updated_date'),
  });

  const [restoring, setRestoring] = useState(null);

  const handleRestore = async (item) => {
    setRestoring(item.id);
    try {
      if (item.itemType === 'request') {
        await restoreFromTrash(item);
        qc.invalidateQueries({ queryKey: ['trash'] });
      } else {
        const entityMap = { asset: 'Activo', kb: 'KnowledgeBase', incident: 'Incident' };
        const trashKey = { asset: 'trash-activos', kb: 'trash-kb', incident: 'trash-incidents' };
        const pageKey  = { asset: 'activos', kb: 'knowledge-base', incident: 'incidents' };
        await base44.entities[entityMap[item.itemType]].update(item.id, { is_deleted: false, deleted_by_name: null });
        qc.invalidateQueries({ queryKey: [trashKey[item.itemType]] });
        qc.invalidateQueries({ queryKey: [pageKey[item.itemType]] });
      }
      toast.success('Elemento restaurado');
    } catch { toast.error('Error al restaurar'); }
    finally { setRestoring(null); }
  };

  const handlePermDelete = async (id, itemType) => {
    try {
      if (itemType === 'request') {
        await base44.entities.RequestTrash.delete(id);
        qc.invalidateQueries({ queryKey: ['trash'] });
      } else {
        const entityMap = { asset: 'Activo', kb: 'KnowledgeBase', incident: 'Incident' };
        const trashKey  = { asset: 'trash-activos', kb: 'trash-kb', incident: 'trash-incidents' };
        await base44.entities[entityMap[itemType]].delete(id);
        qc.invalidateQueries({ queryKey: [trashKey[itemType]] });
      }
      setDlg({ open: false });
      toast.success('Eliminado permanentemente');
    } catch { toast.error('Error al eliminar'); }
  };

  const emptyTrash = async () => {
    let failures = 0;
    for (const item of trashItems) {
      try { await base44.entities.RequestTrash.delete(item.id); } catch { failures++; }
    }
    for (const a of rawActivos) {
      try { await base44.entities.Activo.delete(a.id); } catch { failures++; }
    }
    for (const k of rawKB) {
      try { await base44.entities.KnowledgeBase.delete(k.id); } catch { failures++; }
    }
    for (const i of rawIncidents) {
      try { await base44.entities.Incident.delete(i.id); } catch { failures++; }
    }
    qc.invalidateQueries({ queryKey: ['trash'] });
    qc.invalidateQueries({ queryKey: ['trash-activos'] });
    qc.invalidateQueries({ queryKey: ['trash-kb'] });
    qc.invalidateQueries({ queryKey: ['trash-incidents'] });
    setDlg({ open: false });
    if (failures > 0) toast.error('Algunos elementos no se pudieron eliminar');
    else toast.success('Papelera vaciada');
  };

  const parsedItems = useMemo(() => trashItems.map(item => {
    let snap = {};
    try { snap = JSON.parse(item.snapshot) || {}; } catch {}
    const daysLeft = item.expire_at
      ? Math.max(0, Math.ceil((new Date(item.expire_at) - new Date()) / 86400000))
      : 30;
    return { ...item, itemType: 'request', snap, daysLeft };
  }), [trashItems]);

  const softDeletedItems = useMemo(() => [
    ...rawActivos.map(a => ({ id: a.id, itemType: 'asset', deleted_by_name: a.deleted_by_name, snap: { title: a.nombre, description: [a.tipo, a.marca, a.estado].filter(Boolean).join(' · ') }, daysLeft: null })),
    ...rawKB.map(k => ({ id: k.id, itemType: 'kb', deleted_by_name: k.deleted_by_name, snap: { title: k.title, description: k.category || '' }, daysLeft: null })),
    ...rawIncidents.map(i => ({ id: i.id, itemType: 'incident', deleted_by_name: i.deleted_by_name, snap: { title: i.tool_name, description: i.description || i.status || '' }, daysLeft: null })),
  ], [rawActivos, rawKB, rawIncidents]);

  const allItems = useMemo(() => [...parsedItems, ...softDeletedItems], [parsedItems, softDeletedItems]);

  const expiringSoon = parsedItems.filter(i => i.daysLeft <= 7);

  const filtered = allItems.filter(item =>
    !search ||
    item.snap.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.snap.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Papelera</h2>
        {allItems.length > 0 && (
          <button onClick={() => setDlg({ open: true, mode: 'empty' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ background: 'hsl(0,60%,22%)', color: '#f87171', border: '1px solid hsl(0,60%,34%)' }}>
            <Trash2 className="w-3.5 h-3.5" /> Vaciar papelera
          </button>
        )}
      </div>

      {/* Stats */}
      {allItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={cardStyle}>
            <Archive className="w-5 h-5 shrink-0" style={{ color: 'hsl(215,20%,50%)' }} />
            <div>
              <p className="text-base font-bold text-white">{allItems.length}</p>
              <p className="text-[10px]" style={{ color: 'hsl(215,20%,50%)' }}>En papelera</p>
            </div>
          </div>
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={cardStyle}>
            <Clock className="w-5 h-5 shrink-0" style={{ color: expiringSoon.length > 0 ? '#fbbf24' : '#4ade80' }} />
            <div>
              <p className="text-base font-bold text-white">{expiringSoon.length}</p>
              <p className="text-[10px]" style={{ color: 'hsl(215,20%,50%)' }}>Vencen en 7 días</p>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de vencimiento */}
      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
          style={{ background: 'hsl(38,60%,12%)', border: '1px solid hsl(38,60%,24%)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} />
          <p className="text-xs" style={{ color: '#fcd34d' }}>
            {expiringSoon.length} elemento{expiringSoon.length > 1 ? 's vencen' : ' vence'} en los próximos 7 días.
            Restáuralos antes de que se eliminen permanentemente.
          </p>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="flex gap-2 p-4 rounded-xl" style={cardStyle}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Buscar por título o descripción..."
          className="flex-1 px-3 py-2 rounded-lg text-sm text-white outline-none"
          style={inputStyle}
        />
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
          {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s} por pág.</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'hsl(215,20%,40%)' }}>Cargando...</div>
        ) : paginated.length === 0 ? (
          <div className="py-12 text-center">
            <Archive className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(215,20%,22%)' }} />
            <p className="text-sm font-medium" style={{ color: 'hsl(215,20%,45%)' }}>Papelera vacía</p>
            <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,30%)' }}>
              Las solicitudes eliminadas aparecen aquí durante 30 días.
            </p>
          </div>
        ) : (
          <div>
            {paginated.map((item, idx) => {
              const { snap, daysLeft } = item;
              const priority = PRIORITY_COLORS[snap.priority];
              const isCritical = daysLeft <= 3;
              return (
                <div key={item.id}
                  className="flex items-start gap-3 px-4 py-4"
                  style={{ borderBottom: idx < paginated.length - 1 ? '1px solid hsl(217,33%,15%)' : undefined }}>

                  {/* Ícono */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: isCritical ? 'hsl(0,60%,16%)' : 'hsl(222,47%,18%)' }}>
                    <Trash2 className="w-4 h-4"
                      style={{ color: isCritical ? '#f87171' : 'hsl(215,20%,45%)' }} />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white truncate">{snap.title || 'Sin título'}</p>
                      <span className="text-[11px] font-medium shrink-0 flex items-center gap-0.5"
                        style={{ color: urgencyColor(daysLeft) }}>
                        <Clock className="w-3 h-3 inline" /> {daysLeft}d
                      </span>
                    </div>

                    {snap.description && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'hsl(215,20%,50%)' }}>
                        {snap.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {(() => {
                        const TYPE_BADGE = {
                          request:  { label: 'Solicitud', color: '#60a5fa', bg: 'hsl(217,60%,18%)' },
                          asset:    { label: 'Activo',    color: '#a78bfa', bg: 'hsl(260,60%,18%)' },
                          kb:       { label: 'KB',        color: '#34d399', bg: 'hsl(142,50%,16%)' },
                          incident: { label: 'Incidencia',color: '#fbbf24', bg: 'hsl(38,60%,16%)' },
                        }[item.itemType];
                        return TYPE_BADGE ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: TYPE_BADGE.bg, color: TYPE_BADGE.color }}>
                            {TYPE_BADGE.label}
                          </span>
                        ) : null;
                      })()}
                      {snap.priority && priority && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: priority.bg, color: priority.text }}>
                          {snap.priority}
                        </span>
                      )}
                      {snap.department_names?.[0] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'hsl(217,33%,20%)', color: 'hsl(215,20%,65%)' }}>
                          {snap.department_names[0]}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: 'hsl(215,20%,36%)' }}>
                        Eliminado por {item.deleted_by_name || item.deleted_by_id}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 shrink-0 mt-0.5">
                    <button onClick={() => handleRestore(item)} disabled={restoring === item.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
                      style={{ background: 'hsl(217,60%,18%)', color: '#60a5fa', border: '1px solid hsl(217,60%,28%)' }}>
                      <RotateCcw className="w-3 h-3" /> Restaurar
                    </button>
                    <button
                      onClick={() => setDlg({ open: true, mode: 'delete', id: item.id, itemType: item.itemType, title: snap.title })}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      style={{ color: 'hsl(215,20%,45%)' }}
                      title="Eliminar permanentemente">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginación */}
      {filtered.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"
          style={{ color: 'hsl(215,20%,55%)' }}>
          <span>Total: {filtered.length} elemento{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2.5 py-1 rounded hover:bg-white/10 disabled:opacity-30">Anterior</button>
            <span className="font-medium text-white">Pág {page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-2.5 py-1 rounded hover:bg-white/10 disabled:opacity-30 text-blue-400">Siguiente</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={dlg.open}
        title={dlg.mode === 'empty' ? 'Vaciar papelera' : 'Eliminar permanentemente'}
        message={dlg.mode === 'empty'
          ? `Se eliminarán ${allItems.length} elemento(s) de forma permanente. Esta acción no se puede deshacer.`
          : `¿Eliminar "${dlg.title || 'este elemento'}" permanentemente? No podrás recuperarlo.`
        }
        confirmLabel={dlg.mode === 'empty' ? 'Vaciar todo' : 'Eliminar'}
        danger
        onConfirm={() => dlg.mode === 'empty' ? emptyTrash() : handlePermDelete(dlg.id, dlg.itemType || 'request')}
        onCancel={() => setDlg({ open: false })}
      />
    </div>
  );
}
