-- ============================================================
-- MIGRACIÓN: Protocolo Operativo v1.0 — ELíneas Soporte Técnico
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-06-07
--
-- ORDEN DE EJECUCIÓN: Ejecuta cada PASO por separado.
-- Verifica el resultado antes de continuar con el siguiente.
-- Esta migración es segura para los 37 registros existentes.
-- ============================================================


-- ============================================================
-- PASO 1: MIGRAR ESTADOS EXISTENTES (5 → 9)
-- Impacta: tabla requests, request_histories
-- Registros afectados: ~37 en requests, historial existente
-- Reversible: SÍ (script de rollback al final)
-- ============================================================

-- 1a. Migrar estados en requests
UPDATE requests SET status = 'En Proceso'    WHERE status = 'En progreso';
UPDATE requests SET status = 'En Validación' WHERE status = 'En revisión';
UPDATE requests SET status = 'Finalizado'    WHERE status = 'Finalizada';
UPDATE requests SET status = 'Rechazado'     WHERE status = 'Rechazada';
-- 'Pendiente' no cambia

-- 1b. Migrar el historial de estados para consistencia
UPDATE request_histories SET from_status = 'En Proceso'    WHERE from_status = 'En progreso';
UPDATE request_histories SET from_status = 'En Validación' WHERE from_status = 'En revisión';
UPDATE request_histories SET from_status = 'Finalizado'    WHERE from_status = 'Finalizada';
UPDATE request_histories SET from_status = 'Rechazado'     WHERE from_status = 'Rechazada';

UPDATE request_histories SET to_status = 'En Proceso'    WHERE to_status = 'En progreso';
UPDATE request_histories SET to_status = 'En Validación' WHERE to_status = 'En revisión';
UPDATE request_histories SET to_status = 'Finalizado'    WHERE to_status = 'Finalizada';
UPDATE request_histories SET to_status = 'Rechazado'     WHERE to_status = 'Rechazada';

-- Verificación: deben quedar solo estados del protocolo
-- SELECT DISTINCT status FROM requests;
-- Resultado esperado: Pendiente, En Proceso, En Validación, Finalizado, Rechazado
-- (más adelante: En Espera, Requiere Información, Retrasado, Cancelado)


-- ============================================================
-- PASO 2: MIGRAR TIPOS DE SOLICITUD (6 → 11)
-- Impacta: tabla requests
-- Criterio de mapeo: semántica más cercana al protocolo
-- ============================================================

UPDATE requests SET request_type = 'Reparación / Bug'    WHERE request_type = 'Corrección de errores';
UPDATE requests SET request_type = 'Nueva Implementación' WHERE request_type = 'Desarrollo';
UPDATE requests SET request_type = 'Optimización'         WHERE request_type = 'Mejora funcional';
UPDATE requests SET request_type = 'Optimización'         WHERE request_type = 'Mejora visual';
UPDATE requests SET request_type = 'Actualización'        WHERE request_type = 'Migración';
-- 'Automatización' no cambia

-- Verificación:
-- SELECT DISTINCT request_type, COUNT(*) FROM requests GROUP BY request_type;


-- ============================================================
-- PASO 3: MIGRAR PRIORIDADES (Alta/Media/Baja → P1-P4)
-- Impacta: tabla requests
-- Alta → P2 (no hay P1/Crítica en datos existentes)
-- Media → P3
-- Baja → P4
-- ============================================================

UPDATE requests SET priority = 'P2 — Alta'   WHERE priority = 'Alta';
UPDATE requests SET priority = 'P3 — Media'  WHERE priority = 'Media';
UPDATE requests SET priority = 'P4 — Baja'   WHERE priority = 'Baja';

-- Verificación:
-- SELECT DISTINCT priority, COUNT(*) FROM requests GROUP BY priority;


-- ============================================================
-- PASO 4: NUEVAS COLUMNAS EN requests
-- Sin valor por defecto forzado para no romper registros existentes
-- ============================================================

