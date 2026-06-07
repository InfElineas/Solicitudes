import React from 'react';
import { Wrench, Sparkles, Code2, GraduationCap, PlusCircle, Bug, Settings, RefreshCw, MessageSquare, Puzzle, TrendingUp, FileBarChart, HeadphonesIcon, Zap } from "lucide-react";

// 11 tipos del Protocolo Operativo v1.0
const typeConfig = {
  'Nueva Implementación': { icon: PlusCircle,      bg: 'bg-indigo-500/20',  text: 'text-indigo-400' },
  'Reparación / Bug':     { icon: Bug,             bg: 'bg-red-500/20',     text: 'text-red-400' },
  'Mantenimiento':        { icon: Settings,        bg: 'bg-gray-500/20',    text: 'text-gray-400' },
  'Actualización':        { icon: RefreshCw,       bg: 'bg-cyan-500/20',    text: 'text-cyan-400' },
  'Consulta o Asesoría':  { icon: MessageSquare,   bg: 'bg-blue-500/20',    text: 'text-blue-400' },
  'Integración':          { icon: Puzzle,          bg: 'bg-violet-500/20',  text: 'text-violet-400' },
  'Optimización':         { icon: TrendingUp,      bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'Capacitación':         { icon: GraduationCap,   bg: 'bg-pink-500/20',    text: 'text-pink-400' },
  'Reporte o Análisis':   { icon: FileBarChart,    bg: 'bg-amber-500/20',   text: 'text-amber-400' },
  'Soporte Técnico':      { icon: HeadphonesIcon,  bg: 'bg-orange-500/20',  text: 'text-orange-400' },
  'Automatización':       { icon: Zap,             bg: 'bg-yellow-500/20',  text: 'text-yellow-400' },
};

export default function TypeBadge({ type }) {
  const config = typeConfig[type] || { icon: Wrench, bg: 'bg-gray-500/20', text: 'text-gray-400' };
  const Icon = config.icon;

  return (
    <span className={`badge-pill ${config.bg} ${config.text} gap-1`}>
      <Icon className="w-3 h-3" />
      {type}
    </span>
  );
}