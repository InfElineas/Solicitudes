-- ============================================================
-- Migration: 007 — Columnas faltantes en knowledge_base y request_trash
-- Date: 2026-05-06
-- Description: Agrega is_published y views a knowledge_base,
--              y deleted_by_id a request_trash.
-- ============================================================

-- ── Knowledge Base: columnas de publicación y conteo de vistas ───────────────
ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS views        INTEGER DEFAULT 0;

-- ── Request Trash: columna de identificador del eliminador ───────────────────
ALTER TABLE request_trash
  ADD COLUMN IF NOT EXISTS deleted_by_id TEXT;
