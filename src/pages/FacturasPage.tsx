import { useEffect, useState } from 'react';
import { Search, Eye, FileDown, FileText } from 'lucide-react';
import type { Cliente, Venta } from '../types';
import { formatCOP, formatDate } from '../utils/format';
import { apiFetch, downloadAuthenticatedFile } from '../utils/api';
import { StatusLabel } from '../components/StatusLabel';

interface FacturasPageProps {
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
  onSelectSale: (id: number) => void;
}

export function FacturasPage({ addFlash, onSelectSale }: FacturasPageProps) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [clienteId, setClienteId] = useState('Todos');
  const [estado, setEstado] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchFacturas = async (
    q = search,
    fi = fechaInicio,
    ff = fechaFin,
    cid = clienteId,
    est = estado
  ) => {
    if (fi && ff && fi > ff) {
      addFlash('error', 'La fecha inicial no puede ser mayor a la fecha final.');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (fi) params.set('fecha_inicio', fi);
      if (ff) params.set('fecha_fin', ff);
      if (cid !== 'Todos') params.set('cliente_id', cid);
      if (est !== 'Todos') params.set('estado', est);
      const res = await apiFetch(`/api/ventas?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setVentas(json.ventas || []);
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error cargando comprobantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch('/api/clientes')
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        setClientes(j.clientes || []);
      })
      .catch(() => {});
    fetchFacturas();
  }, []);

  const handleDownloadPdf = async (v: Venta) => {
    setDownloadingId(v.id);
    try {
      await downloadAuthenticatedFile(`/api/ventas/${v.id}/pdf`, `${v.numero_comprobante}.pdf`);
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error descargando PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Comprobantes Internos de Venta</h1>
        <p className="text-sm text-[#64748B]">Historial de comprobantes emitidos, consulta de detalle y descarga en PDF.</p>
      </div>

      {/* DIAN Academic/Administrative Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-950">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
        <div>
          <span className="font-bold">COMPROBANTE INTERNO DE VENTA:</span> Los documentos emitidos en este módulo son soportes administrativos y académicos generados por VentaSmart. No constituyen una factura electrónica validada por la DIAN.
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-12">
        <div className="relative md:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              fetchFacturas(val, fechaInicio, fechaFin, clienteId, estado);
            }}
            placeholder="Buscar comprobante, venta o cliente..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              const val = e.target.value;
              setFechaInicio(val);
              fetchFacturas(search, val, fechaFin, clienteId, estado);
            }}
            aria-label="Fecha desde"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              const val = e.target.value;
              setFechaFin(val);
              fetchFacturas(search, fechaInicio, val, clienteId, estado);
            }}
            aria-label="Fecha hasta"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <select
            value={clienteId}
            onChange={(e) => {
              const val = e.target.value;
              setClienteId(val);
              fetchFacturas(search, fechaInicio, fechaFin, val, estado);
            }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
          >
            <option value="Todos">Todos los clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre_completo}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            value={estado}
            onChange={(e) => {
              const val = e.target.value;
              setEstado(val);
              fetchFacturas(search, fechaInicio, fechaFin, clienteId, val);
            }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none"
          >
            <option value="Todos">Todos los estados</option>
            <option value="Pagado">Pagado</option>
            <option value="Parcial">Parcial</option>
            <option value="Pendiente">Pendiente</option>
          </select>
        </div>
      </div>

      {/* Comprobantes Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
              <tr>
                <th className="px-5 py-3.5">Comprobante</th>
                <th className="px-4 py-3.5">N° Venta</th>
                <th className="px-4 py-3.5">Cliente</th>
                <th className="px-4 py-3.5">Fecha</th>
                <th className="px-4 py-3.5 text-right">Subtotal</th>
                <th className="px-4 py-3.5 text-right">Desc.</th>
                <th className="px-4 py-3.5 text-right">IVA</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    Cargando comprobantes...
                  </td>
                </tr>
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-[#64748B]">
                    No se encontraron comprobantes para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                ventas.map((v) => (
                  <tr key={v.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3.5 font-mono-num text-xs font-semibold text-[#172554]">{v.numero_comprobante}</td>
                    <td className="px-4 py-3.5 font-mono-num text-xs text-[#2563EB]">{v.consecutivo}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#0F172A]">{v.cliente_nombre}</p>
                      <p className="text-xs text-[#64748B]">{v.cliente_tipo_doc} {v.cliente_documento}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B] whitespace-nowrap">{formatDate(v.fecha)}</td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs">{formatCOP(v.subtotal)}</td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-[#64748B]">-{formatCOP(v.descuento_monto)}</td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-[#64748B]">{formatCOP(v.impuestos)}</td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-bold text-[#0F172A]">{formatCOP(v.total)}</td>
                    <td className="px-4 py-3.5">
                      <StatusLabel status={v.estado_pago} />
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectSale(v.id)}
                          title="Consultar detalle"
                          className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(v)}
                          disabled={downloadingId === v.id}
                          title="Descargar PDF"
                          aria-label={`Descargar PDF ${v.numero_comprobante}`}
                          className="rounded-lg p-2 text-[#2563EB] hover:bg-blue-50 disabled:opacity-50"
                        >
                          <FileDown className="h-4 w-4" />
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
    </div>
  );
}