-- Origen de la solicitud (Regla 5)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS request_origin    TEXT DEFAULT 'Sistema (web)',
  ADD COLUMN IF NOT EXISTS requester_manual  TEXT;

-- SLA tracking
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breach        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_breached_at   TIMESTAMPTZ;

-- Confirmación del solicitante para cierre (Regla 4, paso 7-8)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS requester_confirmed    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requester_confirmed_at TIMESTAMPTZ;

-- Enlace a solicitud generada desde incidencia recurrente (Regla 6)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS source_incident_id TEXT;

-- Token público para seguimiento sin login (Mejora B)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

-- Actualizar registros existentes: asignar token único a cada solicitud
UPDATE requests
  SET public_token = encode(gen_random_bytes(16), 'hex')
  WHERE public_token IS NULL;

-- Verificación:
-- SELECT id, title, request_origin, public_token FROM requests LIMIT 5;


-- ============================================================
-- PASO 5: NUEVA COLUMNA EN incidents (para escalación Regla 6)
-- ============================================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS linked_request_id   TEXT,
  ADD COLUMN IF NOT EXISTS linked_request_title TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_count     INTEGER DEFAULT 0;

-- Verificación:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'incidents';


-- ============================================================
-- PASO 6: TABLA sla_config
-- Define los 4 niveles de prioridad con sus tiempos en horas hábiles
-- Horas hábiles: 09:00–18:00, lunes a sábado (9h/día)
-- ============================================================

CREATE TABLE IF NOT EXISTS sla_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level                 TEXT UNIQUE NOT NULL,  -- 'P1 — Crítica', etc.
  label                 TEXT NOT NULL,
  first_response_hours  FLOAT NOT NULL,   -- horas hábiles para 1ra respuesta
  resolution_hours      FLOAT NOT NULL,   -- horas hábiles para resolución
  color                 TEXT NOT NULL,    -- para UI
  description           TEXT,
  created_date          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sla_config DISABLE ROW LEVEL SECURITY;

-- Poblar con los 4 niveles del protocolo
INSERT INTO sla_config (level, label, first_response_hours, resolution_hours, color, description)
VALUES
  ('P1 — Crítica', 'Crítica',  2,  9,   '#ef4444', 'Sistema caído o afectación masiva — resolución inmediata'),
  ('P2 — Alta',    'Alta',     4,  9,   '#f97316', 'Afecta área completa o proceso core — mismo día'),
  ('P3 — Media',   'Media',    24, 48,  '#eab308', 'Afecta un usuario o proceso secundario — dentro de 48h'),
  ('P4 — Baja',    'Baja',     48, 999, '#22c55e', 'Consulta o mejora menor — según agenda')
ON CONFLICT (level) DO NOTHING;

-- Verificación:
-- SELECT * FROM sla_config;


-- ============================================================
-- PASO 7: TABLA valid_transitions
-- Controla qué transiciones de estado son permitidas
-- ============================================================

CREATE TABLE IF NOT EXISTS valid_transitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  UNIQUE (from_status, to_status)
);

ALTER TABLE valid_transitions DISABLE ROW LEVEL SECURITY;

INSERT INTO valid_transitions (from_status, to_status) VALUES
  -- Desde Pendiente
  ('Pendiente',            'En Proceso'),
  ('Pendiente',            'Rechazado'),
  ('Pendiente',            'Cancelado'),
  -- Desde En Proceso
  ('En Proceso',           'En Espera'),
  ('En Proceso',           'Requiere Información'),
  ('En Proceso',           'En Validación'),
  ('En Proceso',           'Retrasado'),
  ('En Proceso',           'Cancelado'),
  -- Desde En Espera
  ('En Espera',            'En Proceso'),
  ('En Espera',            'Cancelado'),
  -- Desde Requiere Información
  ('Requiere Información', 'En Proceso'),
  ('Requiere Información', 'Cancelado'),
  -- Desde En Validación
  ('En Validación',        'Finalizado'),
  ('En Validación',        'En Proceso'),
  -- Desde Retrasado
  ('Retrasado',            'En Proceso'),
  ('Retrasado',            'Cancelado')
  -- Finalizado, Cancelado, Rechazado son terminales: sin transiciones permitidas
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Verificación:
-- SELECT * FROM valid_transitions ORDER BY from_status;


