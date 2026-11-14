import { useEffect, useState } from 'react';
import { CreditCard, Search, Plus } from 'lucide-react';
import type { Pago, Venta } from '../types';
import { formatCOP, formatDateTime } from '../utils/format';
import { apiFetch } from '../utils/api';
import { StatusLabel } from '../components/StatusLabel';

interface PagosPageProps {
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
  onSelectSale: (id: number) => void;
}

export function PagosPage({ addFlash, onSelectSale }: PagosPageProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [pendientes, setPendientes] = useState<Venta[]>([]);
  const [search, setSearch] = useState('');
  const [metodoFilter, setMetodoFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);

  const [selectedVentaId, setSelectedVentaId] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro'>('Transferencia');
  const [referencia, setReferencia] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPagos = async (q = search, m = metodoFilter, resetSelection = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (m !== 'Todos') params.set('metodo', m);
      const res = await apiFetch(`/api/pagos?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPagos(json.pagos || []);
      const pendList: Venta[] = json.ventas_pendientes || [];
      setPendientes(pendList);
      if (pendList.length === 0) {
        setSelectedVentaId('');
        setMonto('');
      } else if (resetSelection || !selectedVentaId || !pendList.some((v) => String(v.id) === selectedVentaId)) {
        const first = pendList[0];
        setSelectedVentaId(String(first.id));
        setMonto(String(Math.round(first.saldo_pendiente)));
      }
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error cargando pagos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagos('', 'Todos', true);
  }, []);

  const handleSelectVenta = (idStr: string) => {
    setSelectedVentaId(idStr);
    const v = pendientes.find((p) => String(p.id) === idStr);
    setMonto(v ? String(Math.round(v.saldo_pendiente)) : '');
  };

  const selectedVenta = pendientes.find((v) => String(v.id) === selectedVentaId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVentaId) {
      addFlash('error', 'Selecciona una venta con saldo pendiente');
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      addFlash('error', 'Ingresa un monto de pago válido mayor a 0.');
      return;
    }
    if (selectedVenta && montoNum > selectedVenta.saldo_pendiente) {
      addFlash('error', 'El pago supera el saldo pendiente');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venta_id: Number(selectedVentaId),
          monto_pagado: montoNum,
          metodo_pago: metodo,
          referencia,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        addFlash('error', json.error || 'Error registrando pago');
        return;
      }
      addFlash('success', json.message || 'Pago registrado');
      if (json.warning) addFlash('warning', json.warning);
      setReferencia('');
      await fetchPagos(search, metodoFilter, true);
    } catch {
      addFlash('error', 'Error de conexión al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Registro y Control de Pagos</h1>
        <p className="text-sm text-[#64748B]">Recaudos totales o parciales, control de saldos pendientes e historial de abonos.</p>
      </div>

      {/* Register Payment Panel */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#0F172A]">
            <CreditCard className="h-4 w-4 text-[#2563EB]" />
            Registrar nuevo pago o abono
          </h2>
          <span className="text-xs font-medium text-[#64748B]">{pendientes.length} ventas con saldo pendiente</span>
        </div>

        {pendientes.length === 0 ? (
          <p className="rounded-lg bg-[#F8FAFC] p-4 text-sm text-[#64748B]">
            Todas las ventas registradas se encuentran pagadas al 100%.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
            <div className="md:col-span-5">
              <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">Venta pendiente</label>
              <select
                required
                value={selectedVentaId}
                onChange={(e) => handleSelectVenta(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              >
                <option value="">Seleccionar venta...</option>
                {pendientes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.consecutivo} · {v.cliente_nombre} · Saldo {formatCOP(v.saldo_pendiente)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">
                Monto (COP) {selectedVenta ? `· Máx ${formatCOP(selectedVenta.saldo_pendiente)}` : ''}
              </label>
              <input
                type="number"
                required
                min={1}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">Método</label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as typeof metodo)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">Referencia</label>
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ej. TRF-1042"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Pagar
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              fetchPagos(val, metodoFilter);
            }}
            placeholder="Buscar por N° pago, venta, cliente o referencia..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <select
          value={metodoFilter}
          onChange={(e) => {
            const val = e.target.value;
            setMetodoFilter(val);
            fetchPagos(search, val);
          }}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
        >
          <option value="Todos">Todos los métodos</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
              <tr>
                <th className="px-5 py-3.5">N° Pago</th>
                <th className="px-4 py-3.5">Venta</th>
                <th className="px-4 py-3.5">Cliente</th>
                <th className="px-4 py-3.5">Fecha</th>
                <th className="px-4 py-3.5">Método / Referencia</th>
                <th className="px-4 py-3.5 text-right">Monto pagado</th>
                <th className="px-5 py-3.5">Estado venta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    Cargando pagos...
                  </td>
                </tr>
              ) : pagos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    No se encontraron pagos registrados.
                  </td>
                </tr>
              ) : (
                pagos.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-mono-num text-xs font-semibold text-[#0F172A]">{p.numero_pago}</td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectSale(p.venta_id)}
                        className="font-mono-num text-xs font-semibold text-[#2563EB] hover:underline"
                      >
                        {p.consecutivo}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[#0F172A]">{p.cliente_nombre}</td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(p.fecha)}</td>
                    <td className="px-4 py-3.5 text-xs text-[#0F172A]">
                      {p.metodo_pago}
                      {p.referencia ? <span className="text-[#64748B]"> · {p.referencia}</span> : null}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-semibold text-emerald-700">
                      {formatCOP(p.monto_pagado)}
                    </td>
                    <td className="px-5 py-3.5">
                      {p.estado_pago && <StatusLabel status={p.estado_pago} />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
