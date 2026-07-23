import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, MessageSquare } from 'lucide-react';

// participants: [{ email, name }] — usuarios a notificar al recibir un mensaje (excluye al remitente)
export default function ChatSection({ entityType, entityId, user, participants = [] }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef();

  const load = () => {
    base44.entities.ChatLog.filter({ entity_id: entityId, entity_type: entityType }, 'created_date', 100)
      .then(msgs => { setMessages(msgs); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Poll every 10s for new messages
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [entityId, entityType]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const msg = text.trim();
    await base44.entities.ChatLog.create({
      entity_type: entityType,
      entity_id: entityId,
      sender_id: user?.email,
      sender_name: user?.full_name || user?.email,
      message: msg,
    });
    // Notificar a los otros participantes
    const others = participants.filter(p => p.email && p.email !== user?.email);
    if (others.length > 0) {
      const preview = msg.length > 100 ? msg.slice(0, 100) + '…' : msg;
      Promise.all(others.map(p =>
        base44.entities.Notification.create({
          user_id: p.email,
          type: 'comment',
          title: `💬 ${user?.full_name || user?.email} te envió un mensaje`,
          message: `"${preview}"`,
          is_read: false,
        })
      )).catch(() => {});
    }
    setText('');
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const inputStyle = {
    background: 'hsl(222,47%,18%)',
    border: '1px solid hsl(217,33%,28%)',
    color: 'white',
    outline: 'none',
  };

  return (
    <div className="flex flex-col" style={{ height: 320 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
        {loading ? (
          <p className="text-center text-xs py-8" style={{ color: 'hsl(215,20%,40%)' }}>Cargando mensajes...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(215,20%,30%)' }} />
            <p className="text-xs" style={{ color: 'hsl(215,20%,40%)' }}>Sin mensajes aún. Inicia la conversación.</p>
          </div>
        ) : messages.map((m, i) => {
          const isMine = m.sender_id === user?.email;
          return (
            <div key={m.id || i} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] mb-0.5 px-1" style={{ color: 'hsl(215,20%,45%)' }}>
                {m.sender_name}
              </span>
              <div
                className="max-w-[78%] px-3 py-2 text-sm break-words"
                style={{
                  background: isMine ? 'hsl(217,91%,32%)' : 'hsl(222,47%,20%)',
                  color: isMine ? 'white' : 'hsl(210,40%,90%)',
                  borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                }}
              >
                {m.message}
              </div>
              <span className="text-[9px] mt-0.5 px-1" style={{ color: 'hsl(215,20%,35%)' }}>
                {m.created_date ? new Date(m.created_date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'hsl(217,33%,22%)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje... (Enter para enviar)"
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={inputStyle}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="px-3 py-2 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-80"
          style={{ background: 'hsl(217,91%,45%)', color: 'white' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}