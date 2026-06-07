import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Loader2, CheckCircle2, X, Calendar, Send } from 'lucide-react';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };

export default function ScheduledReportModal({ onClose, stats, techProductivity, requests }) {
  const [email, setEmail] = useState('');
  const [period, setPeriod] = useState('Mensual');
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeTechs, setIncludeTechs] = useState(true);
  const [includeDepts, setIncludeDepts] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const buildEmailBody = () => {
    const now = new Date().toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
    
    let body = `
      <div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#1a1a2e;background:#f8fafc;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2d5986);padding:32px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:22px;font-weight:700">📊 Reporte ${period}</h1>
          <p style="color:#93c5fd;margin:8px 0 0;font-size:14px">Solicitudes de Automatización · ${now}</p>
        </div>
        <div style="background:white;padding:28px;border-radius:0 0 12px 12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    `;

    if (includeKpis) {
      body += `
        <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 16px">KPIs Generales</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
          ${[
            ['Total', stats.total, '#3b82f6'],
            ['Finalizadas', stats.finalizada, '#22c55e'],
            ['En Proceso', stats.enProgreso, '#f59e0b'],
            ['Pendientes', stats.pendiente, '#8b5cf6'],
            ['Rechazadas', stats.rechazada, '#ef4444'],
            [`Tasa resolución`, `${stats.resolutionRate}%`, '#06b6d4'],
          ].map(([label, value, color]) => `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">
              <p style="margin:0;font-size:22px;font-weight:700;color:${color}">${value}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b">${label}</p>
            </div>
          `).join('')}
        </div>
      `;
      if (stats.vencidas > 0) {
        body += `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px">
          <p style="margin:0;font-size:13px;color:#c2410c">⚠ <strong>${stats.vencidas}</strong> solicitudes vencidas (fecha compromiso expirada sin finalizar)</p>
        </div>`;
      }
    }

    if (includeTechs && techProductivity.length > 0) {
      body += `
        <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:16px 0 12px">Productividad por Técnico</h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px">
          <thead>
            <tr style="background:#1e3a5f;color:white">
              ${['Técnico','Asignadas','Finalizadas','En Proceso','Prom. horas'].map(h => `<th style="padding:8px 10px;text-align:left">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${techProductivity.map((t, i) => `
              <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'}">
                <td style="padding:7px 10px;font-weight:600;color:#1e3a5f">${t.name}</td>
                <td style="padding:7px 10px">${t.Asignadas}</td>
                <td style="padding:7px 10px;color:#16a34a;font-weight:600">${t.Finalizadas}</td>
                <td style="padding:7px 10px;color:#d97706">${t['En Proceso']}</td>
                <td style="padding:7px 10px;color:#9333ea">${t.avgHrs === '—' ? '—' : t.avgHrs + 'h'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (includeDepts && stats.byDept.length > 0) {
      body += `
        <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:16px 0 12px">Por Departamento</h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <thead>
            <tr style="background:#1e3a5f;color:white">
              ${['Departamento','Total','Finalizadas','En Proceso','Pendientes'].map(h => `<th style="padding:8px 10px;text-align:left">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${stats.byDept.map((d, i) => `
              <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'}">
                <td style="padding:7px 10px;font-weight:600">${d.name}</td>
                <td style="padding:7px 10px">${d.total}</td>
                <td style="padding:7px 10px;color:#16a34a">${d.Finalizadas}</td>
                <td style="padding:7px 10px;color:#d97706">${d['En Proceso']}</td>
                <td style="padding:7px 10px;color:#7c3aed">${d.Pendientes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    body += `
          <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
            Reporte generado automáticamente · ${now}
          </p>
        </div>
      </div>
    `;

    return body;
  };

  const handleSend = async () => {
    if (!email.trim()) return;
    setSending(true);
    const emails = email.split(',').map(e => e.trim()).filter(Boolean);
    await Promise.all(emails.map(to =>
      base44.integrations.Core.SendEmail({
        to,
        subject: `📊 Reporte ${period} — Solicitudes de Automatización`,
        body: buildEmailBody(),
      })
    ));
    setSending(false);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-white">Enviar Reporte por Email</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold">¡Reporte enviado!</p>
            <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,55%)' }}>El reporte fue enviado correctamente a {email}</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 rounded-lg text-sm text-white font-medium" style={{ background: 'hsl(217,91%,45%)' }}>
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-300 mb-1 block">Destinatarios (separar por comas)</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ej: jefe@empresa.com, gerente@empresa.com"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300 mb-1 block">Tipo de reporte</label>
              <select value={period} onChange={e => setPeriod(e.target.value)} className={inputCls + ' cursor-pointer'} style={inputStyle}>
                <option>Mensual</option>
                <option>Semanal</option>
                <option>Trimestral</option>
                <option>Anual</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300 mb-2 block">Secciones a incluir</label>
              <div className="space-y-2">
                {[
                  [includeKpis, setIncludeKpis, 'KPIs Generales (totales, tasas, vencidas)'],
                  [includeTechs, setIncludeTechs, 'Productividad por técnico'],
                  [includeDepts, setIncludeDepts, 'Solicitudes por departamento'],
                ].map(([val, setter, label], i) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={e => setter(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'hsl(217,60%,15%)', border: '1px solid hsl(217,60%,25%)' }}>
              <Calendar className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs" style={{ color: 'hsl(215,20%,65%)' }}>
                El reporte se enviará con los datos del período actualmente seleccionado en el dashboard de análisis.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !email.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                style={{ background: 'hsl(217,91%,45%)' }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}