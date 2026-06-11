-- ============================================================
-- Migration: 011 — RPC atómico record_status_change
-- Date: 2026-06-11
-- Description: Agrupa UPDATE de requests + INSERT en
--              request_histories en una sola transacción de BD.
--              Elimina la posibilidad de estados inconsistentes
--              cuando falla la segunda llamada en el patrón de
--              dos llamadas separadas del frontend.
--
--              También agrega las transiciones nuevas del
--              Protocolo Operativo actualizado (v1.1).
-- ============================================================


-- ============================================================
-- FUNCIÓN: record_status_change
-- Parámetros obligatorios: request_id, to_status, note,
--   by_user_id, by_user_name
-- Parámetros opcionales (NULL = no modificar):
--   started_at, completion_date, actual_hours,
--   rejection_reason, file_urls,
--   assigned_to_id, assigned_to_name
-- Retorna: TEXT con el from_status anterior
-- ============================================================

CREATE OR REPLACE FUNCTION record_status_change(
  p_request_id       TEXT,
  p_to_status        TEXT,
  p_note             TEXT,
  p_by_user_id       TEXT,
  p_by_user_name     TEXT,
  p_started_at       TIMESTAMPTZ DEFAULT NULL,
  p_completion_date  TIMESTAMPTZ DEFAULT NULL,
  p_actual_hours     FLOAT       DEFAULT NULL,
  p_rejection_reason TEXT        DEFAULT NULL,
  p_file_urls        JSONB       DEFAULT NULL,
  p_assigned_to_id   TEXT        DEFAULT NULL,
  p_assigned_to_name TEXT        DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_status TEXT;
BEGIN
  -- Bloquea la fila para prevenir modificaciones concurrentes
  SELECT status INTO v_from_status
  FROM requests
  WHERE id = p_request_id::UUID
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada: %', p_request_id;
  END IF;

  -- Actualiza la solicitud — solo sobreescribe campos no-NULL
  UPDATE requests SET
    status           = p_to_status,
    updated_date     = NOW(),
    started_at       = COALESCE(p_started_at,       started_at),
    completion_date  = COALESCE(p_completion_date,  completion_date),
    actual_hours     = COALESCE(p_actual_hours,     actual_hours),
    rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
    file_urls        = CASE WHEN p_file_urls IS NOT NULL THEN p_file_urls ELSE file_urls END,
    assigned_to_id   = COALESCE(p_assigned_to_id,   assigned_to_id),
    assigned_to_name = COALESCE(p_assigned_to_name, assigned_to_name)
  WHERE id = p_request_id::UUID;

  -- Crea entrada de historial en la misma transacción
  INSERT INTO request_histories (
    request_id, from_status, to_status,
    note, by_user_id, by_user_name, created_date
  ) VALUES (
    p_request_id, v_from_status, p_to_status,
    p_note, p_by_user_id, p_by_user_name, NOW()
  );

  RETURN v_from_status;
END;
$$;

-- Permite que usuarios autenticados llamen la función
GRANT EXECUTE ON FUNCTION record_status_change TO authenticated;


-- ============================================================
-- NUEVAS TRANSICIONES — Protocolo Operativo v1.1
-- Agrega las rutas que faltaban para estados de bloqueo
-- ============================================================

INSERT INTO valid_transitions (from_status, to_status) VALUES
  -- Pendiente puede bloquearse antes de iniciar
  ('Pendiente',            'En Espera'),
  ('Pendiente',            'Requiere Información'),
  -- Estados de bloqueo pueden ir directo a validación
  ('En Espera',            'En Validación'),
  ('Requiere Información', 'En Validación'),
  ('Retrasado',            'En Validación')
ON CONFLICT (from_status, to_status) DO NOTHING;
