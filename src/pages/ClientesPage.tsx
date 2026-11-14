import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, History, X } from 'lucide-react';
import type { Cliente, Venta } from '../types';
import { formatCOP, formatDate } from '../utils/format';
import { apiFetch } from '../utils/api';
import { StatusLabel } from '../components/StatusLabel';

interface ClientesPageProps {
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
  onSelectSale: (id: number) => void;
}

const emptyForm = {
  tipo_documento: 'CC',
  numero_documento: '',
  nombre_completo: '',
  telefono: '',
  correo: '',
  direccion: '',
};

export function ClientesPage({ addFlash, onSelectSale }: ClientesPageProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [historyClient, setHistoryClient] = useState<Cliente | null>(null);
  const [historySales, setHistorySales] = useState<Venta[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchClientes = async (q = search) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setClientes(json.clientes);
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes('');
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditingId(c.id);
    setForm({
      tipo_documento: c.tipo_documento,
      numero_documento: c.numero_documento,
      nombre_completo: c.nombre_completo,
      telefono: c.telefono,
      correo: c.correo,
      direccion: c.direccion,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/clientes/${editingId}` : '/api/clientes';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'Error guardando cliente');
        return;
      }
      addFlash('success', json.message);
      setModalOpen(false);
      await fetchClientes(search);
    } catch {
      addFlash('error', 'Error de conexión al guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Cliente) => {
    try {
      const res = await apiFetch(`/api/clientes/${c.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'No se pudo eliminar el cliente');
        return;
      }
      addFlash('success', json.message);
      await fetchClientes(search);
    } catch {
      addFlash('error', 'Error eliminando cliente');
    }
  };

  const openHistory = async (c: Cliente) => {
    setHistoryClient(c);
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/api/clientes/${c.id}/historial`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setHistorySales(json.ventas);
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error consultando historial');
      setHistoryClient(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Gestión de Clientes</h1>
          <p className="text-sm text-[#64748B]">Directorio comercial, validación documental e historial de compras.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              fetchClientes(val);
            }}
            placeholder="Buscar por nombre, documento o correo electrónico..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <span className="text-xs font-medium text-[#64748B]">{clientes.length} clientes registrados</span>
      </div>

      {/* Clients Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
              <tr>
                <th className="px-5 py-3.5">Documento</th>
                <th className="px-4 py-3.5">Nombre completo</th>
                <th className="px-4 py-3.5">Contacto</th>
                <th className="px-4 py-3.5">Dirección</th>
                <th className="px-4 py-3.5 text-right">Compras</th>
                <th className="px-4 py-3.5">Registro</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    Cargando clientes...
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    No se encontraron clientes con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-mono-num text-xs font-semibold text-[#0F172A] whitespace-nowrap">
                      {c.tipo_documento} {c.numero_documento}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#0F172A]">{c.nombre_completo}</td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B]">
                      <p className="text-[#0F172A]">{c.correo}</p>
                      <p>{c.telefono}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B] max-w-[200px] truncate">{c.direccion}</td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-mono-num text-xs font-semibold text-[#0F172A]">
                        {formatCOP(c.monto_compras || 0)}
                      </p>
                      <p className="text-[11px] text-[#64748B]">{c.total_compras || 0} facturas</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B] whitespace-nowrap">{formatDate(c.fecha_registro)}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openHistory(c)}
                          title="Historial de compras"
                          className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 hover:text-[#2563EB]"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          title="Editar cliente"
                          className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          title="Eliminar cliente"
                          className="rounded-lg p-2 text-[#64748B] hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-[#0F172A]">
                {editingId ? 'Editar cliente' : 'Registrar nuevo cliente'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Tipo doc.</label>
                  <select
                    value={form.tipo_documento}
                    onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                  >
                    <option value="CC">CC</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">CE</option>
                    <option value="TI">TI</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Número de documento</label>
                  <input
                    type="text"
                    required
                    value={form.numero_documento}
                    onChange={(e) => setForm({ ...form, numero_documento: e.target.value })}
                    placeholder="Ej. 900123456-7"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Nombre completo / Razón social</label>
                <input
                  type="text"
                  required
                  value={form.nombre_completo}
                  onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Teléfono</label>
                  <input
                    type="text"
                    required
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={form.correo}
                    onChange={(e) => setForm({ ...form, correo: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Dirección</label>
                <input
                  type="text"
                  required
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-lg bg-[#2563EB] px-5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingId ? 'Actualizar cliente' : 'Guardar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Purchase History */}
      {historyClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Historial de compras</h2>
                <p className="text-xs text-[#64748B]">
                  {historyClient.nombre_completo} · {historyClient.tipo_documento} {historyClient.numero_documento}
                </p>
              </div>
              <button type="button" onClick={() => setHistoryClient(null)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-6">
              {loadingHistory ? (
                <p className="py-8 text-center text-sm text-[#64748B]">Consultando compras...</p>
              ) : historySales.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#64748B]">Este cliente aún no registra ventas.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                      <tr>
                        <th className="px-4 py-2.5">Consecutivo</th>
                        <th className="px-4 py-2.5">Fecha</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5 text-right">Saldo</th>
                        <th className="px-4 py-2.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historySales.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => {
                            setHistoryClient(null);
                            onSelectSale(s.id);
                          }}
                          className="cursor-pointer hover:bg-[#F8FAFC]"
                        >
                          <td className="px-4 py-2.5 font-mono-num text-xs font-semibold text-[#2563EB]">{s.consecutivo}</td>
                          <td className="px-4 py-2.5 text-xs text-[#64748B]">{formatDate(s.fecha)}</td>
                          <td className="px-4 py-2.5 text-right font-mono-num font-semibold">{formatCOP(s.total)}</td>
                          <td className="px-4 py-2.5 text-right font-mono-num text-xs">{formatCOP(s.saldo_pendiente)}</td>
                          <td className="px-4 py-2.5">
                            <StatusLabel status={s.estado_pago} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
