import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingBag, CheckCircle2 } from 'lucide-react';
import type { Cliente, Configuracion, Producto } from '../types';
import { formatCOP } from '../utils/format';
import { apiFetch } from '../utils/api';
import { StatusLabel } from '../components/StatusLabel';

interface CartItem {
  producto: Producto;
  cantidad: number;
}

interface VentasPosPageProps {
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
  onSaleCompleted: (ventaId: number) => void;
}

export function VentasPosPage({ addFlash, onSaleCompleted }: VentasPosPageProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [searchProd, setSearchProd] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [descuentoPct, setDescuentoPct] = useState('0');
  const [aplicarImpuesto, setAplicarImpuesto] = useState(true);
  const [impuestoPct, setImpuestoPct] = useState('19');
  const [pagoInicial, setPagoInicial] = useState('');
  const [pagarTotal, setPagarTotal] = useState(true);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro'>('Efectivo');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [cliRes, prodRes, cfgRes] = await Promise.all([
        apiFetch('/api/clientes'),
        apiFetch('/api/productos'),
        apiFetch('/api/configuracion'),
      ]);
      const [cliJson, prodJson, cfgJson] = await Promise.all([
        cliRes.json(),
        prodRes.json(),
        cfgRes.json(),
      ]);
      if (!cliRes.ok || !prodRes.ok || !cfgRes.ok) {
        throw new Error(cliJson.error || prodJson.error || cfgJson.error || 'Error cargando catálogo POS');
      }
      const cliList: Cliente[] = cliJson.clientes || [];
      setClientes(cliList);
      setProductos(prodJson.productos || []);
      if (cfgJson.configuracion) {
        setConfig(cfgJson.configuracion);
        setImpuestoPct(String(cfgJson.configuracion.porcentaje_impuesto ?? 19));
      }
      if (cliList.length > 0 && (!selectedClientId || !cliList.some((c) => String(c.id) === selectedClientId))) {
        setSelectedClientId(String(cliList[0].id));
      }
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error cargando catálogo POS');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchProd.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
    );
  }, [productos, searchProd]);

  const addToCart = (prod: Producto) => {
    if (prod.cantidad_disponible <= 0) {
      addFlash('error', 'No hay existencias suficientes');
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === prod.id);
      if (idx >= 0) {
        const currentQty = prev[idx].cantidad;
        if (currentQty + 1 > prod.cantidad_disponible) {
          addFlash('error', 'No hay existencias suficientes');
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], cantidad: currentQty + 1 };
        return next;
      }
      return [...prev, { producto: prod, cantidad: 1 }];
    });
  };

  const updateQty = (productoId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.producto.id !== productoId) return item;
          const nextQty = item.cantidad + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.producto.cantidad_disponible) {
            addFlash('error', 'No hay existencias suficientes');
            return item;
          }
          return { ...item, cantidad: nextQty };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const removeFromCart = (productoId: number) => {
    setCart((prev) => prev.filter((item) => item.producto.id !== productoId));
  };

  // Visual preview totals (backend recalculates and enforces exact precision)
  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.producto.precio_venta * item.cantidad, 0),
    [cart]
  );
  const maxDesc = Number(config?.descuento_maximo ?? 100);
  const rawDescPct = Number(descuentoPct) || 0;
  const descPctNum = Math.max(0, Math.min(rawDescPct, maxDesc));
  const descuentoMonto = Math.round(subtotal * (descPctNum / 100));
  const baseGravable = Math.max(0, subtotal - descuentoMonto);
  const taxPctNum = aplicarImpuesto ? Math.max(0, Number(impuestoPct) || 0) : 0;
  const impuestos = Math.round(baseGravable * (taxPctNum / 100));
  const total = baseGravable + impuestos;

  const effectivePagoInicial = pagarTotal ? total : Math.max(0, Number(pagoInicial) || 0);

  const nextConsecutivePreview = config
    ? `${config.prefijo_consecutivo}-${String(Number(config.consecutivo_actual) + 1).padStart(6, '0')}`
    : 'VS-001006';

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      addFlash('error', 'Selecciona un cliente para continuar');
      return;
    }
    if (cart.length === 0) {
      addFlash('error', 'Agrega al menos un producto al carrito');
      return;
    }
    if (!Number.isFinite(rawDescPct) || rawDescPct < 0 || rawDescPct > maxDesc) {
      addFlash('error', `El descuento debe estar entre 0% y ${maxDesc}%.`);
      return;
    }
    if (!pagarTotal && effectivePagoInicial > total) {
      addFlash('error', 'El pago inicial no puede superar el total de la venta.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: Number(selectedClientId),
          items: cart.map((c) => ({ producto_id: c.producto.id, cantidad: c.cantidad })),
          descuento_porcentaje: descPctNum,
          aplicar_impuesto: aplicarImpuesto,
          impuesto_porcentaje: taxPctNum,
          pago_inicial: effectivePagoInicial,
          metodo_pago: metodoPago,
          referencia,
          observaciones,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'No se pudo registrar la venta');
        return;
      }

      addFlash('success', json.message || 'Venta registrada exitosamente');
      if (Array.isArray(json.warnings)) {
        json.warnings.forEach((w: string) => addFlash('warning', w));
      }

      setCart([]);
      setDescuentoPct('0');
      setPagoInicial('');
      setReferencia('');
      setObservaciones('');
      await loadData();
      onSaleCompleted(json.venta.id);
    } catch {
      addFlash('error', 'No se pudo registrar la venta');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Punto de Venta (POS)</h1>
          <p className="text-sm text-[#64748B]">
            Registro transaccional de ventas · Próximo consecutivo: <span className="font-mono-num font-semibold text-[#172554]">{nextConsecutivePreview}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Product Picker */}
        <div className="xl:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
              <input
                type="text"
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
                placeholder="Buscar producto por nombre, código o categoría..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-[#64748B]">
              No se encontraron productos que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredProducts.map((p) => {
                const disabled = p.cantidad_disponible <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => addToCart(p)}
                    className={`flex flex-col justify-between rounded-xl border bg-white p-4 text-left transition-all ${
                      disabled
                        ? 'cursor-not-allowed border-slate-200 opacity-60'
                        : 'border-slate-200 hover:border-[#2563EB] hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono-num text-xs font-semibold text-[#64748B]">{p.codigo}</span>
                        <StatusLabel status={p.estado} />
                      </div>
                      <h3 className="mt-2 font-semibold text-[#0F172A]">{p.nombre}</h3>
                      <p className="mt-0.5 text-xs text-[#64748B]">{p.categoria}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="font-mono-num text-base font-bold text-[#172554]">{formatCOP(p.precio_venta)}</span>
                      <span className="text-xs font-medium text-[#64748B]">Stock: {p.cantidad_disponible}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Cart & Checkout */}
        <form onSubmit={handleCheckout} className="xl:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[#0F172A]">
                <ShoppingBag className="h-4 w-4 text-[#2563EB]" />
                Resumen de venta
              </h2>
              <span className="text-xs font-semibold text-[#64748B]">{cart.length} ítems</span>
            </div>

            {/* Client Select */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">Cliente</label>
              <select
                required
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_completo} ({c.tipo_documento} {c.numero_documento})
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items */}
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-4 py-8 text-center text-xs text-[#64748B]">
                Haz clic en los productos de la izquierda para agregarlos al carrito.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border-y border-slate-100">
                {cart.map((item) => (
                  <div key={item.producto.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#0F172A]">{item.producto.nombre}</p>
                      <p className="font-mono-num text-xs text-[#64748B]">
                        {formatCOP(item.producto.precio_venta)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQty(item.producto.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center font-mono-num text-sm font-semibold">{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.producto.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="w-24 text-right font-mono-num text-sm font-semibold text-[#0F172A]">
                      {formatCOP(item.producto.precio_venta * item.cantidad)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.producto.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Discount & Tax Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0F172A]">
                  Descuento (%) {config ? `máx ${config.descuento_maximo}%` : ''}
                </label>
                <input
                  type="number"
                  min={0}
                  max={config?.descuento_maximo ?? 100}
                  step="0.5"
                  value={descuentoPct}
                  onChange={(e) => setDescuentoPct(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                  <span>IVA (%)</span>
                  <input
                    type="checkbox"
                    checked={aplicarImpuesto}
                    onChange={(e) => setAplicarImpuesto(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#2563EB]"
                  />
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  disabled={!aplicarImpuesto}
                  value={aplicarImpuesto ? impuestoPct : '0'}
                  onChange={(e) => setImpuestoPct(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num disabled:bg-slate-100 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="rounded-xl bg-[#F8FAFC] p-4 space-y-2 text-sm">
              <div className="flex justify-between text-[#64748B]">
                <span>Subtotal</span>
                <span className="font-mono-num text-[#0F172A]">{formatCOP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Descuento ({descPctNum}%)</span>
                <span className="font-mono-num text-[#0F172A]">-{formatCOP(descuentoMonto)}</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Impuestos ({taxPctNum}%)</span>
                <span className="font-mono-num text-[#0F172A]">{formatCOP(impuestos)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-[#172554]">
                <span>Total a pagar</span>
                <span className="font-mono-num">{formatCOP(total)}</span>
              </div>
            </div>

            {/* Initial Payment Section */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0F172A]">Pago inicial</span>
                <label className="flex items-center gap-2 text-xs font-medium text-[#2563EB] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pagarTotal}
                    onChange={(e) => setPagarTotal(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#2563EB]"
                  />
                  Pagar totalidad ({formatCOP(total)})
                </label>
              </div>

              {!pagarTotal && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#64748B]">Monto abonado hoy (COP)</label>
                  <input
                    type="number"
                    min={0}
                    max={total}
                    value={pagoInicial}
                    onChange={(e) => setPagoInicial(e.target.value)}
                    placeholder="0 para dejar a crédito"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              )}

              {effectivePagoInicial > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748B]">Método</label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value as typeof metodoPago)}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748B]">Referencia</label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      placeholder="Opcional"
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Observaciones</label>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas internas de la venta..."
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? 'Procesando transacción...' : 'Confirmar y registrar venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
