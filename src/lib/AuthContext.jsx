import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(/** @type {any} */ (null));

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
    id: profile?.id || supabaseUser.id,
    email: supabaseUser.email,
    full_name: profile?.full_name || supabaseUser.user_metadata?.full_name || supabaseUser.email,
    display_name: profile?.display_name || profile?.full_name || supabaseUser.user_metadata?.full_name || supabaseUser.email,
    role: profile?.role || 'employee',
    department: profile?.department || '',
    department_id: profile?.department_id || '',
    avatar_url: profile?.avatar_url || supabaseUser.user_metadata?.avatar_url || '',
  };
}

/** Promesa que rechaza tras `ms` milisegundos. */
/** @param {number} ms */
const rejectAfter = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('db-timeout')), ms));

/**
 * Busca o crea el perfil en app_users.
 * Timeout de 5 s por operación: si la DB no responde devuelve null
 * y el caller usa los datos del JWT como fallback.
 * @param {any} supabaseUser
 * @returns {Promise<any>}
 */
async function fetchProfile(supabaseUser) {
  const { data: existing } = await Promise.race([
    supabase.from('app_users').select('*').eq('email', supabaseUser.email).maybeSingle(),
    rejectAfter(5000),
  ]);
  if (existing) return existing;

  // No existe → intentar crear, también con timeout
  const { data: created } = await Promise.race([
    supabase.from('app_users').insert({
      email: supabaseUser.email,
      full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      display_name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      avatar_url: supabaseUser.user_metadata?.avatar_url || null,
      role: 'employee',
    }).select('*').maybeSingle(),
    rejectAfter(5000),
  ]);
  return created ?? null;
}

/**
 * Carga el perfil y actualiza el estado de auth.
 * Nunca lanza — si la DB falla usa los datos del JWT.
 * @param {any} supabaseUser
 * @param {import('react').Dispatch<any>} setUser
 * @param {import('react').Dispatch<boolean>} setIsAuthenticated
 */
async function loadProfile(supabaseUser, setUser, setIsAuthenticated) {
  try {
    const profile = await fetchProfile(supabaseUser);
    setUser(buildUserObject(supabaseUser, profile));
  } catch (/** @type {any} */ err) {
    console.warn('[AuthContext] fetchProfile error, usando fallback JWT:', err?.message);
    setUser(buildUserObject(supabaseUser, null));
  }
  setIsAuthenticated(true);
}

/** @param {{ children: import('react').ReactNode }} props */
export const AuthProvider = ({ children }) => {
  /** @type {[any, import('react').Dispatch<any>]} */
  const [user, setUser] = useState(/** @type {any} */ (null));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(/** @type {any} */ (null));

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // getSession() puede esperar un refresh de token por red.
        // Le damos 8 s; si vence, asumimos sesión nula (usuario va al login).
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          8000,
          /** @type {any} */ ({ data: { session: null } })
        );

        if (!mounted) return;

        const session = sessionResult?.data?.session;
        if (session?.user) {
          // fetchProfile tiene su propio timeout de 5 s internamente.
          await loadProfile(session.user, setUser, setIsAuthenticated);
        }
      } catch (/** @type {any} */ err) {
        console.warn('[AuthContext] init error:', err?.message);
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    };

    init();

    // Escuchar cambios POST-inicialización: login, logout, refresh de token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          await loadProfile(session.user, setUser, setIsAuthenticated);
        }
      } else if (event === 'SIGNED_OUT') {
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
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const updateUser = (/** @type {Record<string, any>} */ updated) =>
    setUser((/** @type {any} */ u) => ({ ...u, ...updated }));

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
