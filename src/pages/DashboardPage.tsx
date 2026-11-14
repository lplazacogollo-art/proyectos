import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ArrowUpRight, AlertTriangle } from 'lucide-react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../components/ChartCanvas';
import { StatusLabel } from '../components/StatusLabel';
import { formatCOP, formatDate } from '../utils/format';
import { apiFetch } from '../utils/api';
import type { NavSection } from '../types';

interface DashboardResponse {
  stats: {
    ventas_hoy: number;
    ventas_hoy_count: number;
    ingresos_mes: number;
    total_ventas: number;
    ingresos_totales: number;
    clientes_registrados: number;
    productos_registrados: number;
    productos_bajo_inventario: number;
  };
  charts: {
    ventas_por_mes: Array<{ mes_label: string; total: number; cantidad: number }>;
    ingresos_por_periodo: Array<{ dia: string; total: number }>;
    metodos_pago: Array<{ metodo_pago: string; total: number; cantidad: number }>;
    productos_mas_vendidos: Array<{ nombre: string; codigo: string; unidades: number; ingresos: number }>;
  };
  tables: {
    ultimas_ventas: Array<{
      id: number;
      consecutivo: string;
      numero_comprobante: string;
      fecha: string;
      total: number;
      saldo_pendiente: number;
      estado_pago: string;
      cliente_nombre: string;
    }>;
    ultimos_clientes: Array<{
      id: number;
      tipo_documento: string;
      numero_documento: string;
      nombre_completo: string;
      correo: string;
      fecha_registro: string;
    }>;
    productos_bajo_inventario: Array<{
      id: number;
      codigo: string;
      nombre: string;
      categoria: string;
      cantidad_disponible: number;
      stock_minimo: number;
      estado: string;
    }>;
  };
}

interface DashboardPageProps {
  onNavigate: (section: NavSection) => void;
  onSelectSale: (id: number) => void;
  addFlash: (type: 'success' | 'error' | 'warning', text: string) => void;
}

