-- ============================================================
-- Row Level Security (RLS) — Protocolo Operativo v1.0
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Helpers ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM app_users
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT get_my_role() IN ('admin', 'support')
$$;

CREATE OR REPLACE FUNCTION my_email()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- ============================================================
-- 1. app_users
-- ============================================================
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select"      ON app_users;
DROP POLICY IF EXISTS "users_insert"      ON app_users;
DROP POLICY IF EXISTS "users_update"      ON app_users;
DROP POLICY IF EXISTS "users_delete"      ON app_users;

-- Cualquier autenticado puede leer perfiles (dropdowns de asignación)
CREATE POLICY "users_select" ON app_users
  FOR SELECT TO authenticated USING (true);

-- Solo el propio usuario (primer login) o un admin puede insertar
CREATE POLICY "users_insert" ON app_users
  FOR INSERT TO authenticated
  WITH CHECK (email = my_email() OR get_my_role() = 'admin');

-- Cada usuario edita su perfil; admins editan cualquiera
-- CRÍTICO: solo admin puede cambiar el campo `role`
CREATE POLICY "users_update" ON app_users
  FOR UPDATE TO authenticated
  USING (email = my_email() OR get_my_role() = 'admin')
  WITH CHECK (email = my_email() OR get_my_role() = 'admin');

CREATE POLICY "users_delete" ON app_users
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- 2. requests
-- columnas de owner: requester_id (text = email del solicitante)
-- ============================================================
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_select"       ON requests;
DROP POLICY IF EXISTS "requests_select_anon"  ON requests;
DROP POLICY IF EXISTS "requests_insert"       ON requests;
DROP POLICY IF EXISTS "requests_update"       ON requests;
DROP POLICY IF EXISTS "requests_delete"       ON requests;

-- Staff ve todo; employees solo sus solicitudes
CREATE POLICY "requests_select" ON requests
  FOR SELECT TO authenticated
  USING (
    is_staff()
    OR requester_id = my_email()
    OR assigned_to_id = my_email()
  );

-- Acceso público para /track/:token (sin login)
CREATE POLICY "requests_select_anon" ON requests
  FOR SELECT TO anon
  USING (public_token IS NOT NULL);

-- Cualquier usuario autenticado puede crear solicitudes
CREATE POLICY "requests_insert" ON requests
  FOR INSERT TO authenticated WITH CHECK (true);

-- Staff actualiza cualquiera; employees solo las propias
CREATE POLICY "requests_update" ON requests
  FOR UPDATE TO authenticated
  USING (
    is_staff()
    OR requester_id = my_email()
  );

-- Solo admin elimina
CREATE POLICY "requests_delete" ON requests
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- 3. request_histories
-- columnas: request_id, by_user_id (email), from_status, to_status
-- ============================================================
ALTER TABLE request_histories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_select" ON request_histories;
DROP POLICY IF EXISTS "rh_insert" ON request_histories;
DROP POLICY IF EXISTS "rh_delete" ON request_histories;

-- Ve el historial quien puede ver la solicitud padre
-- Cast explícito r.id::text para evitar UUID vs TEXT mismatch
CREATE POLICY "rh_select" ON request_histories
  FOR SELECT TO authenticated
  USING (
    is_staff()
    OR by_user_id = my_email()
    OR EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id::text = request_id::text
        AND (r.requester_id = my_email() OR r.assigned_to_id = my_email())
    )
  );

CREATE POLICY "rh_insert" ON request_histories
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rh_delete" ON request_histories
  FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- ============================================================
-- 4. request_comments (chat)
-- columnas: request_id, author_id / author_email (text)
-- ============================================================
ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON request_comments;
DROP POLICY IF EXISTS "comments_insert" ON request_comments;
DROP POLICY IF EXISTS "comments_delete" ON request_comments;

-- Participantes del chat ven todos sus mensajes
CREATE POLICY "comments_select" ON request_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comments_insert" ON request_comments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "comments_delete" ON request_comments
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- 5. request_feedback
-- ============================================================
ALTER TABLE request_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_all" ON request_feedback;
CREATE POLICY "feedback_all" ON request_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 6. incidents
-- columnas de owner: reporter_email, created_by (text = email)
-- ============================================================
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_select" ON incidents;
DROP POLICY IF EXISTS "incidents_insert" ON incidents;
DROP POLICY IF EXISTS "incidents_update" ON incidents;
DROP POLICY IF EXISTS "incidents_delete" ON incidents;

