import { useState } from 'react';
import { supabase } from '@/api/supabaseClient';

export default function Login() {
  const [mode, setMode] = useState('password'); // 'password' | 'magic'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    }
    // Si ok, onAuthStateChange en AuthContext detecta la sesión y redirige
    setLoading(false);
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Revisa tu correo, te enviamos un enlace de acceso.' });
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
      setGoogleLoading(false);
      return;
    }
    // Si el usuario cierra el popup sin completar, la ventana recupera el foco → resetear estado
    const onFocus = () => {
      setGoogleLoading(false);
      window.removeEventListener('focus', onFocus);
    };
    window.addEventListener('focus', onFocus);
    // Si ok, el browser redirige a Google → vuelve al origin y AuthContext detecta la sesión
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'hsl(222,47%,8%)' }}>
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'hsl(217,91%,45%)' }}>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Solicitudes</h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(215,20%,50%)' }}>
            Sistema de gestión de automatización
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-4"
          style={{ background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,20%)' }}>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'white', color: '#1f2937' }}
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? 'Redirigiendo...' : 'Continuar con Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'hsl(217,33%,22%)' }} />
            <span className="text-xs" style={{ color: 'hsl(215,20%,40%)' }}>o accede con cualquier correo</span>
            <div className="flex-1 h-px" style={{ background: 'hsl(217,33%,22%)' }} />
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'hsl(222,47%,16%)' }}>
            <button
              onClick={() => { setMode('password'); setMessage(null); }}
              className="flex-1 text-sm py-1.5 rounded-md font-medium transition-colors"
              style={{
                background: mode === 'password' ? 'hsl(222,47%,22%)' : 'transparent',
                color: mode === 'password' ? 'white' : 'hsl(215,20%,50%)',
              }}
            >
              Contraseña
            </button>
            <button
              onClick={() => { setMode('magic'); setMessage(null); }}
              className="flex-1 text-sm py-1.5 rounded-md font-medium transition-colors"
              style={{
                background: mode === 'magic' ? 'hsl(222,47%,22%)' : 'transparent',
                color: mode === 'magic' ? 'white' : 'hsl(215,20%,50%)',
              }}
            >
              Magic link
            </button>
          </div>

          {/* Form */}
          <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(215,20%,60%)' }}>
                Correo electrónico
              </label>
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@mercadoelineas.com"
                className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                style={{
                  background: 'hsl(222,47%,16%)',
                  border: '1px solid hsl(217,33%,26%)',
                  color: 'white',
                }}
              />
            </div>

            {mode === 'password' && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(215,20%,60%)' }}>
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                  style={{
                    background: 'hsl(222,47%,16%)',
                    border: '1px solid hsl(217,33%,26%)',
                    color: 'white',
                  }}
                />
              </div>
            )}

            {message && (
              <div className={`text-sm px-3 py-2.5 rounded-lg ${
                message.type === 'error'
                  ? 'bg-red-900/40 text-red-300 border border-red-800'
                  : 'bg-green-900/40 text-green-300 border border-green-800'
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ background: 'hsl(217,91%,45%)' }}
            >
              {loading
                ? 'Cargando...'
                : mode === 'password'
                ? 'Entrar'
                : 'Enviar enlace de acceso'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'hsl(215,20%,35%)' }}>
          Sin acceso, contacta al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
