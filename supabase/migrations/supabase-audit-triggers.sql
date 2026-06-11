-- ============================================================
-- Sistema de Auditoría — Triggers automáticos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Tabla audit_logs (crear si no existe) ─────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  entity_title  TEXT,
  field_changed TEXT,
  old_value     TEXT,
  new_value     TEXT,
  snapshot      TEXT,
  by_user_id    TEXT,
  by_user_name  TEXT,
  created_date  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- ── 2. Función trigger — usa to_jsonb() para acceso seguro ────
-- Convierte OLD/NEW a JSONB antes de acceder a campos,
-- evitando errores "record has no field X" en tiempo de ejecución.
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email    text := NULL;
  v_name     text := NULL;
  v_action   text;
  v_etype    text;
  v_eid      text;
  v_title    text;
  v_field    text := NULL;
  v_old_val  text := NULL;
  v_new_val  text := NULL;
  v_snap     text := NULL;
  v_old_json jsonb := '{}';
  v_new_json jsonb := '{}';
BEGIN
  -- ── Leer usuario desde JWT ──────────────────────────────────
  BEGIN
    v_email := nullif(
      current_setting('request.jwt.claims', true)::json->>'email', ''
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_email IS NOT NULL THEN
    SELECT full_name INTO v_name
      FROM app_users WHERE email = v_email LIMIT 1;
    IF v_name IS NULL THEN v_name := v_email; END IF;
  ELSE
    v_email := 'sistema';
    v_name  := 'Sistema';
  END IF;

  -- ── Convertir OLD/NEW a JSONB (acceso seguro a campos) ──────
  IF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    v_snap     := v_old_json::text;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_json := to_jsonb(NEW);
    v_snap     := v_new_json::text;
  ELSE
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_snap     := v_old_json::text;  -- snapshot del estado anterior
  END IF;

  -- ── Tipo de entidad ──────────────────────────────────────────
  v_etype := CASE TG_TABLE_NAME
    WHEN 'requests'  THEN 'request'
    WHEN 'incidents' THEN 'incident'
    WHEN 'activos'   THEN 'activo'
    WHEN 'guardias'  THEN 'guardia'
    ELSE TG_TABLE_NAME
  END;

  -- ── Acceso seguro a campos via JSONB ─────────────────────────
  -- Título: busca los campos en orden según la tabla
  v_eid := CASE WHEN TG_OP = 'DELETE'
    THEN (v_old_json->>'id')
    ELSE (v_new_json->>'id')
  END;

  -- Obtener el título según el tipo de entidad
  v_title := CASE TG_TABLE_NAME
    WHEN 'requests'  THEN CASE WHEN TG_OP = 'DELETE' THEN (v_old_json->>'title')    ELSE (v_new_json->>'title')    END
    WHEN 'incidents' THEN CASE WHEN TG_OP = 'DELETE' THEN (v_old_json->>'tool_name') ELSE (v_new_json->>'tool_name') END
    WHEN 'activos'   THEN CASE WHEN TG_OP = 'DELETE' THEN (v_old_json->>'nombre')   ELSE (v_new_json->>'nombre')   END
    WHEN 'guardias'  THEN 'Guardia ' || coalesce(
      CASE WHEN TG_OP = 'DELETE' THEN (v_old_json->>'tecnico_nombre') ELSE (v_new_json->>'tecnico_nombre') END,
      ''
    )
    ELSE v_eid
  END;

  -- ── Acción + campos cambiados ─────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';

  ELSE
    -- UPDATE: detectar qué cambió
    -- Prioridad 1: status/estado
    IF (v_old_json->>'status') IS DISTINCT FROM (v_new_json->>'status')
       AND (v_old_json->>'status') IS NOT NULL THEN
      v_action  := 'status_change';
      v_field   := 'status';
      v_old_val := v_old_json->>'status';
      v_new_val := v_new_json->>'status';

    ELSIF (v_old_json->>'estado') IS DISTINCT FROM (v_new_json->>'estado')
          AND (v_old_json->>'estado') IS NOT NULL THEN
      v_action  := 'status_change';
      v_field   := 'estado';
      v_old_val := v_old_json->>'estado';
      v_new_val := v_new_json->>'estado';

    -- Prioridad 2: asignación
    ELSIF (v_old_json->>'assigned_to_id') IS DISTINCT FROM (v_new_json->>'assigned_to_id') THEN
      v_action  := 'update';
      v_field   := 'assigned_to';
      v_old_val := v_old_json->>'assigned_to_name';
      v_new_val := v_new_json->>'assigned_to_name';

    ELSIF (v_old_json->>'assigned_to') IS DISTINCT FROM (v_new_json->>'assigned_to')
          AND TG_TABLE_NAME <> 'requests' THEN
      v_action  := 'update';
      v_field   := 'assigned_to';
      v_old_val := v_old_json->>'assigned_to_name';
      v_new_val := v_new_json->>'assigned_to_name';

    -- Prioridad 3: técnico de guardia
    ELSIF (v_old_json->>'tecnico_id') IS DISTINCT FROM (v_new_json->>'tecnico_id') THEN
      v_action  := 'update';
      v_field   := 'tecnico';
      v_old_val := v_old_json->>'tecnico_nombre';
      v_new_val := v_new_json->>'tecnico_nombre';

    -- Prioridad 4: resolución de incidencia
    ELSIF (v_old_json->>'resolution_notes') IS DISTINCT FROM (v_new_json->>'resolution_notes')
          AND (v_new_json->>'resolution_notes') IS NOT NULL THEN
      v_action  := 'update';
      v_field   := 'resolution_notes';
      v_new_val := left(v_new_json->>'resolution_notes', 300);

    -- Prioridad 5: título
    ELSIF (v_old_json->>'title') IS DISTINCT FROM (v_new_json->>'title')
          AND (v_old_json->>'title') IS NOT NULL THEN
      v_action  := 'update';
      v_field   := 'title';
      v_old_val := v_old_json->>'title';
      v_new_val := v_new_json->>'title';

    ELSE
      v_action := 'update';
    END IF;
  END IF;

  -- ── Insertar registro ─────────────────────────────────────────
  INSERT INTO audit_logs (
    action, entity_type, entity_id, entity_title,
    field_changed, old_value, new_value, snapshot,
    by_user_id, by_user_name, created_date
  ) VALUES (
    v_action, v_etype, v_eid, v_title,
    v_field, v_old_val, v_new_val, v_snap,
    v_email, v_name, now()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ── 3. Instalar / reinstalar triggers ────────────────────────
DROP TRIGGER IF EXISTS trg_audit_requests  ON requests;
DROP TRIGGER IF EXISTS trg_audit_incidents ON incidents;
DROP TRIGGER IF EXISTS trg_audit_activos   ON activos;
DROP TRIGGER IF EXISTS trg_audit_guardias  ON guardias;

CREATE TRIGGER trg_audit_requests
  AFTER INSERT OR UPDATE OR DELETE ON requests
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_incidents
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_activos
  AFTER INSERT OR UPDATE OR DELETE ON activos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_guardias
  AFTER INSERT OR UPDATE OR DELETE ON guardias
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
