-- ============================================================
-- Migration: 012 — Soft-delete universal
-- Date: 2026-06-11
-- Description: Agrega is_deleted + deleted_by_name a las tablas
--              activos, knowledge_base e incidents para que el
--              borrado desde la UI sea reversible (papelera).
-- ============================================================

ALTER TABLE activos
  ADD COLUMN IF NOT EXISTS is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

-- Índices para que los filtros is_deleted=false sean rápidos
CREATE INDEX IF NOT EXISTS idx_activos_not_deleted
  ON activos (is_deleted) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_not_deleted
  ON knowledge_base (is_deleted) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_incidents_not_deleted
  ON incidents (is_deleted) WHERE is_deleted = FALSE;
