import { useEffect, useState } from 'react';
import { X, FileDown, CreditCard, ReceiptText } from 'lucide-react';
import type { DetalleVentaItem, Pago, Venta } from '../types';
import { formatCOP, formatDateTime } from '../utils/format';
import { apiFetch, downloadAuthenticatedFile } from '../utils/api';
import { StatusLabel } from './StatusLabel';

interface SaleDetailData {
  venta: Venta & {
    tipo_documento: string;
    numero_documento: string;
    nombre_completo: string;
    telefono: string;
    correo: string;
    direccion: string;
    vendedor_nombre?: string;
  };
  detalles: DetalleVentaItem[];
  pagos: Pago[];
}

interface SaleDetailModalProps {
  ventaId: number | null;
  onClose: () => void;
  onPaymentRecorded?: () => void;
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
}

export function SaleDetailModal({ ventaId, onClose, onPaymentRecorded, addFlash }: SaleDetailModalProps) {
  const [data, setData] = useState<SaleDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro'>('Transferencia');
  const [referencia, setReferencia] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = async (id: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/ventas/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error cargando venta');
      setData(json);
      setMonto(String(Math.round(json.venta.saldo_pendiente)));
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error cargando detalle');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ventaId !== null) {
      setShowPayForm(false);
      fetchDetail(ventaId);
    } else {
      setData(null);
    }
  }, [ventaId]);

  if (ventaId === null) return null;

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venta_id: data.venta.id,
          monto_pagado: Number(monto),
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
      setShowPayForm(false);
      setReferencia('');
      await fetchDetail(data.venta.id);
      onPaymentRecorded?.();
    } catch {
      addFlash('error', 'Error de conexión al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F172A]">
                {data ? `Venta ${data.venta.consecutivo}` : 'Detalle de Venta'}
              </h2>
              <p className="text-xs text-[#64748B]">
                {data ? `Comprobante ${data.venta.numero_comprobante} · ${formatDateTime(data.venta.fecha)}` : 'Cargando información...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Cerrar detalle"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading || !data ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <>
              {/* Comprobante Notice */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-900">
                <span className="font-semibold">COMPROBANTE INTERNO DE VENTA</span> — Documento de carácter académico y administrativo. No constituye una factura electrónica validada por la DIAN.
              </div>

              {/* Client & Status */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[#64748B]">Cliente</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A]">{data.venta.nombre_completo}</p>
                  <p className="text-xs text-[#64748B]">
                    {data.venta.tipo_documento}: {data.venta.numero_documento}
                  </p>
                  <p className="mt-1 text-xs text-[#64748B]">{data.venta.correo} · {data.venta.telefono}</p>
                </div>
                <div className="flex flex-col sm:items-end justify-between">
                  <div className="sm:text-right">
                    <p className="text-xs font-medium text-[#64748B] mb-1">Estado de pago</p>
                    <StatusLabel status={data.venta.estado_pago} />
                  </div>
                  {data.venta.vendedor_nombre && (
                    <p className="mt-2 text-xs text-[#64748B]">Atendido por: {data.venta.vendedor_nombre}</p>
                  )}
                </div>
              </div>

              {/* Products Table */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Productos vendidos</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                      <tr>
                        <th className="px-4 py-2.5">Producto</th>
                        <th className="px-3 py-2.5 text-right">Cant.</th>
                        <th className="px-3 py-2.5 text-right">Precio Unit.</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {data.detalles.map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-[#0F172A]">{d.producto_nombre}</p>
                            <p className="text-xs text-[#64748B]">{d.codigo}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono-num">{d.cantidad}</td>
                          <td className="px-3 py-2.5 text-right font-mono-num">{formatCOP(d.precio_unitario)}</td>
                          <td className="px-4 py-2.5 text-right font-mono-num font-semibold">{formatCOP(d.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#64748B]">
                  <span>Subtotal</span>
                  <span className="font-mono-num text-[#0F172A]">{formatCOP(data.venta.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Descuento ({data.venta.descuento_porcentaje}%)</span>
                  <span className="font-mono-num text-[#0F172A]">-{formatCOP(data.venta.descuento_monto)}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Impuestos ({data.venta.impuesto_porcentaje}%)</span>
                  <span className="font-mono-num text-[#0F172A]">{formatCOP(data.venta.impuestos)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-[#172554]">
                  <span>Total venta</span>
                  <span className="font-mono-num">{formatCOP(data.venta.total)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Total pagado</span>
                  <span className="font-mono-num font-semibold">{formatCOP(data.venta.total_pagado)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Saldo pendiente</span>
                  <span className="font-mono-num">{formatCOP(data.venta.saldo_pendiente)}</span>
                </div>
              </div>

              {/* Quick Payment Form */}
              {data.venta.saldo_pendiente > 0 && showPayForm && (
                <form onSubmit={handlePaySubmit} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-[#172554]">Registrar abono a esta venta</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">Monto (COP)</label>
                      <input
                        type="number"
                        min={1}
                        max={data.venta.saldo_pendiente}
                        required
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono-num focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">Método de pago</label>
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
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">Referencia</label>
                      <input
                        type="text"
                        placeholder="Ej. TRF-9921"
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPayForm(false)}
                      className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                    >
                      {submitting ? 'Registrando...' : 'Confirmar pago'}
                    </button>
                  </div>
                </form>
              )}

              {/* Payments History */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Pagos registrados ({data.pagos.length})</h3>
                {data.pagos.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 text-center text-xs text-[#64748B]">
                    No se han registrado pagos para esta venta.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                        <tr>
                          <th className="px-4 py-2.5">N° Pago</th>
                          <th className="px-3 py-2.5">Fecha</th>
                          <th className="px-3 py-2.5">Método</th>
                          <th className="px-4 py-2.5 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.pagos.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-2.5 font-mono-num text-xs font-semibold text-[#0F172A]">{p.numero_pago}</td>
                            <td className="px-3 py-2.5 text-xs text-[#64748B]">{formatDateTime(p.fecha)}</td>
                            <td className="px-3 py-2.5 text-xs text-[#0F172A]">
                              {p.metodo_pago}
                              {p.referencia ? ` · ${p.referencia}` : ''}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-emerald-700">
                              {formatCOP(p.monto_pagado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {data && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#F8FAFC] px-6 py-4">
            {data.venta.saldo_pendiente > 0 ? (
              <button
                type="button"
                onClick={() => setShowPayForm((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 whitespace-nowrap"
              >
                <CreditCard className="h-4 w-4 text-[#2563EB]" />
                Registrar abono
              </button>
            ) : (
              <span className="text-xs font-medium text-emerald-700">Venta pagada en su totalidad</span>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  await downloadAuthenticatedFile(
                    `/api/ventas/${data.venta.id}/pdf`,
                    `${data.venta.numero_comprobante}.pdf`
                  );
                } catch (err) {
                  addFlash('error', err instanceof Error ? err.message : 'Error descargando PDF');
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap"
            >
              <FileDown className="h-4 w-4" />
              Descargar PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