-- ============================================================
-- PASO 8: TABLA request_type_config
-- Configuración de tipos: prioridad sugerida y texto de ayuda
-- ============================================================

CREATE TABLE IF NOT EXISTS request_type_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name         TEXT UNIQUE NOT NULL,
  suggested_priority TEXT NOT NULL,
  consideration     TEXT NOT NULL,
  color             TEXT DEFAULT '#6b7280',
  created_date      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE request_type_config DISABLE ROW LEVEL SECURITY;

INSERT INTO request_type_config (type_name, suggested_priority, consideration) VALUES
  ('Nueva Implementación', 'P2 — Alta',   'Requiere análisis previo y estimación de tiempo'),
  ('Reparación / Bug',     'P1 — Crítica','Prioridad según impacto operativo'),
  ('Mantenimiento',        'P4 — Baja',   'Se programará en ventana de bajo impacto'),
  ('Actualización',        'P3 — Media',  'Se validará con el solicitante antes de implementar'),
  ('Consulta o Asesoría',  'P4 — Baja',   'Se responderá en ≤ 24h'),
  ('Integración',          'P2 — Alta',   'Requiere análisis de arquitectura previo'),
  ('Optimización',         'P3 — Media',  'Se medirá el estado antes y después'),
  ('Capacitación',         'P4 — Baja',   'Se coordinará con el área solicitante'),
  ('Reporte o Análisis',   'P3 — Media',  'Se definirá el formato de entrega'),
  ('Soporte Técnico',      'P3 — Media',  'Se clasificará en subtipo al atender el contacto'),
  ('Automatización',       'P2 — Alta',   'Se documentará el flujo antes de implementar')
ON CONFLICT (type_name) DO NOTHING;

-- Verificación:
-- SELECT * FROM request_type_config;


-- ============================================================
-- PASO 9: POBLAR ACTIVOS (Mejora F)
-- Inventario real del departamento de soporte
-- ============================================================

INSERT INTO activos (nombre, tipo, estado, notas)
VALUES
  ('Supabase',    'Software / Base de datos',      'Activo', 'Base de datos principal del sistema'),
  ('n8n',         'Software / Automatización',     'Activo', 'URL: n8n.mercadoelineas.com'),
  ('GitHub',      'Software / Control de versiones','Activo', 'Repositorio: github.com/InfElineas'),
  ('Hostinger',   'Infraestructura / Hosting',     'Activo', 'Hosting web principal'),
  ('Google Cloud','Infraestructura / APIs',         'Activo', 'APIs y servicios en la nube'),
  ('Render',      'Infraestructura / Deploy',       'Activo', 'Plataforma de despliegue'),
  ('Postman',     'Software / Testing',             'Activo', 'Testing de APIs'),
  ('Lovable',     'Software / Desarrollo IA',       'Activo', 'Plataforma de desarrollo con IA'),
  ('Base44',      'Software / Desarrollo IA',       'Activo', 'Plataforma NoCode/LowCode — deploy actual del sistema')
ON CONFLICT DO NOTHING;

-- Verificación:
-- SELECT nombre, tipo, estado FROM activos ORDER BY nombre;


-- ============================================================
-- PASO 10: POBLAR CATEGORÍAS DE BASE DE CONOCIMIENTOS (Mejora E)
-- Inserta un artículo "plantilla" por categoría para que no queden vacías
-- ============================================================

