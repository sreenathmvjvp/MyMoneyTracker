import React, { useState } from 'react';
import {
  Home,
  ArrowLeftRight,
  BarChart3,
  Target,
  MoreHorizontal,
  Plus,
  Wallet,
  Receipt,
  Users,
  PieChart,
  Landmark,
  Settings,
  Sun,
  Moon,
  Sparkles,
  IndianRupee,
  Smartphone,
  Monitor,
  X,
  ShieldCheck,
  WifiOff,
  RefreshCw,
  Download,
} from 'lucide-react';
import type { PageRoute, ViewportWidthPreset } from '../../types/navigation';
import type { PwaStatusInfo } from '../../hooks/usePwaManager';
import { formatDateDDMMMYYYY, formatMonthLabel, getTodayISO } from '../../utilities/formatters';

interface AppShellProps {
  activePage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  onOpenQuickAdd: () => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
  selectedMonth: string;
  financialYear: string;
  viewportPreset: ViewportWidthPreset;
  onChangeViewportPreset: (preset: ViewportWidthPreset) => void;
  pwaStatus?: PwaStatusInfo;
  children: React.ReactNode;
}

interface NavItemConfig {
  id: PageRoute;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'primary' | 'secondary';
}

export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: Home, group: 'primary' },
  { id: 'income', label: 'Income & Salary', shortLabel: 'Income', icon: Wallet, group: 'secondary' },
  { id: 'expenses', label: 'Daily Expenses', shortLabel: 'Expenses', icon: Receipt, group: 'secondary' },
  { id: 'transactions', label: 'Transactions', shortLabel: 'Transactions', icon: ArrowLeftRight, group: 'primary' },
  { id: 'family', label: 'Family Members', shortLabel: 'Family', icon: Users, group: 'secondary' },
  { id: 'budgets', label: 'Monthly Budgets', shortLabel: 'Budgets', icon: PieChart, group: 'secondary' },
  { id: 'goals', label: 'Savings Goals', shortLabel: 'Goals', icon: Target, group: 'primary' },
  { id: 'loans', label: 'Loans & EMI', shortLabel: 'Loans', icon: Landmark, group: 'secondary' },
  { id: 'reports', label: 'Reports & Analysis', shortLabel: 'Reports', icon: BarChart3, group: 'primary' },
  { id: 'settings', label: 'Settings & Backup', shortLabel: 'Settings', icon: Settings, group: 'secondary' },
];

