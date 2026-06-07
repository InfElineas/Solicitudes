import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

function exportCSV(requests) {
  const headers = ['ID', 'Título', 'Estado', 'Prioridad', 'Tipo', 'Dificultad', 'Solicitante', 'Asignado a', 'Departamentos', 'Horas estimadas', 'Fecha compromiso', 'Fecha creación', 'Fecha finalización'];
  const rows = requests.map(r => [
    r.id,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    r.status || '',
    r.priority || '',
    r.request_type || '',
    r.level || '',
    r.requester_name || r.requester_id || '',
    r.assigned_to_name || '',
    (r.department_names || []).join('; '),
    r.estimated_hours || '',
    r.estimated_due ? new Date(r.estimated_due).toLocaleDateString('es') : '',
    r.created_date ? new Date(r.created_date).toLocaleDateString('es') : '',
    r.completion_date ? new Date(r.completion_date).toLocaleDateString('es') : '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solicitudes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(requests) {
  const win = window.open('', '_blank');
  const statColors = {
    'Pendiente': '#9ca3af', 'En Proceso': '#60a5fa', 'En Espera': '#fbbf24',
    'Requiere Información': '#fb923c', 'En Validación': '#c084fc',
    'Finalizado': '#4ade80', 'Retrasado': '#f87171', 'Cancelado': '#6b7280', 'Rechazado': '#fb7185',
  };
  const priColors = { 'P1 — Crítica': '#fb7185', 'P2 — Alta': '#fb923c', 'P3 — Media': '#fbbf24', 'P4 — Baja': '#4ade80' };

  const rows = requests.map(r => `
    <tr>
      <td>${r.title || ''}</td>
      <td style="color:${statColors[r.status] || '#fff'};font-weight:600">${r.status || ''}</td>
      <td style="color:${priColors[r.priority] || '#fff'};font-weight:600">${r.priority || ''}</td>
      <td>${r.request_type || ''}</td>
      <td>${r.assigned_to_name || '—'}</td>
      <td>${r.requester_name || ''}</td>
      <td>${r.created_date ? new Date(r.created_date).toLocaleDateString('es') : ''}</td>
    </tr>
  `).join('');

  win.document.write(`
    <html>
    <head>
      <title>Reporte de Solicitudes</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; margin: 0; }
        h1 { color: #60a5fa; font-size: 20px; margin-bottom: 4px; }
        p { color: #94a3b8; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #1e293b; color: #94a3b8; text-align: left; padding: 8px 10px; border-bottom: 1px solid #334155; }
        td { padding: 7px 10px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
        tr:nth-child(even) td { background: #0f172a; }
      </style>
    </head>
    <body>
      <h1>📋 Reporte de Solicitudes</h1>
      <p>Total: ${requests.length} solicitudes · Exportado: ${new Date().toLocaleString('es')}</p>
      <table>
        <thead><tr>
          <th>Título</th><th>Estado</th><th>Prioridad</th><th>Tipo</th>
          <th>Asignado</th><th>Solicitante</th><th>Fecha</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `);
  win.document.close();
  win.print();
}

export default function ExportButton({ requests = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
        style={{ background: 'hsl(217,33%,22%)', color: 'hsl(215,20%,80%)' }}
      >
        <Download className="w-3.5 h-3.5" />
        Exportar ({requests.length})
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 rounded-xl shadow-2xl py-1.5 min-w-[160px]"
            style={{ background: 'hsl(222,47%,16%)', border: '1px solid hsl(217,33%,25%)' }}>
            <button
              onClick={() => { exportCSV(requests); setOpen(false); }}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/10 text-white transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" /> Exportar CSV
            </button>
            <button
              onClick={() => { exportPDF(requests); setOpen(false); }}
              className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/10 text-white transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" /> Exportar PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}