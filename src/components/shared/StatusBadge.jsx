import React from 'react';
import { Clock, Loader2, Eye, CheckCircle2, XCircle, PauseCircle, AlertCircle, AlertTriangle, Ban } from "lucide-react";

// 9 estados del Protocolo Operativo v1.0
const statusConfig = {
  'Pendiente':            { icon: Clock,         bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/30' },
  'En Proceso':           { icon: Loader2,       bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30' },
  'En Espera':            { icon: PauseCircle,   bg: 'bg-amber-500/20',  text: 'text-amber-400',  border: 'border-amber-500/30' },
  'Requiere Información': { icon: AlertCircle,   bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  'En Validación':        { icon: Eye,           bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Finalizado':           { icon: CheckCircle2,  bg: 'bg-green-500/20',  text: 'text-green-400',  border: 'border-green-500/30' },
  'Retrasado':            { icon: AlertTriangle, bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border-red-500/30' },
  'Cancelado':            { icon: Ban,           bg: 'bg-gray-700/20',   text: 'text-gray-500',   border: 'border-gray-700/30' },
  'Rechazado':            { icon: XCircle,       bg: 'bg-rose-900/20',   text: 'text-rose-400',   border: 'border-rose-900/30' },
};

export default function StatusBadge({ status, size = 'default' }) {
  const config = statusConfig[status] || statusConfig['Pendiente'];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2.5 py-0.5';

  return (
    <span className={`badge-pill ${config.bg} ${config.text} border ${config.border} ${sizeClasses} gap-1`}>
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {status}
    </span>
  );
}