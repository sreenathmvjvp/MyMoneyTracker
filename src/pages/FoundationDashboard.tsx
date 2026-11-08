import React, { useState } from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Database,
  Play,
  Calculator,
  Calendar,
  IndianRupee,
  Smartphone,
  HardDrive,
  AlertCircle,
  Users,
  FolderTree,
} from 'lucide-react';
import { useDatabaseStatus } from '../hooks/useDatabaseStatus';
import { FoundationStatusCard } from '../components/FoundationStatusCard';
import {
  formatDateDDMMMYYYY,
  formatINR,
  getCurrentMonthYYYYMM,
  getIndianFinancialYear,
  getTodayISO,
} from '../utilities/formatters';
import { calculateSavingsGoalMetrics } from '../calculations/financialCalculations';
import { databaseService } from '../services/databaseService';

export const FoundationDashboard: React.FC = () => {
  const {
    isInitialized,
    initError,
    schemaVersion,
    databaseName,
    tables,
    categories,
    familyMembers,
    accounts,
    totalRecords,
  } = useDatabaseStatus();

  // Interactive Financial Calculator (Pre-loaded with Section 4 Illustrative Test Scenario)
  const [calcIncome, setCalcIncome] = useState<number>(120000);
  const [calcExpenses, setCalcExpenses] = useState<number>(65000);
  const [calcContribution, setCalcContribution] = useState<number>(10000);
  const [goalTarget, setGoalTarget] = useState<number>(300000);
  const [goalContributed, setGoalContributed] = useState<number>(60000);

  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [selfTestResult, setSelfTestResult] = useState<{
    passed: boolean;
    steps: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }>;
  } | null>(null);

  const monthlySurplus = calcIncome - calcExpenses;
  const savingsRate =
    calcIncome > 0 ? Number(((monthlySurplus / calcIncome) * 100).toFixed(1)) : 0;
  const unallocatedSurplus = monthlySurplus - calcContribution;
  const goalMetrics = calculateSavingsGoalMetrics(goalTarget, goalContributed);

  const todayISO = getTodayISO();
  const currentMonth = getCurrentMonthYYYYMM();
  const currentFY = getIndianFinancialYear(currentMonth);

  const handleRunSelfTest = async () => {
    setSelfTestRunning(true);
    try {
      const res = await databaseService.runFoundationSelfTest();
      setSelfTestResult(res);
    } finally {
      setSelfTestRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight sm:text-lg">
                  My Money Tracker
                </h1>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Phase 1: Foundation & DB
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                100% Local IndexedDB • Zero Cloud • Android-First PWA Architecture
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              {formatDateDDMMMYYYY(todayISO)} ({currentFY})
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6">
        {/* Database Initialization Banner */}
        {initError ? (
          <div className="flex items-center gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="text-sm">
              <strong>Database Initialization Error:</strong> {initError}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">IndexedDB Engine</span>
                <HardDrive className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {databaseName}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isInitialized ? `Online • Schema v${schemaVersion}` : 'Initializing...'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Database Tables</span>
                <Database className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">
                {tables.length} / 12 Tables
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {totalRecords} default configuration records seeded
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Locale & Format</span>
                <Smartphone className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                INR (₹) • DD-MMM-YYYY
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Today: {formatDateDDMMMYYYY(todayISO)} • {currentFY}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Privacy & Storage</span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                100% On-Device Only
              </p>
              <p className="mt-1 text-xs text-slate-500">
                No cloud DB • No external APIs • 0 localStorage leaks
              </p>
            </div>
          </div>
        )}

        {/* Interactive Database Self-Test Card */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Database Transactions & Duplicate Protection Verification
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Executes live Dexie.js read/write transactions to verify duplicate salary blocking,
                atomic savings goal updates, rollback on contribution deletion, and clean localStorage.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunSelfTest}
              disabled={selfTestRunning || !isInitialized}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              {selfTestRunning ? 'Running Self-Test...' : 'Run Database Self-Test'}
            </button>
          </div>

          {selfTestResult && (
            <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              {selfTestResult.steps.map((step) => (
                <div
                  key={step.name}
                  className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {step.name}
                    </span>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-400">{step.detail}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-bold ${
                      step.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Financial Calculation Rules Verifier (Section 4 Test Scenario) */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Financial Calculation Engine Verifier (Illustrative Test Data)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verifies strict separation between Monthly Surplus and Savings Contributions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Monthly Surplus & Contribution Calculator */}
            <div className="space-y-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Monthly Financial Summary Calculator
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Monthly Income (₹)
                  </span>
                  <input
                    type="number"
                    value={calcIncome}
                    onChange={(e) => setCalcIncome(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Monthly Expenses (₹)
                  </span>
                  <input
                    type="number"
                    value={calcExpenses}
                    onChange={(e) => setCalcExpenses(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Savings Contribution (₹)
                  </span>
                  <input
                    type="number"
                    value={calcContribution}
                    onChange={(e) => setCalcContribution(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">Monthly Surplus</span>
                  <p className="mt-0.5 text-sm font-bold text-emerald-600">
                    {formatINR(monthlySurplus)}
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">Savings Rate</span>
                  <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                    {savingsRate}%
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">Contribution Amount</span>
                  <p className="mt-0.5 text-sm font-bold text-blue-600">
                    {formatINR(calcContribution)}
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">Unallocated Surplus*</span>
                  <p className="mt-0.5 text-sm font-bold text-amber-600">
                    {formatINR(unallocatedSurplus)}
                  </p>
                </div>
              </div>
            </div>

            {/* Savings Goal Calculator */}
            <div className="space-y-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Savings Goal Progress Calculator
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Target Savings (₹)
                  </span>
                  <input
                    type="number"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Already Contributed (₹)
                  </span>
                  <input
                    type="number"
                    value={goalContributed}
                    onChange={(e) => setGoalContributed(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold"
                  />
                </label>
              </div>

              <div className="rounded-lg bg-white dark:bg-slate-900 p-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Goal Completion: {goalMetrics.completionPercent.toFixed(1)}%</span>
                  <span className="text-slate-500">
                    Remaining Goal: {formatINR(goalMetrics.remainingAmount)}
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${goalMetrics.completionPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Seeded Categories & Family Members Summary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FolderTree className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold">
                Seeded Expense Categories ({categories.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 text-xs font-medium"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                  <span className="text-[10px] text-slate-400">({cat.group})</span>
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold">
                Seeded Family Members ({familyMembers.length}) & Accounts ({accounts.length})
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Family Associations:</p>
                <div className="flex flex-wrap gap-1.5">
                  {familyMembers.map((m) => (
                    <span
                      key={m.id}
                      className="rounded-lg bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300"
                    >
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Default Local Accounts:</p>
                <div className="flex flex-wrap gap-1.5">
                  {accounts.map((acc) => (
                    <span
                      key={acc.id}
                      className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      {acc.name} ({formatINR(acc.currentBalance)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* All 12 Dexie.js Database Tables */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                IndexedDB Schema: 12 Core Tables
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every record enforces Unique ID, Created Date, Updated Date, Transaction Date, and
                domain validation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <FoundationStatusCard key={table.tableName} table={table} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
