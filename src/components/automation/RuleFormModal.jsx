import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { TRIGGER_LABELS, ACTION_LABELS } from '../../services/automationEngine';

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: 'hsl(222,47%,18%)', border: '1px solid hsl(217,33%,28%)' };
const selectCls = inputCls + " cursor-pointer";
const labelCls = "text-xs font-medium text-gray-300 mb-1 block";

const STATUSES = ['Pendiente', 'En Proceso', 'En Espera', 'Requiere Información', 'En Validación', 'Finalizado', 'Retrasado', 'Cancelado', 'Rechazado'];
const PRIORITIES = ['P1 — Crítica', 'P2 — Alta', 'P3 — Media', 'P4 — Baja'];

export default function RuleFormModal({ rule, onClose, onSaved }) {
  const isEdit = !!rule;
  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    is_active: rule?.is_active !== false,
    trigger: rule?.trigger || 'stale_48h',
    action: rule?.action || 'send_notification',
    // Condition filters
    cond_status: rule?.conditions?.status || '',
    cond_priority: rule?.conditions?.priority || '',
    // Action config
    email_to: rule?.action_config?.email_to || '',
    notify_user: rule?.action_config?.notify_user || 'assignee',
    message: rule?.action_config?.message || '',
    new_priority: rule?.action_config?.new_priority || 'P2 — Alta',
    new_status: rule?.action_config?.new_status || 'En Proceso',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const conditions = {};
    if (form.cond_status) conditions.status = form.cond_status;
    if (form.cond_priority) conditions.priority = form.cond_priority;

    const action_config = {};
    if (form.action === 'send_email') {
      if (form.email_to) action_config.email_to = form.email_to;
      if (form.message) action_config.message = form.message;
    }
    if (form.action === 'send_notification') {
      action_config.notify_user = form.notify_user;
      if (form.message) action_config.message = form.message;
    }
    if (form.action === 'escalate_priority') {
      action_config.new_priority = form.new_priority;
    }
    if (form.action === 'change_status') {
      action_config.new_status = form.new_status;
    }

    const payload = {
      name: form.name,
      description: form.description,
      is_active: form.is_active,
      trigger: form.trigger,
      action: form.action,
      conditions: Object.keys(conditions).length > 0 ? conditions : null,
      action_config: Object.keys(action_config).length > 0 ? action_config : null,
    };

    if (isEdit) {
      await base44.entities.AutomationRule.update(rule.id, payload);
    } else {
      await base44.entities.AutomationRule.create({ ...payload, run_count: 0 });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'hsl(222,47%,14%)', border: '1px solid hsl(217,33%,22%)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">{isEdit ? 'Editar Regla' : 'Nueva Regla de Automatización'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Nombre de la regla *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className={inputCls} style={inputStyle} placeholder="Ej: Recordatorio 48h sin cambios" />
          </div>

          <div>
            <label className={labelCls}>Descripción (opcional)</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              className={inputCls} style={inputStyle} placeholder="Qué hace esta regla..." />
          </div>

          {/* Trigger */}
          <div>
            <label className={labelCls}>⚡ Disparador (CUANDO)</label>
            <select value={form.trigger} onChange={e => set('trigger', e.target.value)} className={selectCls} style={inputStyle}>
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Conditions */}
          <div className="rounded-lg p-3 space-y-3" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,20%)' }}>
            <p className="text-xs font-semibold text-gray-300">Filtros adicionales (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Solo estado</label>
                <select value={form.cond_status} onChange={e => set('cond_status', e.target.value)} className={selectCls} style={inputStyle}>
                  <option value="">Cualquier estado</option>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Solo prioridad</label>
                <select value={form.cond_priority} onChange={e => set('cond_priority', e.target.value)} className={selectCls} style={inputStyle}>
                  <option value="">Cualquier prioridad</option>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Action */}
          <div>
            <label className={labelCls}>🎯 Acción (ENTONCES)</label>
            <select value={form.action} onChange={e => set('action', e.target.value)} className={selectCls} style={inputStyle}>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Action config based on type */}
          {form.action === 'send_email' && (
            <div className="rounded-lg p-3 space-y-3" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,20%)' }}>
              <div>
                <label className={labelCls}>Destinatario (email)</label>
                <input value={form.email_to} onChange={e => set('email_to', e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="correo@ejemplo.com (vacío = solicitante)" />
              </div>
              <div>
                <label className={labelCls}>Mensaje personalizado (opcional)</label>
                <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={2}
                  className={inputCls + ' resize-none'} style={inputStyle}
                  placeholder="Usa {{title}} y {{status}} como variables" />
              </div>
            </div>
          )}

          {form.action === 'send_notification' && (
            <div className="rounded-lg p-3 space-y-3" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,20%)' }}>
              <div>
                <label className={labelCls}>Notificar a</label>
                <select value={form.notify_user} onChange={e => set('notify_user', e.target.value)} className={selectCls} style={inputStyle}>
                  <option value="assignee">Técnico asignado</option>
                  <option value="requester">Solicitante</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Mensaje (opcional)</label>
                <input value={form.message} onChange={e => set('message', e.target.value)}
                  className={inputCls} style={inputStyle} placeholder='Ej: La solicitud "{{title}}" requiere atención.' />
              </div>
            </div>
          )}

          {form.action === 'escalate_priority' && (
            <div className="rounded-lg p-3" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,20%)' }}>
              <p className="text-xs" style={{ color: 'hsl(215,20%,55%)' }}>
                Sube la prioridad un nivel (Baja → Media → Alta). Si ya es Alta, no cambia.
              </p>
            </div>
          )}

          {form.action === 'change_status' && (
            <div className="rounded-lg p-3" style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,20%)' }}>
              <label className={labelCls}>Cambiar estado a</label>
              <select value={form.new_status} onChange={e => set('new_status', e.target.value)} className={selectCls} style={inputStyle}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500" />
            <label htmlFor="is_active" className="text-sm text-gray-300">Regla activa</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-white/10">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: 'hsl(217,91%,50%)' }}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Regla'}
          </button>
        </div>
      </div>
    </div>
  );
}