import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import type { FlashMessage, NavSection, Usuario } from './types';
import { googleLogout } from './services/googleAuth';
import { apiFetch, setSessionToken } from './utils/api';
import { AuthScreen } from './components/AuthScreen';
import { FlashBanner } from './components/FlashBanner';
import { SaleDetailModal } from './components/SaleDetailModal';
import { DashboardPage } from './pages/DashboardPage';
import { ClientesPage } from './pages/ClientesPage';
import { ProductosPage } from './pages/ProductosPage';
import { VentasPosPage } from './pages/VentasPosPage';
import { PagosPage } from './pages/PagosPage';
import { FacturasPage } from './pages/FacturasPage';
import { ReportesPage } from './pages/ReportesPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
  { id: 'pagos', label: 'Pagos', icon: CreditCard },
  { id: 'facturas', label: 'Facturas', icon: FileText },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

export default function App() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [section, setSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [flashMessages, setFlashMessages] = useState<FlashMessage[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const addFlash = useCallback((type: 'success' | 'error' | 'warning', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFlashMessages((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setFlashMessages((prev) => prev.filter((m) => m.id !== id));
    }, 5500);
  }, []);

  const dismissFlash = useCallback((id: string) => {
    setFlashMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          setUser(json.user);
        } else {
          setSessionToken(null);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogout = async () => {
    await Promise.all([
      apiFetch('/api/auth/logout', { method: 'POST' }),
      googleLogout(),
    ]);
    setSessionToken(null);
    setUser(null);
    setSection('dashboard');
    addFlash('success', 'Sesión cerrada correctamente');
  };

  const handleNavigate = (next: NavSection) => {
    setSection(next);
    setMobileMenuOpen(false);
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] font-bold text-white">
            VS
          </div>
          <span className="text-lg font-bold text-[#172554]">Cargando VentaSmart...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen onSuccess={(u) => setUser(u)} addFlash={addFlash} />
        <FlashBanner messages={flashMessages} onDismiss={dismissFlash} />
      </>
    );
  }

  const activeLabel = NAV_ITEMS.find((i) => i.id === section)?.label || 'Dashboard';

  const SidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-[#172554] text-slate-200">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] font-bold text-sm text-white">
              VS
            </div>
            <span className="text-lg font-bold tracking-tight text-white">VentaSmart</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 px-3 py-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 p-3 space-y-2">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-white">{user.nombre}</p>
          <p className="truncate text-xs text-slate-400">{user.correo}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/20 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-[260px]">
        <SidebarContent />
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-[260px]">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-[260px]">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Abrir navegación"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-[#172554]">VentaSmart</span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-[#64748B]">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('ventas')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Registrar venta
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8">
          {section === 'dashboard' && (
            <DashboardPage
              key={`dash-${refreshKey}`}
              onNavigate={handleNavigate}
              onSelectSale={setSelectedSaleId}
              addFlash={addFlash}
            />
          )}
          {section === 'clientes' && (
            <ClientesPage
              key={`cli-${refreshKey}`}
              addFlash={addFlash}
              onSelectSale={setSelectedSaleId}
            />
          )}
          {section === 'productos' && (
            <ProductosPage key={`prod-${refreshKey}`} addFlash={addFlash} />
          )}
          {section === 'ventas' && (
            <VentasPosPage
              addFlash={addFlash}
              onSaleCompleted={(id) => {
                setSelectedSaleId(id);
                setRefreshKey((k) => k + 1);
              }}
            />
          )}
          {section === 'pagos' && (
            <PagosPage
              key={`pag-${refreshKey}`}
              addFlash={addFlash}
              onSelectSale={setSelectedSaleId}
            />
          )}
          {section === 'facturas' && (
            <FacturasPage
              key={`fac-${refreshKey}`}
              addFlash={addFlash}
              onSelectSale={setSelectedSaleId}
            />
          )}
          {section === 'reportes' && (
            <ReportesPage key={`rep-${refreshKey}`} addFlash={addFlash} />
          )}
          {section === 'configuracion' && (
            <ConfiguracionPage
              addFlash={addFlash}
              onUserUpdated={(updated) => setUser(updated)}
            />
          )}
        </main>
      </div>

      {/* Sale Detail Slide-over Modal */}
      <SaleDetailModal
        ventaId={selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
        onPaymentRecorded={() => setRefreshKey((k) => k + 1)}
        addFlash={addFlash}
      />

      {/* Flash Notifications */}
      <FlashBanner messages={flashMessages} onDismiss={dismissFlash} />
    </div>
  );
}