export function DashboardPage({ onNavigate, onSelectSale, addFlash }: DashboardPageProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/dashboard');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error cargando dashboard');
      setData(json);
    } catch (err) {
      addFlash('error', err instanceof Error ? err.message : 'Error cargando métricas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const monthlyConfig = useMemo<ChartConfiguration>(() => {
    const rows = data?.charts.ventas_por_mes || [];
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.mes_label),
        datasets: [
          {
            label: 'Ventas (COP)',
            data: rows.map((r) => r.total),
            backgroundColor: '#2563EB',
            borderRadius: 6,
            barPercentage: 0.55,
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
            ticks: {
              callback: (val) => formatCOP(Number(val)),
              font: { size: 11 },
            },
          },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    };
  }, [data]);

  const periodConfig = useMemo<ChartConfiguration>(() => {
    const rows = data?.charts.ingresos_por_periodo || [];
    return {
      type: 'line',
      data: {
        labels: rows.map((r) => r.dia),
        datasets: [
          {
            label: 'Ingresos por fecha',
            data: rows.map((r) => r.total),
            borderColor: '#172554',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: '#2563EB',
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
            ticks: {
              callback: (val) => formatCOP(Number(val)),
              font: { size: 11 },
            },
          },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    };
  }, [data]);

  const methodsConfig = useMemo<ChartConfiguration>(() => {
    const rows = data?.charts.metodos_pago || [];
    return {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => r.metodo_pago),
        datasets: [
          {
            data: rows.map((r) => r.total),
            backgroundColor: ['#2563EB', '#172554', '#10B981', '#F59E0B'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
        },
      },
    };
  }, [data]);

  const topProductsConfig = useMemo<ChartConfiguration>(() => {
    const rows = data?.charts.productos_mas_vendidos || [];
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => (r.nombre.length > 22 ? r.nombre.slice(0, 22) + '…' : r.nombre)),
        datasets: [
          {
            label: 'Unidades vendidas',
            data: rows.map((r) => r.unidades),
            backgroundColor: '#3B82F6',
            borderRadius: 6,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { precision: 0, font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    { label: 'Ventas del día', value: formatCOP(data.stats.ventas_hoy), sub: `${data.stats.ventas_hoy_count} operaciones hoy` },
    { label: 'Ingresos del mes', value: formatCOP(data.stats.ingresos_mes), sub: 'Acumulado mes actual' },
    { label: 'Total de ventas', value: String(data.stats.total_ventas), sub: formatCOP(data.stats.ingresos_totales) + ' acum.' },
    { label: 'Clientes registrados', value: String(data.stats.clientes_registrados), sub: 'Cartera activa' },
    { label: 'Productos registrados', value: String(data.stats.productos_registrados), sub: 'Catálogo inventario' },
    {
      label: 'Bajo inventario',
      value: String(data.stats.productos_bajo_inventario),
      sub: data.stats.productos_bajo_inventario > 0 ? 'Requiere reposición' : 'Niveles óptimos',
      warn: data.stats.productos_bajo_inventario > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Dashboard Comercial</h1>
          <p className="text-sm text-[#64748B]">Resumen operativo en tiempo real conectado a Neon PostgreSQL.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 text-[#64748B] ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ventas')}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
          >
            Nueva venta POS
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">{k.label}</p>
            <p className={`mt-2 text-xl font-bold tracking-tight font-mono-num ${k.warn ? 'text-amber-700' : 'text-[#0F172A]'}`}>
              {k.value}
            </p>
            <p className="mt-1 text-xs text-[#64748B] truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F172A]">Ventas por mes</h2>
            <span className="text-xs text-[#64748B]">Últimos 6 meses</span>
          </div>
          <ChartCanvas config={monthlyConfig} height={230} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F172A]">Ingresos por período</h2>
            <span className="text-xs text-[#64748B]">Últimos 30 días</span>
          </div>
          <ChartCanvas config={periodConfig} height={230} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F172A]">Métodos de pago</h2>
            <span className="text-xs text-[#64748B]">Distribución de recaudos</span>
          </div>
          {data.charts.metodos_pago.length === 0 ? (
            <div className="flex h-[230px] items-center justify-center text-sm text-[#64748B]">
              Sin pagos registrados aún.
            </div>
          ) : (
            <ChartCanvas config={methodsConfig} height={230} />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F172A]">Productos más vendidos</h2>
            <span className="text-xs text-[#64748B]">Por unidades facturadas</span>
          </div>
          {data.charts.productos_mas_vendidos.length === 0 ? (
            <div className="flex h-[230px] items-center justify-center text-sm text-[#64748B]">
              Sin productos vendidos aún.
            </div>
          ) : (
            <ChartCanvas config={topProductsConfig} height={230} />
          )}
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Últimas ventas */}
        <div className="xl:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-[#0F172A]">Últimas ventas</h2>
            <button
              type="button"
              onClick={() => onNavigate('facturas')}
              className="text-xs font-semibold text-[#2563EB] hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                <tr>
                  <th className="px-5 py-3">Consecutivo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.tables.ultimas_ventas.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => onSelectSale(v.id)}
                    className="cursor-pointer hover:bg-[#F8FAFC]"
                  >
                    <td className="px-5 py-3 font-mono-num text-xs font-semibold text-[#2563EB]">{v.consecutivo}</td>
                    <td className="px-4 py-3 font-medium text-[#0F172A]">{v.cliente_nombre}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDate(v.fecha)}</td>
                    <td className="px-4 py-3 text-right font-mono-num font-semibold text-[#0F172A]">{formatCOP(v.total)}</td>
                    <td className="px-5 py-3">
                      <StatusLabel status={v.estado_pago} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Productos bajo inventario */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-[#0F172A]">Alertas de inventario</h2>
            <button
              type="button"
              onClick={() => onNavigate('productos')}
              className="text-xs font-semibold text-[#2563EB] hover:underline"
            >
              Gestionar
            </button>
          </div>
          {data.tables.productos_bajo_inventario.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#64748B]">
              Todos los productos superan el stock mínimo.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.tables.productos_bajo_inventario.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0F172A]">{p.nombre}</p>
                    <p className="text-xs text-[#64748B]">
                      {p.codigo} · Mín: {p.stock_minimo}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="inline-flex items-center gap-1 font-mono-num text-xs font-bold text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {p.cantidad_disponible} und
                    </p>
                    <div className="mt-1">
                      <StatusLabel status={p.estado} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimos clientes */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-[#0F172A]">Últimos clientes registrados</h2>
          <button
            type="button"
            onClick={() => onNavigate('clientes')}
            className="text-xs font-semibold text-[#2563EB] hover:underline"
          >
            Ver directorio
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
              <tr>
                <th className="px-6 py-3">Documento</th>
                <th className="px-4 py-3">Nombre completo</th>
                <th className="px-4 py-3">Correo electrónico</th>
                <th className="px-6 py-3">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.tables.ultimos_clientes.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-6 py-3 font-mono-num text-xs text-[#64748B]">
                    {c.tipo_documento} {c.numero_documento}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0F172A]">{c.nombre_completo}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{c.correo}</td>
                  <td className="px-6 py-3 text-xs text-[#64748B]">{formatDate(c.fecha_registro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
