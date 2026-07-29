import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function WorklogSection({ requestId, worklogs = [], user }) {
  const [showForm, setShowForm] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Worklog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worklogs', requestId] });
      setShowForm(false);
      setMinutes('');
      setNote('');
      toast.success('Tiempo registrado');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      request_id: requestId,
      user_id: user?.email,
      user_name: user?.display_name || user?.full_name || user?.email,
      minutes: Number(minutes),
      note,
    });
  };

  const totalMinutes = worklogs.reduce((sum, w) => sum + (w.minutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Registro de Tiempo</h4>
          <span className="badge-pill bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
            {hours}h {mins}m total
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="text-[hsl(var(--primary))]"
        >
          <Plus className="w-3 h-3 mr-1" /> Agregar
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 rounded-lg bg-[hsl(var(--secondary))] space-y-2">
          <Input
            type="number"
            min="1"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            placeholder="Minutos"
            required
            className="bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
          />
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="h-16 bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" size="sm" className="bg-[hsl(var(--primary))] text-white" disabled={createMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {worklogs.map(w => (
          <div key={w.id} className="flex items-center gap-3 text-xs p-2 rounded bg-[hsl(var(--secondary))]/50">
            <Clock className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
            <span className="font-medium text-[hsl(var(--foreground))]">{w.minutes}min</span>
            <span className="text-[hsl(var(--muted-foreground))] flex-1 truncate">{w.note || '—'}</span>
            <span className="text-[hsl(var(--muted-foreground))]">{w.user_name}</span>
          </div>
        ))}
        {worklogs.length === 0 && !showForm && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin registros de tiempo.</p>
        )}
      </div>
    </div>
  );
}