export const AppShell: React.FC<AppShellProps> = ({
  activePage,
  onNavigate,
  onOpenQuickAdd,
  demoMode,
  onToggleDemoMode,
  theme,
  onToggleTheme,
  selectedMonth,
  financialYear,
  viewportPreset,
  onChangeViewportPreset,
  pwaStatus,
  children,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const isSimulatedMobile = viewportPreset !== 'auto';
  const currentNavMeta = ALL_NAV_ITEMS.find((i) => i.id === activePage) ?? ALL_NAV_ITEMS[0];

  const secondaryItems = ALL_NAV_ITEMS.filter((i) => i.group === 'secondary');
  const isMorePageActive = secondaryItems.some((i) => i.id === activePage);

  return (
    <div className="min-h-screen bg-slate-100/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Left-Side Navigation Menu */}
      {!isSimulatedMobile && (
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                My Money Tracker
              </h1>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {formatMonthLabel(selectedMonth)} • {financialYear}
              </p>
            </div>
          </div>

          {/* Primary CTA: Add Transaction */}
          <div className="px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={onOpenQuickAdd}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Transaction</span>
            </button>
          </div>

          {/* Full 10-Module Navigation List */}
          <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Financial Modules
            </p>
            {ALL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Local IndexedDB Privacy Footer */}
          <div className="border-t border-slate-100 dark:border-slate-800 p-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>100% On-Device Storage</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Stored locally in IndexedDB. No cloud sync or bank login required.
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area (with optional Mobile Width Simulator wrapper) */}
      <div
        className={`flex-1 flex flex-col min-h-screen ${
          !isSimulatedMobile ? 'lg:pl-64' : 'items-center bg-slate-200/70 dark:bg-slate-950 py-0 sm:py-4'
        }`}
      >
        <div
          style={
            isSimulatedMobile
              ? { width: `${viewportPreset}px`, maxWidth: '100%' }
              : undefined
          }
          className={`flex-1 flex flex-col w-full bg-slate-50 dark:bg-slate-950 ${
            isSimulatedMobile
              ? 'shadow-2xl sm:rounded-3xl border border-slate-300 dark:border-slate-800 overflow-hidden relative'
              : ''
          }`}
        >
          {/* Top App Header */}
          <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3.5 py-3 sm:px-6">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <IndianRupee className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold sm:text-base text-slate-900 dark:text-white">
                      {currentNavMeta.label}
                    </h2>
                    <span className="hidden xs:inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      {financialYear}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDateDDMMMYYYY(getTodayISO())} • INR (₹)
                  </p>
                </div>
              </div>

              {/* Right Controls: Viewport Width Tester (Desktop), Demo Mode, Theme Toggle */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Responsive Width Tester (360px / 390px / 430px / Desktop) */}
                <div className="hidden md:flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-1 text-[11px]">
                  <span className="px-1.5 text-slate-400 flex items-center gap-1">
                    {isSimulatedMobile ? (
                      <Smartphone className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Monitor className="h-3 w-3 text-emerald-500" />
                    )}
                  </span>
                  {(['auto', '360', '390', '430'] as ViewportWidthPreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChangeViewportPreset(preset)}
                      className={`rounded-lg px-2 py-0.5 font-semibold transition cursor-pointer ${
                        viewportPreset === preset
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                      }`}
                      title={
                        preset === 'auto'
                          ? 'Full Responsive Width'
                          : `Simulate ${preset}px Android Mobile Width`
                      }
                    >
                      {preset === 'auto' ? 'Full' : `${preset}px`}
                    </button>
                  ))}
                </div>

                {/* 1-Tap PWA Install Button (when installable) */}
                {pwaStatus?.canInstall && !pwaStatus.isStandalone && (
                  <button
                    type="button"
                    onClick={() => pwaStatus.triggerInstallPrompt()}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                    title="Install My Money Tracker on your device"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Install App</span>
                  </button>
                )}

                {/* Isolated Demo Mode Switch */}
                <button
                  type="button"
                  onClick={onToggleDemoMode}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer border ${
                    demoMode
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-500/50'
                  }`}
                  title="Toggle isolated sample data without touching real IndexedDB records"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>{demoMode ? 'Demo: ON' : 'Demo: OFF'}</span>
                </button>

                {/* Light / Dark Theme Switch */}
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40 cursor-pointer"
                  aria-label="Toggle Light/Dark theme"
                  title="Toggle Light / Dark theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-slate-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Demo Mode Banner (when active) */}
            {demoMode && (
              <div className="bg-amber-50/90 dark:bg-amber-950/60 border-t border-amber-200/70 dark:border-amber-900/60 px-4 py-1.5 text-center text-[11px] font-medium text-amber-800 dark:text-amber-300">
                Viewing isolated sample data in memory. Your real IndexedDB records are never mixed
                with demo data.
              </div>
            )}

            {/* Offline Mode Active Banner */}
            {pwaStatus && !pwaStatus.isOnline && (
              <div className="bg-slate-900 text-emerald-300 border-t border-slate-800 px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-semibold">
                <WifiOff className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>
                  Offline Mode Active — All transactions continue to save locally in IndexedDB on this device.
                </span>
              </div>
            )}

            {/* Application Update Notification Banner (Prompt 9 Requirement) */}
            {pwaStatus?.updateAvailable && (
              <div className="bg-emerald-950 text-white border-t border-emerald-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>App Update Available:</strong> A new version of My Money Tracker is
                    ready. Updating never clears or modifies your local IndexedDB financial records.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={pwaStatus.applyServiceWorkerUpdate}
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950 cursor-pointer"
                  >
                    Update &amp; Reload Now
                  </button>
                  <button
                    type="button"
                    onClick={pwaStatus.dismissUpdateBanner}
                    className="rounded-lg border border-emerald-700 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-900 cursor-pointer"
                  >
                    Later
                  </button>
                </div>
              </div>
            )}
          </header>

          {/* Page Content */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-3.5 pt-4 pb-28 sm:px-6">
            {children}
          </main>

          {/* Floating Add Transaction Button (FAB) */}
          <button
            type="button"
            onClick={onOpenQuickAdd}
            className={`fixed z-30 flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition active:scale-95 cursor-pointer ${
              isSimulatedMobile
                ? 'bottom-20 right-5 px-4 py-3'
                : 'bottom-20 right-4 lg:bottom-8 lg:right-8 px-4 py-3.5'
            }`}
            aria-label="Add Transaction"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-bold pr-1">Add</span>
          </button>

          {/* Mobile "More" Drawer Sheet */}
          {moreMenuOpen && (
            <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/50 backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-t-3xl border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 pb-24 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      All Finance Modules
                    </h3>
                    <p className="text-xs text-slate-500">
                      Navigate to any personal or family finance module
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen(false)}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {ALL_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          setMoreMenuOpen(false);
                        }}
                        className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mobile Bottom Navigation Bar (5 Tabs: Home, Transactions, Reports, Goals, More) */}
          <nav
            className={`${
              isSimulatedMobile ? 'sticky bottom-0' : 'fixed bottom-0 inset-x-0 lg:hidden'
            } z-30 border-t border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md`}
          >
            <div className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1.5">
              {[
                { id: 'dashboard' as PageRoute, label: 'Home', icon: Home },
                { id: 'transactions' as PageRoute, label: 'Transactions', icon: ArrowLeftRight },
                { id: 'reports' as PageRoute, label: 'Reports', icon: BarChart3 },
                { id: 'goals' as PageRoute, label: 'Goals', icon: Target },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activePage === tab.id && !moreMenuOpen;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onNavigate(tab.id);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}

              {/* 5th Tab: More */}
              <button
                type="button"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                  moreMenuOpen || isMorePageActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span>More</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
};
