-- ============================================================
-- Migration: 014 — Desactivar usuarios
-- Date: 2026-06-11
-- Description: Agrega is_active a app_users para permitir
--              archivar cuentas sin eliminarlas.
--              DEFAULT TRUE → no rompe registros existentes.
-- ============================================================

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_app_users_active
  ON app_users (is_active) WHERE is_active = TRUE;
