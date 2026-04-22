import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2 } from 'lucide-react';
import { restoreFromTrash } from '../components/services/requestService';
import { toast } from 'sonner';

const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };
const inputStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)', color: 'white' };

export default function Trash() {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const qc = useQueryClient();

  const { data: rawTrash = [], isLoading } = useQuery({
    queryKey: ['trash'],
    queryFn: () => base44.entities.RequestTrash.list('-created_date'),
  });
  const trashItems = rawTrash.filter(Boolean);

  const restoreMutation = useMutation({
    mutationFn: (item) => restoreFromTrash(item),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trash'] }); toast.success('Solicitud restaurada'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RequestTrash.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trash'] }); toast.success('Eliminado permanentemente'); },
  });

  const emptyTrash = async () => {
    for (const item of trashItems) {
      await base44.entities.RequestTrash.delete(item.id);
    }
    qc.invalidateQueries({ queryKey: ['trash'] });
    setEmptyConfirm(false);
    toast.success('Papelera vaciada');
  };

  const filtered = trashItems.filter(item => {
    if (!search) return true;
    let snap = {};
    try { snap = JSON.parse(item.snapshot) || {}; } catch {}
    return snap.title?.toLowerCase().includes(search.toLowerCase()) || snap.description?.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-bold text-white mb-6">Papelera</h2>

      {/* Search + actions */}
      <div className="rounded-xl p-4 mb-4" style={cardStyle}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-400 mb-1 block">Buscar</label>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Título o descripción..."
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Por página</label>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
              {[5, 10, 20, 50].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <button onClick={() => setEmptyConfirm(true)} disabled={trashItems.length === 0}
            className="px-3 py-1.5 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-30"
            style={{ background: 'hsl(0,70%,40%)' }}>
            Vaciar Papelera
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl overflow-hidden mb-3" style={cardStyle}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : paginated.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay elementos en la papelera.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'hsl(217,33%,18%)' }}>
            {paginated.map(item => {
              let snap = {};
              try { snap = JSON.parse(item.snapshot) || {}; } catch {}
              const daysLeft = item.expire_at
                ? Math.max(0, Math.ceil((new Date(item.expire_at) - new Date()) / (1000 * 60 * 60 * 24)))
                : 30;
              return (
                <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{snap.title || 'Sin título'}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>Por {item.deleted_by_name || item.deleted_by_id}</span>
                      <span>{daysLeft} días restantes</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => restoreMutation.mutate(item)} disabled={restoreMutation.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(217,33%,25%)', color: 'hsl(215,20%,80%)' }}>
                      <RotateCcw className="w-3 h-3" /> Restaurar
                    </button>
                    <button onClick={() => deleteMutation.mutate(item.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium hover:opacity-80"
                      style={{ background: 'hsl(0,60%,28%)', color: '#f87171' }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'hsl(215,20%,55%)' }}>
        <span>Total: {filtered.length}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">Anterior</button>
          <span className="font-medium text-white whitespace-nowrap">Pág {page + 1}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30 text-blue-400">Siguiente</button>
        </div>
      </div>

      {/* Empty confirm */}
      {emptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl p-6 w-full max-w-sm" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' }}>
            <h3 className="text-base font-semibold text-white mb-2">Vaciar papelera</h3>
            <p className="text-sm text-gray-400 mb-4">Se eliminarán {trashItems.length} elemento(s) permanentemente. ¿Continuar?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEmptyConfirm(false)} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
              <button onClick={emptyTrash} className="px-4 py-2 text-sm rounded-lg text-white font-medium" style={{ background: 'hsl(0,70%,40%)' }}>Vaciar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}