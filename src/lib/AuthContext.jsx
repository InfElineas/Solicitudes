import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(/** @type {any} */ (null));

const SESSION_START_KEY  = 'app_session_start';
const PROFILE_CACHE_KEY  = 'app_user_profile';
const MAX_SESSION_MS     = 24 * 60 * 60 * 1000; // 24 horas
const SESSION_TIMEOUT_MS = 2500; // no bloquear la UI demasiado tiempo en recarga

function isSessionExpired() {
  const start = parseInt(localStorage.getItem(SESSION_START_KEY) || '0', 10);
  return start > 0 && Date.now() - start > MAX_SESSION_MS;
}

/** Guarda el perfil en localStorage para usarlo como fallback si la DB tarda. */
function cacheProfile(/** @type {any} */ userObj) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(userObj)); } catch {}
}

/** Devuelve el perfil cacheado si coincide con el email del usuario activo. */
function getCachedProfile(/** @type {string} */ email) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p?.email === email ? p : null;
  } catch { return null; }
}

function clearCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(SESSION_START_KEY);
  } catch {}
}

/**
 * Ejecuta una promesa con un límite de tiempo.
 * Si vence, resuelve con `fallback` en lugar de lanzar.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {T} fallback
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** @param {any} supabaseUser @param {any} profile */
function buildUserObject(supabaseUser, profile) {
  return {
    id:           profile?.id           || supabaseUser.id,
    email:        supabaseUser.email,
    full_name:    profile?.full_name    || supabaseUser.user_metadata?.full_name    || supabaseUser.email,
    display_name: profile?.display_name || profile?.full_name || supabaseUser.user_metadata?.full_name || supabaseUser.email,
    role:         profile?.role         || 'employee',
    department:   profile?.department   || '',
    department_id: profile?.department_id || '',
    avatar_url:   profile?.avatar_url   || supabaseUser.user_metadata?.avatar_url || '',
  };
}

const PROFILE_DB_TIMEOUT_MS = 4000;
/** @param {number} ms */
const rejectAfter = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('db-timeout')), ms));

/** @param {any} supabaseUser */
async function fetchProfile(supabaseUser) {
  const { data: existing } = await Promise.race([
    supabase.from('app_users').select('*').eq('email', supabaseUser.email).maybeSingle(),
    rejectAfter(PROFILE_DB_TIMEOUT_MS),
  ]);
  if (existing) return existing;

  // No existe → crear perfil
  const { data: created } = await Promise.race([
    supabase.from('app_users').insert({
      email:        supabaseUser.email,
      full_name:    supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      display_name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      avatar_url:   supabaseUser.user_metadata?.avatar_url || null,
      role:         'employee',
    }).select('*').maybeSingle(),
    rejectAfter(PROFILE_DB_TIMEOUT_MS),
  ]);
  return created ?? null;
}

/**
 * Carga el perfil desde la DB.
 * Si la DB tarda/falla usa el perfil cacheado en localStorage.
 * Solo cae al fallback JWT (sin rol real) si no hay caché.
 * @param {any} supabaseUser
 * @param {import('react').Dispatch<any>} setUser
 * @param {import('react').Dispatch<boolean>} setIsAuthenticated
 */
async function loadProfile(supabaseUser, setUser, setIsAuthenticated) {
  try {
    const profile = await fetchProfile(supabaseUser);
    const userObj = buildUserObject(supabaseUser, profile);
    cacheProfile(userObj);
    setUser(userObj);
  } catch (/** @type {any} */ err) {
    console.warn('[AuthContext] fetchProfile error, usando fallback JWT:', err?.message);
    // Primero intentar caché — tiene el rol correcto
    const cached = getCachedProfile(supabaseUser.email);
    if (cached) {
      setUser(cached);
    } else {
      // Último recurso: datos del JWT (role = 'employee')
      setUser(buildUserObject(supabaseUser, null));
    }
  }
  setIsAuthenticated(true);
}

/** @param {{ children: import('react').ReactNode }} props */
export const AuthProvider = ({ children }) => {
  /** @type {[any, import('react').Dispatch<any>]} */
  const [user, setUser]                     = useState(/** @type {any} */ (null));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]   = useState(true);
  const [isLoadingPublicSettings]           = useState(false);
  const [authError]                         = useState(/** @type {any} */ (null));

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          /** @type {any} */ ({ data: { session: null } })
        );

        if (!mounted) return;

        const session = sessionResult?.data?.session;
        if (session?.user) {
          // Mostrar usuario inmediatamente (caché o JWT) para no bloquear la app.
          const cached = getCachedProfile(session.user.email);
          if (cached) {
            setUser(cached);
          } else {
            setUser(buildUserObject(session.user, null));
          }
          setIsAuthenticated(true);

          // Refrescar desde la DB en segundo plano (sin bloquear pantalla de carga).
          loadProfile(session.user, setUser, setIsAuthenticated).catch(() => {});
        }
      } catch (/** @type {any} */ err) {
        console.warn('[AuthContext] init error:', err?.message);
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN') {
        localStorage.setItem(SESSION_START_KEY, Date.now().toString());
        if (session?.user) {
          const cached = getCachedProfile(session.user.email);
          setUser(cached || buildUserObject(session.user, null));
          setIsAuthenticated(true);
          loadProfile(session.user, setUser, setIsAuthenticated).catch(() => {});
        }
      } else if (event === 'TOKEN_REFRESHED') {
        if (isSessionExpired()) {
          await supabase.auth.signOut();
          return;
        }
        // Token refresh: si la DB falla, el caché mantiene el rol correcto
        if (session?.user) {
          const cached = getCachedProfile(session.user.email);
          setUser(cached || buildUserObject(session.user, null));
          setIsAuthenticated(true);
          loadProfile(session.user, setUser, setIsAuthenticated).catch(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        clearCache();
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    clearCache();
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const updateUser = (/** @type {Record<string, any>} */ updated) =>
    setUser((/** @type {any} */ u) => {
      const next = { ...u, ...updated };
      cacheProfile(next);
      return next;
    });

  const navigateToLogin = () => { window.location.href = '/login'; };

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadProfile(session.user, setUser, setIsAuthenticated);
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings: null,
      logout,
      updateUser,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