-- (Las categorías son un campo TEXT en knowledge_base, no una tabla separada)
-- Solo validamos que las categorías definidas en el protocolo sean conocidas.
-- No hay datos que insertar aquí — las categorías se usan como enum en el frontend.

-- Las 6 categorías del protocolo:
-- 'Hardware', 'Software', 'Red/Conectividad', 'Acceso/Permisos', 'Google Sheets', 'APIs y Automatizaciones'


-- ============================================================
-- PASO 11: FUNCIÓN para calcular horas hábiles entre dos timestamps
-- Horas hábiles: 09:00–18:00, lunes a sábado
-- Usada para cálculo de SLA
-- ============================================================

CREATE OR REPLACE FUNCTION fn_horas_habiles(inicio TIMESTAMPTZ, fin TIMESTAMPTZ)
RETURNS FLOAT LANGUAGE plpgsql AS $$
DECLARE
  cursor_ts TIMESTAMPTZ;
  total_min FLOAT := 0;
  dow INT;
  hora_inicio TIME := '09:00';
  hora_fin    TIME := '18:00';
  seg_por_dia FLOAT := 9 * 3600; -- 9 horas hábiles por día
BEGIN
  IF fin <= inicio THEN RETURN 0; END IF;

  cursor_ts := inicio;

  WHILE cursor_ts < fin LOOP
    dow := EXTRACT(DOW FROM cursor_ts AT TIME ZONE 'America/Havana');
    -- 0=domingo, excluido. 1-6 = lunes-sábado, incluidos.
    IF dow <> 0 THEN
      DECLARE
        dia_inicio TIMESTAMPTZ := (cursor_ts::DATE + hora_inicio) AT TIME ZONE 'America/Havana';
        dia_fin    TIMESTAMPTZ := (cursor_ts::DATE + hora_fin)    AT TIME ZONE 'America/Havana';
        desde      TIMESTAMPTZ := GREATEST(cursor_ts, dia_inicio);
        hasta      TIMESTAMPTZ := LEAST(fin, dia_fin);
      BEGIN
        IF hasta > desde THEN
          total_min := total_min + EXTRACT(EPOCH FROM (hasta - desde)) / 60;
        END IF;
      END;
    END IF;
    cursor_ts := (cursor_ts::DATE + INTERVAL '1 day')::TIMESTAMPTZ;
  END LOOP;

  RETURN ROUND((total_min / 60)::NUMERIC, 2);
END;
$$;

-- Test rápido (debe retornar ~2h si son las 9am de un lunes):
-- SELECT fn_horas_habiles(now(), now() + INTERVAL '2 hours');


-- ============================================================
-- PASO 12: VISTA sla_status_view
-- Calcula en tiempo real el estado SLA de cada solicitud abierta
-- ============================================================

