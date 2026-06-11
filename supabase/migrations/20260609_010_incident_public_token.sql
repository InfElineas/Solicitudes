-- ============================================================
-- Migration: 010 — Token público para seguimiento de incidencias
-- Date: 2026-06-09
-- Description: Agrega public_token a incidents para permitir
--              seguimiento público sin autenticación.
--              Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

-- Asignar token único a incidencias existentes que no tengan
UPDATE incidents
  SET public_token = encode(gen_random_bytes(16), 'hex')
  WHERE public_token IS NULL;

-- Verificación:
-- SELECT id, tool_name, public_token FROM incidents LIMIT 5;
