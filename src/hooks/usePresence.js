import { useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

/**
 * Keeps `last_seen_at` updated in app_users for the current user.
 * Used to show online status indicators in the assign modal.
 * Fails silently if the column doesn't exist yet.
 */
export function usePresence(userEmail) {
  useEffect(() => {
    if (!userEmail) return;
    const update = () => {
      supabase.from('app_users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('email', userEmail)
        .then(() => {}).catch(() => {});
    };
    update();
    const interval = setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
      supabase.from('app_users')
        .update({ last_seen_at: null })
        .eq('email', userEmail)
        .then(() => {}).catch(() => {});
    };
  }, [userEmail]);
}
