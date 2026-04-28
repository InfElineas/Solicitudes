-- ============================================================
-- Migration: 006 — Storage Policies for attachments bucket
-- Date: 2026-04-28
-- Description: Politicas de acceso al bucket "attachments"
--              para que usuarios autenticados puedan subir y
--              leer archivos adjuntos.
-- ============================================================

-- Permitir a usuarios autenticados subir archivos
CREATE POLICY "attachments: upload autenticado"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.role() = 'authenticated'
  );

-- Permitir a usuarios autenticados leer archivos
CREATE POLICY "attachments: leer autenticado"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.role() = 'authenticated'
  );

-- Permitir a usuarios autenticados eliminar sus propios archivos
CREATE POLICY "attachments: eliminar autenticado"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND auth.role() = 'authenticated'
  );
