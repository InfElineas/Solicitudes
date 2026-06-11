import React, { useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Diálogo de confirmación con el estilo del sistema.
 * @param {{ open: boolean, message: string, title?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
export default function ConfirmDialog({
  open,
  message,
  title,
  confirmLabel = 'Aceptar',
  cancelLabel  = 'Cancelar',
  danger       = true,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl p-6"
        style={{ background: 'hsl(222,47%,13%)', border: '1px solid hsl(217,33%,26%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Ícono + título */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: danger ? 'hsl(0,60%,18%)' : 'hsl(217,60%,20%)' }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: danger ? '#f87171' : '#60a5fa' }} />
          </div>
          <div>
            {title && <p className="text-sm font-semibold text-white mb-0.5">{title}</p>}
            <p className="text-sm" style={{ color: 'hsl(215,20%,70%)' }}>{message}</p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-2 justify-end mt-5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
            style={{ color: 'hsl(215,20%,65%)', border: '1px solid hsl(217,33%,26%)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:opacity-90"
            style={{
              background: danger ? 'hsl(0,65%,38%)' : 'hsl(217,91%,50%)',
              color: 'white',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
