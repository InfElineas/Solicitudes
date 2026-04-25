import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Trash2, ToggleLeft, ToggleRight, Zap, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { runAutomationEngine, TRIGGER_LABELS, ACTION_LABELS } from '../services/automationEngine';
import RuleFormModal from '../components/automation/RuleFormModal';

const cardStyle = { background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,18%)' };
const muted = 'hsl(215,20%,55%)';

function ResultBadge({ result }) {
  return result === 'success'
    ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" /> OK</span>
    : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" /> Error</span>;
}

export default function AutomationRules() {
  const [user, setUser] = useState(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const qc = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => base44.entities.AutomationRule.list('-created_date'),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['automation-logs'],
    queryFn: () => base44.entities.AutomationLog.list('-created_date', 50),
    enabled: showLogs,
  });

  const handleRunEngine = async () => {
    setRunning(true);
    setRunResult(null);
    const result = await runAutomationEngine(user);
    setRunResult(result);
    setRunning(false);
    qc.invalidateQueries({ queryKey: ['automation-rules'] });
    qc.invalidateQueries({ queryKey: ['automation-logs'] });
    qc.invalidateQueries({ queryKey: ['requests-list'] });
  };

  const toggleRule = async (rule) => {
    await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active });
    qc.invalidateQueries({ queryKey: ['automation-rules'] });
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`¿Eliminar la regla "${rule.name}"?`)) return;
    await base44.entities.AutomationRule.delete(rule.id);
    qc.invalidateQueries({ queryKey: ['automation-rules'] });
  };

  const saved = () => {
    setShowNew(false);
    setEditRule(null);
    qc.invalidateQueries({ queryKey: ['automation-rules'] });
  };

  const activeCount = rules.filter(r => r.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" /> Motor de Reglas de Automatización
          </h1>
          <p className="text-xs mt-0.5" style={{ color: muted }}>
            {activeCount} regla{activeCount !== 1 ? 's' : ''} activa{activeCount !== 1 ? 's' : ''} · Ejecuta manualmente o programa desde aquí.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90"
            style={{ background: 'hsl(217,33%,25%)' }}
          >
            <Plus className="w-4 h-4" /> Nueva Regla
          </button>
          <button
            onClick={handleRunEngine}
            disabled={running || activeCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 disabled:opacity-40"
            style={{ background: 'hsl(217,91%,45%)' }}
          >
            <Play className="w-4 h-4" />
            {running ? 'Ejecutando...' : 'Ejecutar Ahora'}
          </button>
        </div>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-3 flex-wrap" style={{ background: 'hsl(142,40%,12%)', border: '1px solid hsl(142,60%,25%)' }}>
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-green-300">
            Motor ejecutado · <strong>{runResult.rulesRan}</strong> reglas evaluadas ·
            <strong> {runResult.actions}</strong> acciones disparadas ·
            <strong className={runResult.errors > 0 ? 'text-red-400' : ''}> {runResult.errors}</strong> errores
            · {runResult.processed} solicitudes analizadas
          </span>
          <button onClick={() => setRunResult(null)} className="ml-auto text-green-600 hover:text-green-400 text-xs">✕</button>
        </div>
      )}

      {/* Rules list */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'hsl(217,33%,18%)' }}>
          <span className="text-sm font-semibold text-white">Reglas configuradas</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'hsl(217,33%,22%)', color: muted }}>{rules.length} total</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: muted }}>Cargando...</div>
        ) : rules.length === 0 ? (
          <div className="p-10 text-center">
            <Zap className="w-8 h-8 mx-auto mb-3 opacity-30 text-yellow-400" />
            <p className="text-sm font-medium text-white mb-1">Sin reglas configuradas</p>
            <p className="text-xs" style={{ color: muted }}>Crea tu primera regla para automatizar acciones sobre las solicitudes.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'hsl(217,33%,16%)' }}>
            {rules.map(rule => (
              <div key={rule.id} className="px-5 py-4 flex items-start gap-4">
                {/* Toggle */}
                <button onClick={() => toggleRule(rule)} className="mt-0.5 shrink-0" title={rule.is_active ? 'Desactivar' : 'Activar'}>
                  {rule.is_active
                    ? <ToggleRight className="w-6 h-6 text-blue-400" />
                    : <ToggleLeft className="w-6 h-6 text-gray-600" />}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{rule.name}</span>
                    {!rule.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(217,33%,20%)', color: muted }}>INACTIVA</span>}
                  </div>
                  {rule.description && <p className="text-xs mt-0.5" style={{ color: muted }}>{rule.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <TriggerBadge trigger={rule.trigger} />
                    <span className="text-[10px]" style={{ color: muted }}>→</span>
                    <ActionBadge action={rule.action} />
                    {rule.action_config?.new_priority && (
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'hsl(38,50%,18%)', color: '#fbbf24' }}>→ {rule.action_config.new_priority}</span>
                    )}
                    {rule.action_config?.new_status && (
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'hsl(217,50%,18%)', color: '#60a5fa' }}>→ {rule.action_config.new_status}</span>
                    )}
                  </div>
                  {(rule.last_run_at || rule.run_count > 0) && (
                    <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'hsl(215,20%,45%)' }}>
                      <Clock className="w-3 h-3" />
                      {rule.run_count || 0} ejecuciones
                      {rule.last_run_at && ` · Última: ${new Date(rule.last_run_at).toLocaleString('es')}`}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditRule(rule)}
                    className="px-2.5 py-1 rounded text-xs hover:opacity-80 transition-opacity"
                    style={{ background: 'hsl(217,33%,22%)', color: muted }}
                  >Editar</button>
                  <button
                    onClick={() => deleteRule(rule)}
                    className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                    style={{ color: 'hsl(0,60%,60%)' }}
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution Logs toggle */}
      <div className="rounded-xl" style={cardStyle}>
        <button
          onClick={() => setShowLogs(v => !v)}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-white"
        >
          <span>Registro de ejecuciones</span>
          {showLogs ? <ChevronUp className="w-4 h-4" style={{ color: muted }} /> : <ChevronDown className="w-4 h-4" style={{ color: muted }} />}
        </button>

        {showLogs && (
          <div className="border-t" style={{ borderColor: 'hsl(217,33%,18%)' }}>
            {logs.length === 0 ? (
              <p className="px-5 py-4 text-xs" style={{ color: muted }}>Sin ejecuciones registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid hsl(217,33%,18%)' }}>
                      {['Fecha', 'Regla', 'Solicitud', 'Acción', 'Resultado', 'Detalle'].map(h => (
                        <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: 'hsl(215,20%,45%)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid hsl(217,33%,14%)' }}>
                        <td className="px-4 py-2 whitespace-nowrap" style={{ color: muted }}>{new Date(log.created_date).toLocaleString('es')}</td>
                        <td className="px-4 py-2 text-white font-medium">{log.rule_name}</td>
                        <td className="px-4 py-2 truncate max-w-[160px]" style={{ color: '#60a5fa' }}>{log.request_title || '—'}</td>
                        <td className="px-4 py-2" style={{ color: muted }}>{ACTION_LABELS[log.action] || log.action}</td>
                        <td className="px-4 py-2"><ResultBadge result={log.result} /></td>
                        <td className="px-4 py-2 truncate max-w-[200px]" style={{ color: muted }}>{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {(showNew || editRule) && (
        <RuleFormModal
          rule={editRule}
          onClose={() => { setShowNew(false); setEditRule(null); }}
          onSaved={saved}
        />
      )}
    </div>
  );
}

function TriggerBadge({ trigger }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded font-medium"
      style={{ background: 'hsl(38,50%,16%)', color: '#fbbf24' }}>
      ⚡ {TRIGGER_LABELS[trigger] || trigger}
    </span>
  );
}

function ActionBadge({ action }) {
  const colors = {
    send_email: { bg: 'hsl(217,50%,18%)', color: '#60a5fa' },
    escalate_priority: { bg: 'hsl(0,50%,18%)', color: '#f87171' },
    send_notification: { bg: 'hsl(270,50%,18%)', color: '#c084fc' },
    change_status: { bg: 'hsl(142,40%,14%)', color: '#4ade80' },
  };
  const c = colors[action] || { bg: 'hsl(217,33%,20%)', color: 'hsl(215,20%,65%)' };
  return (
    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: c.bg, color: c.color }}>
      {ACTION_LABELS[action] || action}
    </span>
  );
}