-- ============================================================
-- Migration: 013 — Email log
-- Date: 2026-06-11
-- Description: Tabla de auditoría para todos los intentos de
--              envío de correo desde la plataforma.
--              Registra éxitos y fallos para diagnóstico.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email      TEXT        NOT NULL,
  subject       TEXT        NOT NULL,
  status        TEXT        NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_date  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status  ON email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_to      ON email_logs (to_email);

-- Los usuarios autenticados pueden insertar y leer sus propios logs
-- Solo admins/support deberían leer todos — RLS opcional, por ahora abierto a authenticated
GRANT SELECT, INSERT ON email_logs TO authenticated;
