import React from 'react';
import { ArrowUp, ArrowRight, ArrowDown, Flame } from "lucide-react";

// P1-P4 según Protocolo Operativo v1.0
const priorityConfig = {
  'P1 — Crítica': { icon: Flame,       bg: 'bg-red-900/30',    text: 'text-red-300',    border: 'border-red-700/40' },
  'P2 — Alta':    { icon: ArrowUp,     bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  'P3 — Media':   { icon: ArrowRight,  bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'P4 — Baja':    { icon: ArrowDown,   bg: 'bg-green-500/20',  text: 'text-green-400',  border: 'border-green-500/30' },
};

export default function PriorityBadge({ priority }) {
  const config = priorityConfig[priority] || priorityConfig['P3 — Media'];
  const Icon = config.icon;

  return (
    <span className={`badge-pill ${config.bg} ${config.text} border ${config.border} gap-1`}>
      <Icon className="w-3 h-3" />
      {priority}
    </span>
  );
}