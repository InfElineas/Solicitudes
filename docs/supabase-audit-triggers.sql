-- ============================================================
-- Triggers de Auditoría — Protocolo Operativo v1.0
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================
-- Registra automáticamente: CREATE, UPDATE, DELETE, STATUS_CHANGE
-- en las tablas: requests, incidents, activos, guardias
-- hacia la tabla: audit_logs
-- ============================================================

-- 1. Función genérica de auditoría
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _entity_type  TEXT;
  _entity_id    TEXT;
  _entity_title TEXT;
  _action       TEXT;
  _field        TEXT;
  _old_val      TEXT;
  _new_val      TEXT;
  _snapshot     TEXT;
BEGIN
  _entity_type := TG_TABLE_NAME;
  IF _entity_type = 'requests'  THEN _entity_type := 'request';  END IF;
  IF _entity_type = 'incidents' THEN _entity_type := 'incident'; END IF;

  IF TG_OP = 'DELETE' THEN
    _entity_id := OLD.id::TEXT;
    CASE TG_TABLE_NAME
      WHEN 'requests'  THEN _entity_title := COALESCE(OLD.title, '—');
      WHEN 'incidents' THEN _entity_title := COALESCE(OLD.tool_name, OLD.description, '—');
      WHEN 'activos'   THEN _entity_title := COALESCE(OLD.nombre, '—');
      WHEN 'guardias'  THEN _entity_title := COALESCE(OLD.tecnico_name, '—');
      ELSE                  _entity_title := '—';
    END CASE;
    _action   := 'delete';
    _snapshot := row_to_json(OLD)::TEXT;
    INSERT INTO audit_logs (entity_type, entity_id, entity_title, action, snapshot, created_date)
    VALUES (_entity_type, _entity_id, _entity_title, _action, _snapshot, NOW());
    RETURN OLD;
  END IF;

  _entity_id := NEW.id::TEXT;
  CASE TG_TABLE_NAME
    WHEN 'requests'  THEN _entity_title := COALESCE(NEW.title, '—');
    WHEN 'incidents' THEN _entity_title := COALESCE(NEW.tool_name, NEW.description, '—');
    WHEN 'activos'   THEN _entity_title := COALESCE(NEW.nombre, '—');
    WHEN 'guardias'  THEN _entity_title := COALESCE(NEW.tecnico_nombre, '—');
    ELSE                  _entity_title := '—';
  END CASE;
  _snapshot := row_to_json(NEW)::TEXT;

  IF TG_OP = 'INSERT' THEN
    _action := 'create';
  ELSE
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := 'status_change'; _field := 'status';
      _old_val := OLD.status; _new_val := NEW.status;
    ELSE
      _action := 'update';
      IF TG_TABLE_NAME = 'requests' THEN
        IF OLD.title IS DISTINCT FROM NEW.title THEN
          _field := 'title'; _old_val := OLD.title; _new_val := NEW.title;
        ELSIF OLD.priority IS DISTINCT FROM NEW.priority THEN
          _field := 'priority'; _old_val := OLD.priority; _new_val := NEW.priority;
        ELSIF OLD.assigned_to_id IS DISTINCT FROM NEW.assigned_to_id THEN
          _field := 'assigned_to_id';
          _old_val := OLD.assigned_to_id; _new_val := NEW.assigned_to_id;
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO audit_logs (
    entity_type, entity_id, entity_title, action,
    field_changed, old_value, new_value, snapshot, created_date
  ) VALUES (
    _entity_type, _entity_id, _entity_title, _action,
    _field, _old_val, _new_val, _snapshot, NOW()
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Eliminar triggers existentes (idempotente)
-- ============================================================
DROP TRIGGER IF EXISTS trg_audit_requests  ON requests;
DROP TRIGGER IF EXISTS trg_audit_incidents ON incidents;
DROP TRIGGER IF EXISTS trg_audit_activos   ON activos;
DROP TRIGGER IF EXISTS trg_audit_guardias  ON guardias;

-- ============================================================
-- 3. Crear triggers en cada tabla
-- ============================================================
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

-- ============================================================
-- 4. Verificar instalación
-- ============================================================
SELECT tgname, relname
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname LIKE 'trg_audit_%'
ORDER BY relname;

-- Resultado esperado:
-- trg_audit_activos   | activos
-- trg_audit_guardias  | guardias
-- trg_audit_incidents | incidents
-- trg_audit_requests  | requests
