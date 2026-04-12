import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(/** @type {any} */ (null));

/** @param {any} supabaseUser */
async function ensureUserProfile(supabaseUser) {
  if (!supabaseUser) return null;

  const { data: existing } = await supabase
    .from('app_users')
    .select('*')
    .eq('email', supabaseUser.email)
    .maybeSingle();

  if (existing) return buildUserObject(supabaseUser, existing);

  const { data: created } = await supabase
    .from('app_users')
    .insert({
      email: supabaseUser.email,
      full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      display_name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
      avatar_url: supabaseUser.user_metadata?.avatar_url || null,
      role: 'employee',
    })
    .select('*')
    .maybeSingle();

  return buildUserObject(supabaseUser, created);
}

/** @param {any} supabaseUser @param {any} profile */
function buildUserObject(supabaseUser, profile) {
  return {
    id: profile?.id || supabaseUser.id,
    email: supabaseUser.email,
    full_name: profile?.full_name || supabaseUser.user_metadata?.full_name || supabaseUser.email,
    display_name: profile?.display_name || profile?.full_name || supabaseUser.email,
    role: profile?.role || 'employee',
    department: profile?.department || '',
    department_id: profile?.department_id || '',
    avatar_url: profile?.avatar_url || supabaseUser.user_metadata?.avatar_url || '',
  };
}

/**
 * Carga el perfil del usuario desde app_users.
 * Nunca lanza — usa fallback si la DB falla.
 * @param {any} supabaseUser
 */
async function loadProfile(supabaseUser, setUser, setIsAuthenticated) {
  try {
    const profile = await ensureUserProfile(supabaseUser);
    setUser(profile);
    setIsAuthenticated(true);
  } catch (/** @type {any} */ err) {
    console.warn('[AuthContext] ensureUserProfile error:', err?.message);
    setUser({
      id: supabaseUser.id,
      email: supabaseUser.email,
      full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
      display_name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
      role: 'employee',
      department: '',
      department_id: '',
      avatar_url: '',
    });
    setIsAuthenticated(true);
  }
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
    // Safety timeout: si getSession() cuelga (ej. refresh de token sin red),
    // desbloquea la UI después de 6 segundos para no quedarse en loader infinito.
    const safetyTimer = setTimeout(() => {
      console.warn('[AuthContext] Safety timeout — Supabase no respondió en 6s');
      setIsLoadingAuth(false);
    }, 6000);

    // getSession() espera el refresh automático del token antes de resolver.
    // No usamos isMounted en el .finally() para evitar que el guard impida
    // la llamada a setIsLoadingAuth(false) en React StrictMode (doble ejecución).
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          await loadProfile(session.user, setUser, setIsAuthenticated);
        }
      })
      .catch((/** @type {any} */ err) => {
        console.warn('[AuthContext] getSession error:', err?.message);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setIsLoadingAuth(false);
      });

    // Escuchar cambios posteriores: login, logout, refresh de token.
    // INITIAL_SESSION se ignora — ya lo resuelve getSession() arriba.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      clearTimeout(safetyTimer);
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
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadProfile(session.user, setUser, setIsAuthenticated);
    }
    setIsLoadingAuth(false);
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