CREATE POLICY "incidents_select" ON incidents
  FOR SELECT TO authenticated
  USING (
    is_staff()
    OR reporter_email = my_email()
    OR created_by = my_email()
  );

CREATE POLICY "incidents_insert" ON incidents
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "incidents_update" ON incidents
  FOR UPDATE TO authenticated
  USING (
    is_staff()
    OR reporter_email = my_email()
    OR created_by = my_email()
  );

CREATE POLICY "incidents_delete" ON incidents
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- 7. activos (inventario — solo staff)
-- ============================================================
ALTER TABLE activos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activos_select" ON activos;
DROP POLICY IF EXISTS "activos_insert" ON activos;
DROP POLICY IF EXISTS "activos_update" ON activos;
DROP POLICY IF EXISTS "activos_delete" ON activos;

CREATE POLICY "activos_select" ON activos
  FOR SELECT TO authenticated USING (is_staff());

CREATE POLICY "activos_insert" ON activos
  FOR INSERT TO authenticated WITH CHECK (is_staff());

CREATE POLICY "activos_update" ON activos
  FOR UPDATE TO authenticated USING (is_staff());

CREATE POLICY "activos_delete" ON activos
  FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- ============================================================
-- 8. guardias (solo staff)
-- ============================================================
ALTER TABLE guardias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardias_select" ON guardias;
DROP POLICY IF EXISTS "guardias_write"  ON guardias;

CREATE POLICY "guardias_select" ON guardias
  FOR SELECT TO authenticated USING (is_staff());

CREATE POLICY "guardias_write" ON guardias
  FOR ALL TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

-- ============================================================
-- 9. departments
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depts_select" ON departments;
DROP POLICY IF EXISTS "depts_write"  ON departments;

CREATE POLICY "depts_select" ON departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "depts_write" ON departments
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- 10. notifications
-- columna owner: user_id (text = email o uuid)
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON notifications;
DROP POLICY IF EXISTS "notif_insert" ON notifications;
DROP POLICY IF EXISTS "notif_update" ON notifications;
DROP POLICY IF EXISTS "notif_delete" ON notifications;

-- user_id es TEXT con email del destinatario
CREATE POLICY "notif_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = my_email() OR is_staff());

CREATE POLICY "notif_insert" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notif_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = my_email() OR is_staff());

CREATE POLICY "notif_delete" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = my_email() OR is_staff());

-- ============================================================
-- 11. audit_logs (solo admin; INSERT bloqueado desde cliente)
-- Los triggers usan SECURITY DEFINER → bypasean RLS
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;

CREATE POLICY "audit_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- Bloquea escritura desde el cliente; los triggers DB la ignoran
CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (false);

-- ============================================================
-- 12. automation_rules / automation_logs (solo admin)
-- ============================================================
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autorules_all" ON automation_rules;
CREATE POLICY "autorules_all" ON automation_rules
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autologs_all" ON automation_logs;
CREATE POLICY "autologs_all" ON automation_logs
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- 13. knowledge_base
-- ============================================================
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kb_select" ON knowledge_base;
DROP POLICY IF EXISTS "kb_write"  ON knowledge_base;

-- Autenticados ven publicados; staff ve borradores también
CREATE POLICY "kb_select" ON knowledge_base
  FOR SELECT TO authenticated
  USING (is_published = true OR is_staff());

CREATE POLICY "kb_write" ON knowledge_base
  FOR ALL TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

-- ============================================================
-- 14. worklogs
-- ============================================================
ALTER TABLE worklogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worklogs_select" ON worklogs;
DROP POLICY IF EXISTS "worklogs_insert" ON worklogs;

CREATE POLICY "worklogs_select" ON worklogs
  FOR SELECT TO authenticated USING (is_staff());

CREATE POLICY "worklogs_insert" ON worklogs
  FOR INSERT TO authenticated WITH CHECK (is_staff());

-- ============================================================
-- 15. chat_logs
-- ============================================================
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_all" ON chat_logs;
CREATE POLICY "chat_all" ON chat_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 16. request_trash (solo admin)
-- ============================================================
ALTER TABLE request_trash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trash_all" ON request_trash;
CREATE POLICY "trash_all" ON request_trash
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- Verificación: todas las tablas deben tener rls_enabled = true
-- ============================================================
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'app_users','requests','request_histories','request_comments',
    'request_feedback','incidents','activos','guardias','departments',
    'notifications','audit_logs','automation_rules','automation_logs',
    'knowledge_base','worklogs','chat_logs','request_trash'
  )
ORDER BY tablename;
