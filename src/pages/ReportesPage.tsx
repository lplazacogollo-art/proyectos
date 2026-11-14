import { useEffect, useMemo, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../components/ChartCanvas';
import { formatCOP, formatDate } from '../utils/format';
import { apiFetch, downloadAuthenticatedFile } from '../utils/api';
import { StatusLabel } from '../components/StatusLabel';

interface ReportesResponse {
  resumen: {
    total_operaciones: number;
    ingresos_totales: number;
    total_recaudado: number;
    cartera_pendiente: number;
  };
  ventas_diarias: Array<{ periodo: string; operaciones: number; ingresos: number }>;
  ventas_semanales: Array<{ semana: string; operaciones: number; ingresos: number }>;
  ventas_mensuales: Array<{ mes: string; operaciones: number; ingresos: number }>;
  productos_mas_vendidos: Array<{ codigo: string; nombre: string; categoria: string; unidades: number; ingresos: number }>;
  clientes_frecuentes: Array<{ tipo_documento: string; numero_documento: string; nombre_completo: string; compras: number; monto_total: number }>;
  metodos_pago: Array<{ metodo_pago: string; operaciones: number; total: number }>;
  operaciones: Array<{
    consecutivo: string;
    numero_comprobante: string;
    fecha: string;
    cliente: string;
    subtotal: number;
    descuento_monto: number;
    impuestos: number;
    total: number;
    total_pagado: number;
    saldo_pendiente: number;
    estado_pago: string;
  }>;
}

interface ReportesPageProps {
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
}

export function ReportesPage({ addFlash }: ReportesPageProps) {
  const [data, setData] = useState<ReportesResponse | null>(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [periodoTab, setPeriodoTab] = useState<'diarias' | 'semanales' | 'mensuales'>('diarias');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReports = async (fi = fechaInicio, ff = fechaFin) => {
    if (fi && ff && fi > ff) {
      addFlash('error', 'La fecha inicial no puede ser mayor a la fecha final.');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fi) params.set('fecha_inicio', fi);
      if (ff) params.set('fecha_fin', ff);
      const res = await apiFetch(`/api/reportes?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error generando reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports('', '');
  }, []);

  const periodoChart = useMemo<ChartConfiguration>(() => {
    if (!data) {
      return { type: 'bar', data: { labels: [], datasets: [] } };
    }
    const rows =
      periodoTab === 'diarias'
        ? data.ventas_diarias.map((r) => ({ label: r.periodo, val: r.ingresos }))
        : periodoTab === 'semanales'
          ? data.ventas_semanales.map((r) => ({ label: `Sem ${r.semana}`, val: r.ingresos }))
          : data.ventas_mensuales.map((r) => ({ label: r.mes, val: r.ingresos }));

    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.label),
        datasets: [
          {
            label: 'Ingresos (COP)',
            data: rows.map((r) => r.val),
            backgroundColor: '#2563EB',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#F1F5F9' },
            ticks: { callback: (v) => formatCOP(Number(v)), font: { size: 11 } },
          },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    };
  }, [data, periodoTab]);

  const metodosChart = useMemo<ChartConfiguration>(() => {
    const rows = data?.metodos_pago || [];
    return {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => r.metodo_pago),
        datasets: [
          {
            data: rows.map((r) => r.total),
            backgroundColor: ['#172554', '#2563EB', '#10B981', '#F59E0B'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: { legend: { position: 'bottom' } },
      },
    };
  }, [data]);

  const exportUrl = `/api/reportes/csv?fecha_inicio=${encodeURIComponent(fechaInicio)}&fecha_fin=${encodeURIComponent(fechaFin)}`;

  const handleExportCsv = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      addFlash('error', 'La fecha inicial no puede ser mayor a la fecha final.');
      return;
    }
    setExporting(true);
    try {
      await downloadAuthenticatedFile(exportUrl, 'reporte_ventasmart.csv');
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error exportando reporte CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Reportes Comerciales</h1>
          <p className="text-sm text-[#64748B]">Análisis dinámico de ingresos diarios, semanales, mensuales y cartera.</p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#64748B]">Fecha inicial</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#64748B]">Fecha final</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => loadReports(fechaInicio, fechaFin)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#172554] px-4 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
        >
          <Filter className="h-4 w-4" />
          Aplicar filtro
        </button>
        {(fechaInicio || fechaFin) && (
          <button
            type="button"
            onClick={() => {
              setFechaInicio('');
              setFechaFin('');
              loadReports('', '');
            }}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-[#64748B] hover:bg-slate-50"
          >
            Limpiar
          </button>
        )}
      </div>

      {loading && !data ? (
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : data ? (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-[#64748B]">Cantidad de operaciones</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-[#0F172A]">{data.resumen.total_operaciones}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-[#64748B]">Ingresos facturados</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-[#172554]">{formatCOP(data.resumen.ingresos_totales)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-[#64748B]">Total recaudado</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-emerald-700">{formatCOP(data.resumen.total_recaudado)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-[#64748B]">Cartera pendiente</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-amber-700">{formatCOP(data.resumen.cartera_pendiente)}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#0F172A]">Comportamiento de ventas</h2>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {(['diarias', 'semanales', 'mensuales'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPeriodoTab(tab)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                        periodoTab === tab ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <ChartCanvas config={periodoChart} height={240} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-[#0F172A]">Métodos de pago</h2>
              {data.metodos_pago.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-sm text-[#64748B]">Sin datos en el período.</div>
              ) : (
                <ChartCanvas config={metodosChart} height={240} />
              )}
            </div>
          </div>

          {/* Top Products & Top Clients */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-semibold text-[#0F172A]">Productos más vendidos</h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="px-5 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Unidades</th>
                    <th className="px-5 py-3 text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.productos_mas_vendidos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-[#64748B]">
                        Sin ventas de productos en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    data.productos_mas_vendidos.map((p) => (
                      <tr key={p.codigo}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#0F172A]">{p.nombre}</p>
                          <p className="text-xs text-[#64748B]">{p.codigo} · {p.categoria}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold">{p.unidades}</td>
                        <td className="px-5 py-3 text-right font-mono-num font-semibold text-[#172554]">{formatCOP(p.ingresos)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-semibold text-[#0F172A]">Clientes con más compras</h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Operaciones</th>
                    <th className="px-5 py-3 text-right">Total comprado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.clientes_frecuentes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-[#64748B]">
                        Sin compras registradas en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    data.clientes_frecuentes.map((c) => (
                      <tr key={c.numero_documento}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#0F172A]">{c.nombre_completo}</p>
                          <p className="text-xs text-[#64748B]">{c.tipo_documento} {c.numero_documento}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold">{c.compras}</td>
                        <td className="px-5 py-3 text-right font-mono-num font-semibold text-[#172554]">{formatCOP(c.monto_total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operations Detail Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-[#0F172A]">Detalle de operaciones del período</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <tr>
                    <th className="px-5 py-3">Consecutivo</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Pagado</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.operaciones.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-sm text-[#64748B]">
                        No se encontraron operaciones en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    data.operaciones.map((op) => (
                      <tr key={op.consecutivo}>
                        <td className="px-5 py-3 font-mono-num text-xs font-semibold text-[#2563EB]">{op.consecutivo}</td>
                        <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDate(op.fecha)}</td>
                        <td className="px-4 py-3 font-medium text-[#0F172A]">{op.cliente}</td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold">{formatCOP(op.total)}</td>
                        <td className="px-4 py-3 text-right font-mono-num text-emerald-700">{formatCOP(op.total_pagado)}</td>
                        <td className="px-4 py-3 text-right font-mono-num text-amber-700">{formatCOP(op.saldo_pendiente)}</td>
                        <td className="px-5 py-3">
                          <StatusLabel status={op.estado_pago} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
