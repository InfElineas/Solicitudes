import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Paperclip, Link, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const cardStyle = { background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' };
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)', color: 'white', outline: 'none' };
const muted = 'hsl(215,20%,55%)';

export default function EvidenceModal({ request, user, onClose, onSaved }) {
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const pending = files.map(f => ({ name: f.name, uploading: true, url: null, error: false }));
    setAttachments(prev => [...prev, ...pending]);
    for (const f of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setAttachments(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(x => x.name === f.name && x.uploading);
          if (idx !== -1) updated[idx] = { name: f.name, url: file_url, uploading: false, error: false };
          return updated;
        });
      } catch (err) {
        console.error('[EvidenceModal] UploadFile error:', err);
        toast.error(`Error al subir "${f.name}". Verifica tu conexión e inténtalo de nuevo.`);
        setAttachments(prev => prev.filter(x => !(x.name === f.name && x.uploading)));
      }
    }
    e.target.value = '';
  };

  const hasEvidence = notes.trim().length > 0 || link.trim().length > 0 || attachments.some(a => a.url);
  const isUploading = attachments.some(a => a.uploading);

  const handleSave = async () => {
    if (!hasEvidence) { toast.error('Debes adjuntar al menos una evidencia'); return; }
    if (isUploading) { toast.error('Espera a que terminen de subir los archivos'); return; }
    setSaving(true);

    const evidenceParts = [];
    if (notes.trim()) evidenceParts.push(`📝 ${notes.trim()}`);
    if (link.trim()) evidenceParts.push(`🔗 ${link.trim()}`);
    const readyUrls = attachments.filter(a => a.url).map(a => a.url);
    const allUrls = [...(request.file_urls || []), ...readyUrls];

    await base44.entities.Request.update(request.id, {
      status: 'En revisión',
      file_urls: allUrls,
    });

    await base44.entities.RequestHistory.create({
      request_id: request.id,
      from_status: request.status,
      to_status: 'En revisión',
      note: evidenceParts.join(' | ') || 'Evidencia adjunta como archivo',
      by_user_id: user?.email,
      by_user_name: user?.full_name || user?.email,
    });

    // Notify requester
    if (request.requester_id && request.requester_id !== user?.email) {
      await base44.entities.Notification.create({
        user_id: request.requester_id,
        type: 'status_change',
        title: '🔍 Tu solicitud está en revisión',
        message: `La solicitud "${request.title}" fue enviada a revisión y está siendo evaluada.`,
        request_id: request.id,
        request_title: request.title,
        is_read: false,
      });
    }

    toast.success('Solicitud enviada a revisión con evidencia registrada');
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl p-6 space-y-4 my-8 shadow-2xl" style={cardStyle} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Enviar a revisión</h3>
            <p className="text-xs mt-0.5" style={{ color: muted }}>Es obligatorio registrar al menos una evidencia de ejecución</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="rounded-lg p-3" style={{ background: 'hsl(217,60%,13%)', border: '1px solid hsl(217,60%,22%)' }}>
          <p className="text-xs font-medium text-blue-300">{request.title}</p>
          <p className="text-[10px] mt-0.5" style={{ color: muted }}>Estado actual: {request.status}</p>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: muted }}>
            <FileText className="w-3.5 h-3.5" /> Documentación / Notas de evidencia
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Describe qué se hizo, cambios realizados, resultados obtenidos..."
            className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
            style={inputStyle} />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: muted }}>
            <Link className="w-3.5 h-3.5" /> Enlace de evidencia (opcional)
          </label>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            style={inputStyle} />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: muted }}>
            <Paperclip className="w-3.5 h-3.5" /> Archivos adjuntos (capturas, reportes, etc.)
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80"
              style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,70%)' }}>
              <Paperclip className="w-3.5 h-3.5" /> Adjuntar archivo
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
            {attachments.map((a, i) => (
              <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: 'hsl(217,33%,18%)', color: a.uploading ? 'hsl(215,20%,50%)' : '#4ade80' }}>
                {a.uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                {a.name}
                {!a.uploading && (
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
                )}
              </span>
            ))}
          </div>
        </div>

        {!hasEvidence && (
          <p className="text-xs text-orange-400">⚠ Debes ingresar al menos una evidencia (notas, enlace o archivo adjunto)</p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium hover:bg-white/10"
            style={{ color: muted, border: '1px solid hsl(217,33%,22%)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !hasEvidence || isUploading}
            className="flex-1 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90"
            style={{ background: 'hsl(217,91%,40%)', color: 'white' }}>
            {saving ? 'Enviando...' : 'Enviar a revisión'}
          </button>
        </div>
      </div>
    </div>
  );
}