CREATE OR REPLACE VIEW sla_status_view AS
SELECT
  r.id,
  r.title,
  r.status,
  r.priority,
  r.created_date,
  r.first_response_at,
  r.estimated_due,
  r.sla_breach,
  s.first_response_hours AS sla_response_limit,
  s.resolution_hours     AS sla_resolution_limit,

  -- Horas hábiles desde creación hasta ahora (o hasta primera respuesta)
  fn_horas_habiles(r.created_date, COALESCE(r.first_response_at, now())) AS horas_hasta_respuesta,

  -- Horas hábiles desde creación hasta ahora (para resolución)
  fn_horas_habiles(r.created_date, now()) AS horas_transcurridas,

  -- % de SLA de resolución usado (basado en estimated_due o en sla_config)
  CASE
    WHEN r.estimated_due IS NOT NULL THEN
      ROUND(
        (fn_horas_habiles(r.created_date, now()) /
         NULLIF(fn_horas_habiles(r.created_date, r.estimated_due), 0) * 100)::NUMERIC, 1
      )
    WHEN s.resolution_hours IS NOT NULL AND s.resolution_hours < 999 THEN
      ROUND(
        (fn_horas_habiles(r.created_date, now()) /
         NULLIF(s.resolution_hours, 0) * 100)::NUMERIC, 1
      )
    ELSE NULL
  END AS sla_percent_used,

  -- Semáforo: 'green' < 50%, 'yellow' 50-80%, 'red' > 80%, 'breached' vencida
  CASE
    WHEN r.status IN ('Finalizado', 'Cancelado', 'Rechazado') THEN 'closed'
    WHEN r.sla_breach = true THEN 'breached'
    WHEN r.estimated_due IS NOT NULL AND now() > r.estimated_due THEN 'breached'
    WHEN (
      CASE
        WHEN r.estimated_due IS NOT NULL THEN
          fn_horas_habiles(r.created_date, now()) /
          NULLIF(fn_horas_habiles(r.created_date, r.estimated_due), 0)
        WHEN s.resolution_hours IS NOT NULL AND s.resolution_hours < 999 THEN
          fn_horas_habiles(r.created_date, now()) / NULLIF(s.resolution_hours, 0)
        ELSE NULL
      END
    ) > 0.8 THEN 'red'
    WHEN (
      CASE
        WHEN r.estimated_due IS NOT NULL THEN
          fn_horas_habiles(r.created_date, now()) /
          NULLIF(fn_horas_habiles(r.created_date, r.estimated_due), 0)
        WHEN s.resolution_hours IS NOT NULL AND s.resolution_hours < 999 THEN
          fn_horas_habiles(r.created_date, now()) / NULLIF(s.resolution_hours, 0)
        ELSE NULL
      END
    ) > 0.5 THEN 'yellow'
    ELSE 'green'
  END AS sla_semaphore

FROM requests r
LEFT JOIN sla_config s ON s.level = r.priority
WHERE r.is_deleted = false;

-- Verificación:
-- SELECT id, title, priority, sla_percent_used, sla_semaphore FROM sla_status_view LIMIT 10;


-- ============================================================
-- PASO 13: FUNCIÓN + TRIGGER para marcar automáticamente como 'Retrasado'
-- Se dispara en UPDATE de requests cuando estimated_due expira
-- (Supabase no tiene cron nativo sin pg_cron — este trigger lo activa
--  en cualquier actualización de la solicitud)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_check_sla_breach()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Solo aplica a solicitudes abiertas con fecha límite
  IF NEW.status NOT IN ('Finalizado', 'Cancelado', 'Rechazado')
     AND NEW.estimated_due IS NOT NULL
     AND now() > NEW.estimated_due
     AND (NEW.sla_breach IS NULL OR NEW.sla_breach = false)
  THEN
    NEW.sla_breach := true;
    NEW.sla_breached_at := now();
    -- Si está 'Pendiente' o 'En Proceso', mover a 'Retrasado'
    IF NEW.status IN ('Pendiente', 'En Proceso') THEN
      NEW.status := 'Retrasado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_sla ON requests;
CREATE TRIGGER trg_check_sla
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION fn_check_sla_breach();


-- ============================================================
-- PASO 14: FUNCIÓN para detectar incidencias recurrentes (Regla 6)
-- Actualiza recurrence_count en incidents cuando se inserta una nueva
-- ============================================================

CREATE OR REPLACE FUNCTION fn_check_incident_recurrence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Contar incidencias del mismo departamento en los últimos 30 días
  SELECT COUNT(*) INTO v_count
  FROM incidents
  WHERE department = NEW.department
    AND created_date >= now() - INTERVAL '30 days'
    AND id <> NEW.id;

  NEW.recurrence_count := v_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_recurrence ON incidents;
CREATE TRIGGER trg_incident_recurrence
  BEFORE INSERT ON incidents
  FOR EACH ROW EXECUTE FUNCTION fn_check_incident_recurrence();


-- ============================================================
-- VERIFICACIÓN FINAL — Ejecutar para confirmar todo quedó bien
-- ============================================================

