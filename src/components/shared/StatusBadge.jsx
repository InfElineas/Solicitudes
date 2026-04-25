import React from 'react';
import { Clock, Loader2, Eye, CheckCircle2, XCircle } from "lucide-react";

const statusConfig = {
  'Pendiente': { icon: Clock, bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'En progreso': { icon: Loader2, bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'En revisión': { icon: Eye, bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Finalizada': { icon: CheckCircle2, bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  'Rechazada': { icon: XCircle, bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
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