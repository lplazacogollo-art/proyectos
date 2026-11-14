import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import type { Producto } from '../types';
import { formatCOP } from '../utils/format';
import { apiFetch } from '../utils/api';
import { StatusLabel } from '../components/StatusLabel';

interface ProductosPageProps {
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
}

const emptyForm = {
  codigo: '',
  nombre: '',
  descripcion: '',
  categoria: 'Tecnología',
  precio_compra: '',
  precio_venta: '',
  cantidad_disponible: '0',
  stock_minimo: '5',
};

export function ProductosPage({ addFlash }: ProductosPageProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('Todas');
  const [estadoFilter, setEstadoFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchProductos = async (q = search, cat = categoriaFilter, est = estadoFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (cat !== 'Todas') params.set('categoria', cat);
      if (est !== 'Todos') params.set('estado', est);
      const res = await apiFetch(`/api/productos?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProductos(json.productos);
      setCategorias(json.categorias || []);
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error consultando productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos('', 'Todas', 'Todos');
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Producto) => {
    setEditingId(p.id);
    setForm({
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria: p.categoria,
      precio_compra: String(p.precio_compra),
      precio_venta: String(p.precio_venta),
      cantidad_disponible: String(p.cantidad_disponible),
      stock_minimo: String(p.stock_minimo),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/productos/${editingId}` : '/api/productos';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          precio_compra: Number(form.precio_compra),
          precio_venta: Number(form.precio_venta),
          cantidad_disponible: Number(form.cantidad_disponible),
          stock_minimo: Number(form.stock_minimo),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'Error guardando producto');
        return;
      }
      addFlash('success', json.message);
      if (json.warning) addFlash('warning', json.warning);
      setModalOpen(false);
      await fetchProductos();
    } catch {
      addFlash('error', 'Error de conexión al guardar producto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Producto) => {
    try {
      const res = await apiFetch(`/api/productos/${p.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'No se pudo eliminar el producto');
        return;
      }
      addFlash('success', json.message);
      await fetchProductos();
    } catch {
      addFlash('error', 'Error eliminando producto');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Gestión de Productos e Inventario</h1>
          <p className="text-sm text-[#64748B]">Control de catálogo, costos en COP, precios de venta y alertas de existencias.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              fetchProductos(val, categoriaFilter, estadoFilter);
            }}
            placeholder="Buscar por código, nombre o descripción..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <select
          value={categoriaFilter}
          onChange={(e) => {
            const val = e.target.value;
            setCategoriaFilter(val);
            fetchProductos(search, val, estadoFilter);
          }}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
        >
          <option value="Todas">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={estadoFilter}
          onChange={(e) => {
            const val = e.target.value;
            setEstadoFilter(val);
            fetchProductos(search, categoriaFilter, val);
          }}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
        >
          <option value="Todos">Todos los estados</option>
          <option value="Disponible">Disponible</option>
          <option value="Bajo inventario">Bajo inventario</option>
          <option value="Agotado">Agotado</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
              <tr>
                <th className="px-5 py-3.5">Código</th>
                <th className="px-4 py-3.5">Producto</th>
                <th className="px-4 py-3.5">Categoría</th>
                <th className="px-4 py-3.5 text-right">P. Compra</th>
                <th className="px-4 py-3.5 text-right">P. Venta</th>
                <th className="px-4 py-3.5 text-right">Stock</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    Cargando productos...
                  </td>
                </tr>
              ) : productos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              ) : (
                productos.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-mono-num text-xs font-semibold text-[#0F172A]">{p.codigo}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-[#0F172A]">{p.nombre}</p>
                      {p.descripcion && <p className="text-xs text-[#64748B] max-w-xs truncate">{p.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B]">{p.categoria}</td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-[#64748B]">{formatCOP(p.precio_compra)}</td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-semibold text-[#0F172A]">{formatCOP(p.precio_venta)}</td>
                    <td className="px-4 py-3.5 text-right font-mono-num">
                      <span className="font-semibold text-[#0F172A]">{p.cantidad_disponible}</span>
                      <span className="text-xs text-[#64748B]"> / {p.stock_minimo}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusLabel status={p.estado} />
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          title="Editar producto"
                          className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          title="Eliminar producto"
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
                {editingId ? 'Editar producto' : 'Registrar nuevo producto'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Código SKU</label>
                  <input
                    type="text"
                    required
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    placeholder="PROD-009"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num uppercase focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Categoría</label>
                  <input
                    type="text"
                    required
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    placeholder="Tecnología, Mobiliario..."
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Nombre del producto</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Descripción</label>
                <textarea
                  rows={2}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Precio de compra (COP)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.precio_compra}
                    onChange={(e) => setForm({ ...form, precio_compra: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Precio de venta (COP)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.precio_venta}
                    onChange={(e) => setForm({ ...form, precio_venta: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Cantidad disponible</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={form.cantidad_disponible}
                    onChange={(e) => setForm({ ...form, cantidad_disponible: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Stock mínimo</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={form.stock_minimo}
                    onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
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
                  {saving ? 'Guardando...' : editingId ? 'Actualizar producto' : 'Guardar producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
