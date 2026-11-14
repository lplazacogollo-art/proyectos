import { useEffect, useState } from 'react';
import { Building2, Sliders, UserCog, Save } from 'lucide-react';
import type { Configuracion, Usuario } from '../types';
import { apiFetch, setSessionToken } from '../utils/api';

interface ConfiguracionPageProps {
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
  onUserUpdated: (user: Usuario) => void;
}

export function ConfiguracionPage({ addFlash, onUserUpdated }: ConfiguracionPageProps) {
  const [cfg, setCfg] = useState<Configuracion | null>(null);
  const [nombreUser, setNombreUser] = useState('');
  const [correoUser, setCorreoUser] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [savingBiz, setSavingBiz] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    apiFetch('/api/configuracion')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Error cargando configuración');
        if (json.configuracion) setCfg(json.configuracion);
        if (json.usuario) {
          setNombreUser(json.usuario.nombre);
          setCorreoUser(json.usuario.correo);
        }
      })
      .catch((err) => addFlash('error', err instanceof Error ? err.message : 'Error cargando configuración'));
  }, []);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg) return;
    if (
      !Number.isFinite(cfg.porcentaje_impuesto) ||
      cfg.porcentaje_impuesto < 0 ||
      cfg.porcentaje_impuesto > 100 ||
      !Number.isFinite(cfg.descuento_maximo) ||
      cfg.descuento_maximo < 0 ||
      cfg.descuento_maximo > 100 ||
      !Number.isInteger(cfg.consecutivo_actual) ||
      cfg.consecutivo_actual < 0
    ) {
      addFlash('error', 'Verifica los valores de impuesto, descuento máximo y consecutivo.');
      return;
    }
    setSavingBiz(true);
    try {
      const res = await apiFetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'Error guardando configuración');
        return;
      }
      setCfg(json.configuracion);
      addFlash('success', json.message || 'Registro actualizado correctamente');
    } catch {
      addFlash('error', 'Error de conexión al guardar configuración');
    } finally {
      setSavingBiz(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordNueva && !passwordActual) {
      addFlash('error', 'Ingresa tu contraseña actual para definir una nueva.');
      return;
    }
    setSavingUser(true);
    try {
      const res = await apiFetch('/api/configuracion/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreUser,
          correo: correoUser,
          password_actual: passwordActual || undefined,
          password_nueva: passwordNueva || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'Error actualizando perfil');
        return;
      }
      if (json.sessionToken) setSessionToken(json.sessionToken);
      addFlash('success', json.message || 'Registro actualizado correctamente');
      setPasswordActual('');
      setPasswordNueva('');
      onUserUpdated(json.usuario);
    } catch {
      addFlash('error', 'Error de conexión al actualizar perfil');
    } finally {
      setSavingUser(false);
    }
  };

  if (!cfg) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Configuración del Sistema</h1>
        <p className="text-sm text-[#64748B]">Datos legales del negocio, parámetros comerciales y perfil de usuario.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Business & Commercial Settings */}
        <form onSubmit={handleSaveBusiness} className="lg:col-span-7 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="h-5 w-5 text-[#2563EB]" />
            <h2 className="text-base font-semibold text-[#0F172A]">Datos del negocio y parámetros comerciales</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Nombre comercial</label>
              <input
                type="text"
                required
                value={cfg.nombre_comercial}
                onChange={(e) => setCfg({ ...cfg, nombre_comercial: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">NIT o identificación</label>
              <input
                type="text"
                required
                value={cfg.nit}
                onChange={(e) => setCfg({ ...cfg, nit: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Dirección</label>
              <input
                type="text"
                required
                value={cfg.direccion}
                onChange={(e) => setCfg({ ...cfg, direccion: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Teléfono</label>
              <input
                type="text"
                required
                value={cfg.telefono}
                onChange={(e) => setCfg({ ...cfg, telefono: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Correo corporativo</label>
              <input
                type="email"
                required
                value={cfg.correo}
                onChange={(e) => setCfg({ ...cfg, correo: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <Sliders className="h-4 w-4 text-[#2563EB]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Reglas de facturación e impuestos</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Impuesto IVA (%)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={50}
                required
                value={cfg.porcentaje_impuesto}
                onChange={(e) => setCfg({ ...cfg, porcentaje_impuesto: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Desc. máximo (%)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={100}
                required
                value={cfg.descuento_maximo}
                onChange={(e) => setCfg({ ...cfg, descuento_maximo: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Prefijo</label>
              <input
                type="text"
                required
                value={cfg.prefijo_consecutivo}
                onChange={(e) => setCfg({ ...cfg, prefijo_consecutivo: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num uppercase focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Consecutivo</label>
              <input
                type="number"
                min={0}
                step={1}
                required
                value={cfg.consecutivo_actual}
                onChange={(e) => setCfg({ ...cfg, consecutivo_actual: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingBiz}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingBiz ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>

        {/* User Account Settings */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-5 space-y-5 rounded-xl border border-slate-200 bg-white p-6 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserCog className="h-5 w-5 text-[#2563EB]" />
            <h2 className="text-base font-semibold text-[#0F172A]">Cuenta del usuario</h2>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Nombre completo</label>
            <input
              type="text"
              required
              value={nombreUser}
              onChange={(e) => setNombreUser(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Correo electrónico</label>
            <input
              type="email"
              required
              value={correoUser}
              onChange={(e) => setCorreoUser(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-[#64748B]">Cambiar contraseña (opcional)</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">Contraseña actual</label>
              <input
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                placeholder="Solo si deseas cambiarla"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">Nueva contraseña</label>
              <input
                type="password"
                minLength={6}
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingUser}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#172554] px-5 text-sm font-semibold text-white hover:bg-[#1e3a8a] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingUser ? 'Actualizando...' : 'Actualizar perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
