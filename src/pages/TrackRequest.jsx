import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { CheckCircle2, Clock, Loader2, Eye, AlertTriangle, XCircle, Ban, PauseCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  'Pendiente':            { icon: Clock,         color: '#9ca3af', label: 'Pendiente',            desc: 'Tu solicitud fue registrada y está en cola.' },
  'En Proceso':           { icon: Loader2,        color: '#60a5fa', label: 'En Proceso',           desc: 'El equipo de soporte está trabajando en tu solicitud.' },
  'En Espera':            { icon: PauseCircle,    color: '#fbbf24', label: 'En Espera',            desc: 'La solicitud está pausada temporalmente.' },
  'Requiere Información': { icon: AlertCircle,    color: '#fb923c', label: 'Requiere Información', desc: 'El equipo necesita más información de tu parte. Revisa tus notificaciones.' },
  'En Validación':        { icon: Eye,            color: '#c084fc', label: 'En Validación',        desc: 'La solución está siendo revisada antes del cierre.' },
  'Finalizado':           { icon: CheckCircle2,   color: '#22c55e', label: 'Finalizado',           desc: '¡Tu solicitud fue completada exitosamente!' },
  'Retrasado':            { icon: AlertTriangle,  color: '#f87171', label: 'Retrasado',            desc: 'La atención está tardando más de lo esperado. El equipo está al tanto.' },
  'Cancelado':            { icon: Ban,            color: '#6b7280', label: 'Cancelado',            desc: 'Esta solicitud fue cancelada.' },
  'Rechazado':            { icon: XCircle,        color: '#fb7185', label: 'Rechazado',            desc: 'Esta solicitud fue rechazada. Consulta el motivo con el equipo de soporte.' },
};

const STEPS = ['Pendiente', 'En Proceso', 'En Validación', 'Finalizado'];

