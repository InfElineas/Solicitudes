import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedbackSection({ requestId, feedback, user }) {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RequestFeedback.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', requestId] });
      toast.success('Feedback enviado');
    },
  });

  if (feedback) {
    return (
      <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]/50">
        <div className="flex items-center gap-2">
          {feedback.rating === 'up' ? (
            <ThumbsUp className="w-4 h-4 text-green-400" />
          ) : (
            <ThumbsDown className="w-4 h-4 text-red-400" />
          )}
          <span className="text-sm text-[hsl(var(--foreground))]">
            {feedback.rating === 'up' ? 'Satisfecho' : 'Insatisfecho'}
          </span>
        </div>
        {feedback.comment && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{feedback.comment}</p>
        )}
      </div>
    );
  }

  const handleSubmit = () => {
    if (!rating) return;
    createMutation.mutate({
      request_id: requestId,
      rating,
      comment,
      by_user_id: user?.email,
      by_user_name: user?.display_name || user?.full_name || user?.email,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[hsl(var(--foreground))]">¿Cómo fue tu experiencia?</p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRating('up')}
          className={`${rating === 'up' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}
        >
          <ThumbsUp className="w-4 h-4 mr-1" /> Bien
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRating('down')}
          className={`${rating === 'down' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}
        >
          <ThumbsDown className="w-4 h-4 mr-1" /> Mal
        </Button>
      </div>
      {rating && (
        <>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Comentario (opcional)"
            className="h-16 bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
          />
          <Button size="sm" onClick={handleSubmit} className="bg-[hsl(var(--primary))] text-white" disabled={createMutation.isPending}>
            Enviar Feedback
          </Button>
        </>
      )}
    </div>
  );
}