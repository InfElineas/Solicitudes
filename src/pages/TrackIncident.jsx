import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { CheckCircle2, Clock, Loader2, HelpCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  'Pendiente':       { icon: Clock,         color: '#9ca3af', label: 'Pendiente',       desc: 'Tu incidencia fue registrada y está en cola de atención.' },
  'En atención':     { icon: Loader2,        color: '#60a5fa', label: 'En atención',     desc: 'Un técnico está trabajando en tu incidencia.' },
  'Resuelto':        { icon: CheckCircle2,   color: '#22c55e', label: 'Resuelto',        desc: '¡Tu incidencia fue resuelta exitosamente!' },
  'No reproducible': { icon: HelpCircle,     color: '#fbbf24', label: 'No reproducible', desc: 'No se pudo reproducir el problema. Contáctanos si persiste.' },
};

const STEPS = ['Pendiente', 'En atención', 'Resuelto'];

const IMPACT_COLORS = {
  'Crítico - No puedo trabajar':          '#f87171',
  'Alto - Trabajo muy afectado':          '#fb923c',
  'Medio - Trabajo parcialmente afectado':'#fbbf24',
  'Bajo - Pequeña molestia':              '#4ade80',
};

function StepBar({ currentStatus }) {
  const activeIdx = STEPS.indexOf(currentStatus);
  const isClosed = currentStatus === 'No reproducible';

  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {STEPS.map((step, i) => {
        const done   = !isClosed && activeIdx > i;
        const active = !isClosed && activeIdx === i;
        const color  = done || active ? STATUS_CONFIG[step]?.color : '#374151';
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{ background: done || active ? color : '#1f2937', border: `2px solid ${color}`, color: done || active ? '#111' : color }}>
                {done ? '✓' : i + 1}
              </div>
              <span className="text-[10px] mt-1 text-center leading-tight" style={{ color: done || active ? '#e5e7eb' : '#6b7280' }}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-0.5 flex-1 mx-1 mb-4 transition-all"
                style={{ background: done ? color : '#374151' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function TrackIncident() {
  const fmtDateOnly = (d) => d ? new Date(d).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
  }) : '—';

  const { token } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    const load = async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('id,tool_name,category,description,impact,status,department,reporter_name,assigned_to_name,resolved_at,resolution_notes,resolution_hours,created_date,public_token')
        .eq('public_token', token)
        .single();
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setIncident(data);
      setLoading(false);
    };
    load();
  }, [token]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error('No se pudo copiar el enlace'));
  };

  const renderNotes = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', wordBreak: 'break-all' }}>{part}</a>
        : <span key={i}>{part}</span>
    );
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(222,47%,8%)' }}>
      <div className="w-8 h-8 border-4 border-white/10 border-t-blue-400 rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: 'hsl(222,47%,8%)' }}>
      <div className="text-4xl">🔍</div>
      <h1 className="text-white text-lg font-semibold">Incidencia no encontrada</h1>
      <p className="text-sm text-center" style={{ color: 'hsl(215,20%,55%)' }}>
        El enlace puede haber expirado o ser incorrecto.
      </p>
    </div>
  );

  const cfg    = STATUS_CONFIG[incident.status] || STATUS_CONFIG['Pendiente'];
  const Icon   = cfg.icon;
  const ticketId = incident.id?.slice(-8).toUpperCase();
  const impactColor = IMPACT_COLORS[incident.impact] || '#94a3b8';

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'hsl(222,47%,8%)' }}>
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-3"
            style={{ background: 'hsl(217,33%,18%)', color: 'hsl(215,20%,60%)' }}>
            <span style={{ color: '#60a5fa' }}>ELíneas</span> · Soporte Técnico
          </div>
          <h1 className="text-white text-xl font-bold">Seguimiento de incidencia</h1>
          <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,50%)' }}>Ticket #{ticketId}</p>
        </div>

        {/* Estado principal */}
        <div className="rounded-2xl p-5" style={{ background: 'hsl(222,47%,12%)', border: `1px solid ${cfg.color}40` }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${cfg.color}20` }}>
              <Icon className={`w-5 h-5 ${incident.status === 'En atención' ? 'animate-spin' : ''}`} style={{ color: cfg.color }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'hsl(215,20%,55%)' }}>Estado actual</p>
              <p className="text-base font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'hsl(215,20%,65%)' }}>{cfg.desc}</p>
          {incident.resolution_notes && (
            <p className="text-xs mt-2 p-2 rounded-lg whitespace-pre-wrap" style={{ background: 'hsl(142,40%,12%)', color: '#86efac' }}>
              Solución: {renderNotes(incident.resolution_notes)}
            </p>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="rounded-2xl p-5" style={{ background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' }}>
          <StepBar currentStatus={incident.status} />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'hsl(215,20%,55%)' }}>Herramienta</span>
              <span className="text-white font-medium text-right max-w-[60%]">{incident.tool_name}</span>
            </div>
            {incident.category && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Categoría</span>
                <span style={{ color: 'hsl(215,20%,75%)' }}>{incident.category}</span>
              </div>
            )}
            {incident.impact && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Impacto</span>
                <span style={{ color: impactColor }}>{incident.impact.split(' - ')[0]}</span>
              </div>
            )}
            {incident.department && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Departamento</span>
                <span style={{ color: 'hsl(215,20%,75%)' }}>{incident.department}</span>
              </div>
            )}
            {incident.assigned_to_name && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Técnico asignado</span>
                <span style={{ color: '#60a5fa' }}>{incident.assigned_to_name}</span>
              </div>
            )}
            {incident.resolved_at && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Fecha de resolución</span>
                <span style={{ color: '#22c55e' }}>
                  {fmtDateOnly(incident.resolved_at)}
                </span>
              </div>
            )}
            {incident.resolution_hours > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'hsl(215,20%,55%)' }}>Tiempo de resolución</span>
                <span style={{ color: '#4ade80' }}>{incident.resolution_hours.toFixed(1)}h</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: 'hsl(215,20%,55%)' }}>Reportada</span>
              <span style={{ color: 'hsl(215,20%,65%)' }}>
                {fmtDateOnly(incident.created_date)}
              </span>
            </div>
          </div>
        </div>

        {/* Descripción */}
        {incident.description && (
          <div className="rounded-2xl p-5" style={{ background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,18%)' }}>
            <h2 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'hsl(215,20%,45%)' }}>Descripción del problema</h2>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'hsl(215,20%,70%)' }}>{incident.description}</p>
          </div>
        )}

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