function StepBar({ currentStatus }) {
  const activeIdx = STEPS.indexOf(currentStatus);
  const isClosed = ['Cancelado', 'Rechazado'].includes(currentStatus);

  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {STEPS.map((step, i) => {
        const done  = !isClosed && activeIdx > i;
        const active = !isClosed && activeIdx === i;
        const color = done || active ? STATUS_CONFIG[step]?.color : '#374151';
        const labelColor = done || active ? '#e5e7eb' : '#6b7280';
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{ background: done || active ? color : '#1f2937', border: `2px solid ${color}`, color: done || active ? '#111' : color }}>
                {done ? '✓' : i + 1}
              </div>
              <span className="text-[10px] mt-1 text-center leading-tight" style={{ color: labelColor }}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-0.5 flex-1 mx-1 mb-4 transition-all"
                style={{ background: done ? STATUS_CONFIG[STEPS[i + 1]]?.color : '#374151' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function TrackRequest() {
  const fmtDate = (d) => d ? new Date(d).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : '—';
  const fmtDateOnly = (d) => d ? new Date(d).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
  }) : '—';

  const { token } = useParams();
  const [request, setRequest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    const load = async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('id,title,description,status,priority,request_type,created_date,updated_date,estimated_due,assigned_to_name,department_names,rejection_reason,completion_date,public_token')
        .eq('public_token', token)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setRequest(data);

      const { data: hist } = await supabase
        .from('request_histories')
        .select('from_status,to_status,note,by_user_name,created_date')
        .eq('request_id', data.id)
        .order('created_date', { ascending: true });
      setHistory(hist || []);
      setLoading(false);
    };
    load();
  }, [token]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error('No se pudo copiar el enlace'));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(222,47%,8%)' }}>
      <div className="w-8 h-8 border-4 border-white/10 border-t-blue-400 rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: 'hsl(222,47%,8%)' }}>
      <div className="text-4xl">🔍</div>
      <h1 className="text-white text-lg font-semibold">Solicitud no encontrada</h1>
      <p className="text-sm text-center" style={{ color: 'hsl(215,20%,55%)' }}>
        El enlace puede haber expirado o ser incorrecto.
      </p>
    </div>
  );

  const cfg = STATUS_CONFIG[request.status] || STATUS_CONFIG['Pendiente'];
  const Icon = cfg.icon;
  const ticketId = request.id?.slice(-8).toUpperCase();

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'hsl(222,47%,8%)' }}>
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-3"
            style={{ background: 'hsl(217,33%,18%)', color: 'hsl(215,20%,60%)' }}>
            <span style={{ color: '#60a5fa' }}>ELíneas</span> · Soporte Técnico
          </div>
          <h1 className="text-white text-xl font-bold">Seguimiento de solicitud</h1>
          <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,50%)' }}>Ticket #{ticketId}</p>
        </div>

        {/* Estado principal */}
        <div className="rounded-2xl p-5" style={{ background: 'hsl(222,47%,12%)', border: `1px solid ${cfg.color}40` }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${cfg.color}20` }}>
              <Icon className="w-5 h-5" style={{ color: cfg.color }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'hsl(215,20%,55%)' }}>Estado actual</p>
              <p className="text-base font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'hsl(215,20%,65%)' }}>{cfg.desc}</p>
          {request.rejection_reason && (
            <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'hsl(0,40%,15%)', color: '#fca5a5' }}>
              Motivo: {request.rejection_reason}
            </p>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="rounded-2xl p-5" style={{ background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' }}>
          <StepBar currentStatus={request.status} />

          {/* Detalle */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'hsl(215,20%,55%)' }}>Título</span>
              <span className="text-white font-medium text-right max-w-[60%]">{request.title}</span>
            </div>
            {request.request_type && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Tipo</span>
                <span style={{ color: 'hsl(215,20%,75%)' }}>{request.request_type}</span>
              </div>
            )}
            {(request.department_names || []).filter(Boolean).length > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Departamento</span>
                <span style={{ color: 'hsl(215,20%,75%)' }}>{(request.department_names || []).filter(Boolean).join(', ')}</span>
              </div>
            )}
            {request.assigned_to_name && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Técnico asignado</span>
                <span style={{ color: '#60a5fa' }}>{request.assigned_to_name}</span>
              </div>
            )}
            {request.estimated_due && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Fecha compromiso</span>
                <span style={{ color: 'hsl(215,20%,75%)' }}>
                  {fmtDateOnly(request.estimated_due)}
                </span>
              </div>
            )}
            {request.completion_date && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Fecha de cierre</span>
                <span style={{ color: '#22c55e' }}>
                  {fmtDateOnly(request.completion_date)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: 'hsl(215,20%,55%)' }}>Creada</span>
              <span style={{ color: 'hsl(215,20%,65%)' }}>
                {fmtDateOnly(request.created_date)}
              </span>
            </div>
          </div>
        </div>

        {/* Historial */}
        <div className="rounded-2xl p-5" style={{ background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' }}>
          <h2 className="text-sm font-semibold text-white mb-3">Historial de cambios</h2>
          {history.length === 0 ? (
            <p className="text-xs" style={{ color: 'hsl(215,20%,45%)' }}>Sin actualizaciones registradas.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: STATUS_CONFIG[h.to_status]?.color || '#6b7280' }} />
                    {i < history.length - 1 && <div className="w-0.5 flex-1 my-0.5" style={{ background: 'hsl(217,33%,22%)' }} />}
                  </div>
                  <div className="pb-2">
                    <span className="font-medium" style={{ color: STATUS_CONFIG[h.to_status]?.color || '#e5e7eb' }}>{h.to_status}</span>
                    {h.note && <p className="mt-0.5" style={{ color: 'hsl(215,20%,55%)' }}>{h.note}</p>}
                    <p className="mt-0.5" style={{ color: 'hsl(215,20%,40%)' }}>
                      {h.by_user_name} · {fmtDate(h.created_date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Copiar enlace */}
        <button onClick={copyLink}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ background: copied ? 'hsl(142,60%,20%)' : 'hsl(217,33%,18%)', color: copied ? '#4ade80' : 'hsl(215,20%,70%)', border: '1px solid hsl(217,33%,25%)' }}>
          {copied ? '✓ Enlace copiado' : '🔗 Compartir este seguimiento'}
        </button>

        <p className="text-center text-[10px] pb-4" style={{ color: 'hsl(215,20%,35%)' }}>
          ELíneas · Departamento de Soporte Técnico
        </p>
      </div>
    </div>
  );
}
