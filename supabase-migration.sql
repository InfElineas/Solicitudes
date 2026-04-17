-- ============================================================
-- Supabase Migration — Solicitudes de Automatización
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Requests
CREATE TABLE IF NOT EXISTS requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  description   TEXT,
  status        TEXT DEFAULT 'Pendiente',
  priority      TEXT DEFAULT 'Media',
  request_type  TEXT,
  level         TEXT,
  requester_id  TEXT,
  requester_name TEXT,
  assigned_to_id   TEXT,
  assigned_to_name TEXT,
  department_ids   JSONB DEFAULT '[]',
  department_names JSONB DEFAULT '[]',
  estimated_hours  FLOAT,
  estimated_due    TIMESTAMPTZ,
  completion_date  TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  actual_hours     FLOAT,
  file_urls        JSONB DEFAULT '[]',
  is_deleted       BOOLEAN DEFAULT false,
  approval_notes   TEXT,
  approved_by      TEXT,
  approved_by_name TEXT,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_date     TIMESTAMPTZ DEFAULT now(),
  updated_date     TIMESTAMPTZ DEFAULT now()
);

-- Request Histories
CREATE TABLE IF NOT EXISTS request_histories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   TEXT,
  from_status  TEXT,
  to_status    TEXT,
  note         TEXT,
  by_user_id   TEXT,
  by_user_name TEXT,
  created_date TIMESTAMPTZ DEFAULT now()
);

-- Request Trash
CREATE TABLE IF NOT EXISTS request_trash (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      TEXT,
  deleted_by      TEXT,
  deleted_by_name TEXT,
  title           TEXT,
  created_date    TIMESTAMPTZ DEFAULT now()
);

-- Request Comments
CREATE TABLE IF NOT EXISTS request_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      TEXT,
  content         TEXT,
  author_id       TEXT,
  author_name     TEXT,
  file_urls       JSONB DEFAULT '[]',
  mentioned_users JSONB DEFAULT '[]',
  created_date    TIMESTAMPTZ DEFAULT now()
);

-- Request Feedback
CREATE TABLE IF NOT EXISTS request_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   TEXT,
  rating       TEXT,
  comment      TEXT,
  by_user_id   TEXT,
  by_user_name TEXT,
  created_date TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,
  type          TEXT,
  title         TEXT,
  message       TEXT,
  request_id    TEXT,
  request_title TEXT,
  is_read       BOOLEAN DEFAULT false,
  created_date  TIMESTAMPTZ DEFAULT now()
);

-- Worklogs
CREATE TABLE IF NOT EXISTS worklogs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   TEXT,
  user_id      TEXT,
  user_name    TEXT,
  minutes      INTEGER,
  note         TEXT,
  created_date TIMESTAMPTZ DEFAULT now()
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT,
  description  TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- App Users (profiles — separate from auth.users)
CREATE TABLE IF NOT EXISTS app_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  full_name     TEXT,
  display_name  TEXT,
  role          TEXT DEFAULT 'employee',
  department    TEXT,
  department_id TEXT,
  avatar_url    TEXT,
  created_date  TIMESTAMPTZ DEFAULT now(),
  updated_date  TIMESTAMPTZ DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT,
  entity       TEXT,
  entity_id    TEXT,
  user_id      TEXT,
  user_name    TEXT,
  details      JSONB,
  created_date TIMESTAMPTZ DEFAULT now()
);

-- Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT,
  trigger_type TEXT,
  conditions   JSONB DEFAULT '[]',
  actions      JSONB DEFAULT '[]',
  is_active    BOOLEAN DEFAULT true,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- Automation Logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          TEXT,
  request_id       TEXT,
  triggered_at     TIMESTAMPTZ,
  actions_executed JSONB DEFAULT '[]',
  created_date     TIMESTAMPTZ DEFAULT now()
);

-- Chat Logs
CREATE TABLE IF NOT EXISTS chat_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    TEXT,
  entity_type  TEXT,
  message      TEXT,
  sender_id    TEXT,
  sender_name  TEXT,
  created_date TIMESTAMPTZ DEFAULT now()
);

-- Knowledge Base
CREATE TABLE IF NOT EXISTS knowledge_base (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT,
  content      TEXT,
  category     TEXT,
  tags         JSONB DEFAULT '[]',
  author_id    TEXT,
  author_name  TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- Guardias (shifts)
CREATE TABLE IF NOT EXISTS guardias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id            TEXT,
  tecnico_nombre        TEXT,
  inicio                TIMESTAMPTZ,
  fin                   TIMESTAMPTZ,
  estado                TEXT DEFAULT 'programada',
  tipo                  TEXT DEFAULT 'normal',
  observaciones         TEXT,
  reemplazado_por_id    TEXT,
  reemplazado_por_nombre TEXT,
  creada_por            TEXT,
  creada_por_nombre     TEXT,
  created_date          TIMESTAMPTZ DEFAULT now(),
  updated_date          TIMESTAMPTZ DEFAULT now()
);

-- Activos (assets)
CREATE TABLE IF NOT EXISTS activos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT,
  tipo             TEXT,
  marca            TEXT,
  modelo           TEXT,
  numero_serie     TEXT,
  estado           TEXT DEFAULT 'Activo',
  assigned_to      TEXT,
  assigned_to_name TEXT,
  department       TEXT,
  fecha_adquisicion TIMESTAMPTZ,
  notas            TEXT,
  created_date     TIMESTAMPTZ DEFAULT now(),
  updated_date     TIMESTAMPTZ DEFAULT now()
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name        TEXT,
  activo_id        TEXT,
  activo_nombre    TEXT,
  category         TEXT,
  description      TEXT,
  impact           TEXT,
  reporter_name    TEXT,
  reporter_email   TEXT,
  department       TEXT,
  status           TEXT DEFAULT 'Pendiente',
  assigned_to      TEXT,
  assigned_to_name TEXT,
  resolution_notes TEXT,
  resolved_at      TIMESTAMPTZ,
  resolution_hours FLOAT,
  file_urls        JSONB DEFAULT '[]',
  created_by       TEXT,
  created_date     TIMESTAMPTZ DEFAULT now(),
  updated_date     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Storage bucket for file attachments
-- Run separately if the bucket doesn't exist:
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('attachments', 'attachments', true)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Disable RLS for local development (enable & add policies for production)
-- ============================================================
ALTER TABLE requests          DISABLE ROW LEVEL SECURITY;
ALTER TABLE request_histories DISABLE ROW LEVEL SECURITY;
ALTER TABLE request_trash     DISABLE ROW LEVEL SECURITY;
ALTER TABLE request_comments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE request_feedback  DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     DISABLE ROW LEVEL SECURITY;
ALTER TABLE worklogs          DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments       DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules  DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs   DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base    DISABLE ROW LEVEL SECURITY;
ALTER TABLE guardias          DISABLE ROW LEVEL SECURITY;
ALTER TABLE activos           DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents         DISABLE ROW LEVEL SECURITY;
