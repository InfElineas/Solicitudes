import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Paperclip, Send, X, Loader2, ImageIcon, FileText, AtSign } from 'lucide-react';
import { sendMentionEmail, extractMentions } from '@/services/emailNotifications';

const AVATAR_COLORS = ['bg-pink-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-cyan-500'];
function avatarColor(str) { return AVATAR_COLORS[(str?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }
function initials(name) { return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
function isImage(url) { return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url); }

export default function CommentsSection({ requestId, user, allUsers = [] }) {
  const [comments, setComments] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // { name, url, uploading }
  const [sending, setSending] = useState(false);
  const [allUsersLocal, setAllUsersLocal] = useState(allUsers);
  const fileInputRef = useRef();
  const bottomRef = useRef();

  // Load all users once for mention detection
  useEffect(() => {
    if (allUsers.length === 0) {
      base44.entities.User.list().then(setAllUsersLocal).catch(() => {});
    }
  }, []);

  // Load and poll
  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    base44.entities.RequestComment.filter({ request_id: requestId }, 'created_date')
      .then(data => { setComments(data); setLoading(false); })
      .catch(() => setLoading(false));

    // Poll every 15s for new comments
    const interval = setInterval(() => {
      base44.entities.RequestComment.filter({ request_id: requestId }, 'created_date')
        .then(data => setComments(data)).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [requestId]);

  // Scroll to bottom on new comment
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length) return;
    const newEntries = picked.map(f => ({ name: f.name, url: null, uploading: true }));
    setFiles(prev => [...prev, ...newEntries]);

    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setFiles(prev => {
        const updated = [...prev];
        // find matching uploading entry by name
        const idx = updated.findIndex(x => x.name === f.name && x.uploading);
        if (idx !== -1) updated[idx] = { name: f.name, url: file_url, uploading: false };
        return updated;
      });
    }
    e.target.value = '';
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!text.trim() && files.length === 0) return;
    if (files.some(f => f.uploading)) return; // wait for uploads
    setSending(true);
    const readyUrls = files.filter(f => f.url).map(f => f.url);

    // Get request info to notify involved users
    let requestInfo = null;
    try { requestInfo = await base44.entities.Request.filter({ id: requestId }); requestInfo = requestInfo[0]; } catch {}

    await base44.entities.RequestComment.create({
      request_id: requestId,
      content: text.trim(),
      author_id: user?.email || '',
      author_name: user?.full_name || user?.email || 'Anónimo',
      file_urls: readyUrls,
    });

    // In-app notifications for involved users
    if (requestInfo) {
      const involved = [requestInfo.requester_id, requestInfo.assigned_to_id]
        .filter(uid => uid && uid !== user?.email);
      const uniqueInvolved = [...new Set(involved)];
      await Promise.all(uniqueInvolved.map(uid =>
        base44.entities.Notification.create({
          user_id: uid,
          type: 'comment',
          title: '💬 Nuevo comentario en una solicitud',
          message: `${user?.full_name || user?.email} comentó: "${text.trim().slice(0, 80)}${text.trim().length > 80 ? '...' : ''}"`,
          request_id: requestId,
          request_title: requestInfo.title,
          is_read: false,
        })
      ));

      // Email for @mentions
      const mentionedUsers = extractMentions(text.trim(), allUsersLocal);
      await Promise.all(mentionedUsers.map(mu =>
        sendMentionEmail({
          mentionedEmail: mu.email,
          mentionedName: mu.full_name,
          commenterName: user?.full_name || user?.email,
          commentText: text.trim(),
          request: requestInfo,
        })
      ));
    }

    setText('');
    setFiles([]);
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 280 }}>
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-3" style={{ maxHeight: 320 }}>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-500">Sin comentarios aún.</p>
            <p className="text-xs text-gray-600 mt-1">Sé el primero en comentar.</p>
          </div>
        ) : comments.map((c, i) => {
          const isMe = c.author_id === user?.email;
          return (
            <div key={c.id || i} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${avatarColor(c.author_id)}`}>
                {initials(c.author_name)}
              </div>
              {/* Bubble */}
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">{isMe ? 'Tú' : c.author_name}</span>
                  <span className="text-[10px]" style={{ color: 'hsl(215,20%,45%)' }}>
                    {c.created_date ? new Date(c.created_date).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                  </span>
                </div>
                {(c.content || c.text) && (
                  <div
                    className="px-3 py-2 rounded-xl text-sm text-white whitespace-pre-wrap break-words"
                    style={{
                      background: isMe ? 'hsl(217,91%,28%)' : 'hsl(222,47%,18%)',
                      border: '1px solid ' + (isMe ? 'hsl(217,91%,35%)' : 'hsl(217,33%,25%)'),
                    }}
                  >
                    {c.content || c.text}
                  </div>
                )}
                {/* Attachments */}
                {c.file_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {c.file_urls.map((url, fi) =>
                      isImage(url) ? (
                        <a key={fi} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="adjunto" className="rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity" style={{ maxHeight: 160, maxWidth: 220 }} />
                        </a>
                      ) : (
                        <a key={fi} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:opacity-80 transition-opacity"
                          style={{ background: 'hsl(222,47%,20%)', border: '1px solid hsl(217,33%,28%)', color: '#60a5fa' }}>
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{url.split('/').pop()}</span>
                        </a>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{ background: 'hsl(222,47%,20%)', border: '1px solid hsl(217,33%,28%)', color: 'hsl(215,20%,70%)' }}>
              {f.uploading
                ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                : isImage(f.url || '') ? <ImageIcon className="w-3 h-3 text-blue-400" /> : <FileText className="w-3 h-3 text-blue-400" />
              }
              <span className="truncate max-w-[100px]">{f.name}</span>
              {!f.uploading && (
                <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 mt-auto">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escribe un comentario... Usa @nombre para mencionar. (Ctrl+Enter para enviar)"
            className="w-full px-3 py-2 rounded-xl text-sm text-white resize-none outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' }}
          />
          {text.includes('@') && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-blue-400 pointer-events-none">
              <AtSign className="w-3 h-3" /> mención activa
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'hsl(215,20%,55%)' }}
            title="Adjuntar archivo o imagen"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={sending || files.some(f => f.uploading) || (!text.trim() && files.length === 0)}
            className="p-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ background: 'hsl(217,91%,45%)', color: 'white' }}
            title="Enviar (Ctrl+Enter)"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}