import { useState } from 'react';
import { X, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import type { Usuario } from '../types';
import { signInWithGooglePopup } from '../services/googleAuth';
import { apiFetch, setSessionToken } from '../utils/api';

interface AuthScreenProps {
  onSuccess: (user: Usuario) => void;
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function AuthScreen({ onSuccess, addFlash }: AuthScreenProps) {
  const [modalMode, setModalMode] = useState<'login' | 'register' | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const openModal = (mode: 'login' | 'register') => {
    setModalMode(mode);
    setShowPassword(false);
    if (mode === 'register') {
      setNombre('');
      setCorreo('');
      setPassword('');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { accessToken, idToken } = await signInWithGooglePopup();
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ accessToken, idToken }),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'No se pudo iniciar sesión con Google.');
        return;
      }
      if (json.sessionToken) setSessionToken(json.sessionToken);
      addFlash('success', json.message || 'Sesión iniciada con Google correctamente');
      onSuccess(json.user);
    } catch (err: unknown) {
      const code = (err as { code?: string; message?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        addFlash('warning', 'Se cerró la ventana de inicio de sesión con Google.');
      } else if (code === 'auth/popup-blocked') {
        addFlash('error', 'El navegador bloqueó la ventana emergente. Permite ventanas emergentes para continuar con Google.');
      } else if (code === 'auth/unauthorized-domain') {
        addFlash('error', 'Este dominio aún no está autorizado en Firebase Authentication.');
      } else {
        addFlash('error', 'No se pudo completar el inicio de sesión con Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMode) return;
    setLoading(true);
    try {
      const endpoint = modalMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = modalMode === 'login' ? { correo, password } : { nombre, correo, password };
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'Error de autenticación.');
        return;
      }
      if (json.sessionToken) setSessionToken(json.sessionToken);
      addFlash('success', json.message || 'Bienvenido a VentaSmart');
      onSuccess(json.user);
    } catch {
      addFlash('error', 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: 'admin@ventasmart.co', password: 'Admin2026*' }),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'No se pudo iniciar sesión demo.');
        return;
      }
      if (json.sessionToken) setSessionToken(json.sessionToken);
      addFlash('success', json.message || 'Sesión iniciada correctamente');
      onSuccess(json.user);
    } catch {
      addFlash('error', 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#0F172A]">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="hidden lg:flex lg:w-[54%] items-center justify-center bg-[#172554] p-12 relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <svg
              viewBox="0 0 240 240"
              className="h-72 w-72 text-white drop-shadow-sm"
              fill="none"
              aria-label="Logo VentaSmart"
            >
              <rect x="16" y="16" width="208" height="208" rx="48" fill="#2563EB" />
              <path
                d="M64 78L98 164L132 78"
                stroke="#FFFFFF"
                strokeWidth="18"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M174 92C174 82 164 76 152 76C140 76 132 83 132 93C132 104 142 109 155 113C169 117 178 123 178 136C178 150 166 160 150 160C136 160 126 153 124 143"
                stroke="#FFFFFF"
                strokeWidth="17"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-14 lg:px-16">
          <div className="mx-auto w-full max-w-[400px] lg:mx-0">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563EB] text-base font-bold text-white">
                VS
              </div>
              <span className="text-xl font-bold tracking-tight text-[#172554]">VentaSmart</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl leading-[1.12] text-balance">
              Lo que pasa en tu negocio, hoy.
            </h1>

            <p className="mt-6 text-xl font-bold text-[#0F172A]">
              Únete a VentaSmart ahora.
            </p>

            <div className="mt-6 w-full max-w-[320px] space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#DADCE0] bg-white px-5 text-sm font-semibold text-[#3C4043] shadow-2xs transition-colors hover:bg-[#F8FAFF] hover:border-[#D2E3FC] disabled:opacity-50"
              >
                <GoogleIcon />
                <span>{googleLoading ? 'Conectando con Google...' : 'Iniciar sesión con Google'}</span>
              </button>

              <button
                type="button"
                onClick={handleQuickDemo}
                disabled={loading || googleLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
                {loading ? 'Ingresando...' : 'Entrar con cuenta demo'}
              </button>

              <button
                type="button"
                onClick={() => openModal('register')}
                className="flex h-11 w-full items-center justify-center rounded-full bg-[#2563EB] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1D4ED8]"
              >
                Crear cuenta
              </button>

              <p className="text-[11px] leading-relaxed text-[#64748B]">
                Sistema conectado en tiempo real a Neon PostgreSQL para facturación interna, clientes, productos, pagos y reportes en COP.
              </p>

              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-[#64748B]">o</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <p className="text-sm font-bold text-[#0F172A]">¿Ya tienes una cuenta?</p>

              <button
                type="button"
                onClick={() => openModal('login')}
                className="flex h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-[#2563EB] transition-colors hover:bg-blue-50/60"
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-6 py-3.5 text-center text-xs text-[#64748B]">
        VentaSmart · Facturación Interna · Control de Inventario · Pagos en Pesos Colombianos (COP) · Neon PostgreSQL
      </footer>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="relative w-full max-w-[440px] rounded-2xl bg-white p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                aria-label="Cerrar ventana"
                className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] text-xs font-bold text-white">
                VS
              </div>
              <div className="w-9" />
            </div>

            <div className="mt-5">
              <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
                {modalMode === 'login' ? 'Inicia sesión en VentaSmart' : 'Crea tu cuenta'}
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                {modalMode === 'login'
                  ? 'Ingresa con Google o con tus credenciales para administrar tus operaciones.'
                  : 'Registra un usuario operativo o vincula tu cuenta de Google.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#DADCE0] bg-white px-5 text-sm font-semibold text-[#3C4043] transition-colors hover:bg-[#F8FAFF] disabled:opacity-50"
            >
              <GoogleIcon />
              <span>{googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-[#64748B]">o</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modalMode === 'register' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. María Fernanda López"
                    className="h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="admin@ventasmart.co"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-lg border border-slate-300 pl-3.5 pr-10 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {modalMode === 'login' && (
                <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs text-[#64748B]">
                  <span className="font-mono-num">admin@ventasmart.co · Admin2026*</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCorreo('admin@ventasmart.co');
                      setPassword('Admin2026*');
                    }}
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    Usar demo
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#172554] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1e3a8a] disabled:opacity-50"
              >
                {loading ? 'Procesando...' : modalMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-[#64748B]">
              {modalMode === 'login' ? (
                <>
                  ¿No tienes una cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => openModal('register')}
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    Regístrate
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes una cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => openModal('login')}
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    Iniciar sesión
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
