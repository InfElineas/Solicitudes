/**
 * entityClient.js
 * Wraps Supabase queries to match the base44.entities API:
 *   Entity.filter(conditions, orderBy, limit)
 *   Entity.list()
 *   Entity.create(data)
 *   Entity.update(id, data)
 *   Entity.delete(id)
 */
import { supabase } from './supabaseClient';

// Map base44 entity names → Supabase table names
const TABLE_MAP = {
  Request:         'requests',
  RequestHistory:  'request_histories',
  RequestTrash:    'request_trash',
  RequestComment:  'request_comments',
  RequestFeedback: 'request_feedback',
  Notification:    'notifications',
  Worklog:         'worklogs',
  Department:      'departments',
  User:            'app_users',
  AuditLog:        'audit_logs',
  AutomationRule:  'automation_rules',
  AutomationLog:   'automation_logs',
  ChatLog:         'chat_logs',
  KnowledgeBase:   'knowledge_base',
  Guardia:         'guardias',
  Activo:          'activos',
  Incident:        'incidents',
};

function createEntityClient(tableName) {
  return {
    /**
     * filter(conditions, orderBy, limit)
     * conditions: { field: value, ... }
     * orderBy:    '-created_date' (desc) | 'created_date' (asc)
     * limit:      number
     */
    async filter(conditions = {}, orderBy = null, limit = null) {
      let query = supabase.from(tableName).select('*');

      for (const [key, value] of Object.entries(conditions)) {
        if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      }

      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const column = desc ? orderBy.slice(1) : orderBy;
        query = query.order(column, { ascending: !desc });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`[entityClient] ${tableName}.filter error:`, error.message);
        throw error;
      }
      return (data || []).filter(Boolean);
    },

    async list(orderBy = null, limit = null) {
      return this.filter({}, orderBy, limit);
    },

    async create(record) {
      const payload = {
        ...record,
        created_date: record.created_date || new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error(`[entityClient] ${tableName}.create error:`, error.message);
        throw error;
      }
      return data;
    },

    async update(id, updates) {
      const payload = {
        ...updates,
        updated_date: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error(`[entityClient] ${tableName}.update error:`, error.message);
        throw error;
      }
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) {
        console.error(`[entityClient] ${tableName}.delete error:`, error.message);
        throw error;
      }
    },

    // Alias: get(id)
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  };
}

// Build entities object
export const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([entityName, tableName]) => [
    entityName,
    createEntityClient(tableName),
  ])
);

// ── File upload via Supabase Storage ─────────────────────────────────────────
export const integrations = {
  Core: {
    async UploadFile({ file }) {
      const ext = file.name.split('.').pop();
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(path, file, { upsert: false });
      if (error) {
        console.error('[entityClient] UploadFile error:', error.message);
        throw error;
      }
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(path);
      return { file_url: urlData.publicUrl };
    },

    async SendEmail({ to, subject, body }) {
      // Stub: log email in development.
      // In production connect to Supabase Edge Function or an email provider.
      console.info('[SendEmail] To:', to, '| Subject:', subject);
      console.debug('[SendEmail] Body:', body);
    },
  },
};

// ── Auth helpers (Supabase) ───────────────────────────────────────────────────
export const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');

    // Merge with app profile
    const { data: profile } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    return {
      id: profile?.id || user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      display_name: profile?.display_name || profile?.full_name || user.email,
      role: profile?.role || 'employee',
      department: profile?.department || '',
      department_id: profile?.department_id || '',
      avatar_url: profile?.avatar_url || '',
    };
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) window.location.href = redirectUrl;
  },

  redirectToLogin(returnUrl) {
    // Redirect to your login page or Supabase hosted login
    const loginPath = '/login';
    window.location.href = returnUrl
      ? `${loginPath}?returnTo=${encodeURIComponent(returnUrl)}`
      : loginPath;
  },
};

// ── User management (invites) ─────────────────────────────────────────────────
export const users = {
  async inviteUser(email, role = 'user') {
    // Insert a placeholder in app_users — Supabase invite requires service_role key.
    // For now we create the profile record and the user can sign up themselves.
    const { error } = await supabase
      .from('app_users')
      .upsert({ email, role }, { onConflict: 'email' });
    if (error) throw error;
    console.info(`[inviteUser] Profile created for ${email} with role ${role}`);
  },
};