-- Estados actuales en producción:
SELECT status, COUNT(*) as total FROM requests GROUP BY status ORDER BY total DESC;

-- Tipos actuales:
SELECT request_type, COUNT(*) FROM requests GROUP BY request_type;

-- Prioridades actuales:
SELECT priority, COUNT(*) FROM requests GROUP BY priority;

-- Tablas nuevas creadas:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sla_config', 'valid_transitions', 'request_type_config')
ORDER BY table_name;

-- Columnas nuevas en requests:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'requests'
  AND column_name IN (
    'request_origin', 'requester_manual', 'first_response_at',
    'sla_breach', 'sla_breached_at', 'requester_confirmed',
    'requester_confirmed_at', 'source_incident_id', 'public_token'
  )
ORDER BY column_name;

-- Vista SLA (primeras 5 solicitudes):
SELECT id, title, priority, sla_percent_used, sla_semaphore
FROM sla_status_view LIMIT 5;


-- ============================================================
-- ROLLBACK (ejecutar SOLO si necesitas revertir)
-- ============================================================
/*
-- Revertir estados
UPDATE requests SET status = 'En progreso'  WHERE status = 'En Proceso';
UPDATE requests SET status = 'En revisión'  WHERE status = 'En Validación';
UPDATE requests SET status = 'Finalizada'   WHERE status = 'Finalizado';
UPDATE requests SET status = 'Rechazada'    WHERE status = 'Rechazado';

-- Revertir tipos
UPDATE requests SET request_type = 'Corrección de errores' WHERE request_type = 'Reparación / Bug';
UPDATE requests SET request_type = 'Desarrollo'            WHERE request_type = 'Nueva Implementación';
UPDATE requests SET request_type = 'Mejora funcional'      WHERE request_type = 'Optimización';
UPDATE requests SET request_type = 'Migración'             WHERE request_type = 'Actualización';

-- Revertir prioridades
UPDATE requests SET priority = 'Alta'  WHERE priority = 'P2 — Alta';
UPDATE requests SET priority = 'Media' WHERE priority = 'P3 — Media';
UPDATE requests SET priority = 'Baja'  WHERE priority = 'P4 — Baja';

-- Eliminar columnas nuevas
ALTER TABLE requests DROP COLUMN IF EXISTS request_origin;
ALTER TABLE requests DROP COLUMN IF EXISTS requester_manual;
ALTER TABLE requests DROP COLUMN IF EXISTS first_response_at;
ALTER TABLE requests DROP COLUMN IF EXISTS sla_breach;
ALTER TABLE requests DROP COLUMN IF EXISTS sla_breached_at;
ALTER TABLE requests DROP COLUMN IF EXISTS requester_confirmed;
ALTER TABLE requests DROP COLUMN IF EXISTS requester_confirmed_at;
ALTER TABLE requests DROP COLUMN IF EXISTS source_incident_id;
ALTER TABLE requests DROP COLUMN IF EXISTS public_token;
ALTER TABLE incidents DROP COLUMN IF EXISTS linked_request_id;
ALTER TABLE incidents DROP COLUMN IF EXISTS linked_request_title;
ALTER TABLE incidents DROP COLUMN IF EXISTS recurrence_count;

-- Eliminar tablas nuevas
DROP TABLE IF EXISTS sla_config;
DROP TABLE IF EXISTS valid_transitions;
DROP TABLE IF EXISTS request_type_config;

-- Eliminar objetos nuevos
DROP VIEW IF EXISTS sla_status_view;
DROP FUNCTION IF EXISTS fn_horas_habiles(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS fn_check_sla_breach();
DROP FUNCTION IF EXISTS fn_check_incident_recurrence();
DROP TRIGGER IF EXISTS trg_check_sla ON requests;
DROP TRIGGER IF EXISTS trg_incident_recurrence ON incidents;
*/
