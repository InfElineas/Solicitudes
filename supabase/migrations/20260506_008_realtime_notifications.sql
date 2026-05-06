-- ============================================================
-- Migration: 008 — Habilitar Realtime en tabla notifications
-- Date: 2026-05-06
-- Description: Activa REPLICA IDENTITY FULL y añade la tabla
--              notifications a la publicación supabase_realtime
--              para que el cliente reciba cambios en tiempo real
--              sin depender de polling.
-- ============================================================

-- Necesario para que Realtime pueda enviar la fila completa
-- (no solo la PK) y para que los filtros por columna funcionen.
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Añadir a la publicación solo si no está ya incluida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname   = 'supabase_realtime'
      AND  tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
