import React, { useState } from 'react';
import {
  Wallet,
  Receipt,
  TrendingUp,
  PiggyBank,
  Landmark,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Users,
  Target,
  Sparkles,
  Plus,
  ChevronRight,
  PieChart as PieChartIcon,
  Gauge,
  Calculator,
  Edit3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type {
  BudgetRecord,
  LoanRecord,
  MonthlyFinancialSummary,
  SavingsGoalRecord,
} from '../types';
import type {
  MonthlyTrendPoint,
  PageRoute,
  UnifiedTransactionItem,
} from '../types/navigation';
import type {
  CategoryBreakdownItem,
  FamilyBreakdownItem,
} from '../reports/reportEngine';
import {
  formatDateDDMMMYYYY,
  formatINR,
  formatMonthLabel,
} from '../utilities/formatters';
import {
  calculateSavingsGoalMetrics,
  summarizeSavingsGoals,
} from '../calculations/financialCalculations';
import { databaseService } from '../services/databaseService';

interface DashboardPageProps {
  summary: MonthlyFinancialSummary;
  totalMonthlyEmi: number;
  totalOutstandingPrincipal: number;
  budgets: BudgetRecord[];
  loans: LoanRecord[];
  categoryBreakdown: CategoryBreakdownItem[];
  familyBreakdown: FamilyBreakdownItem[];
  savingsGoals: SavingsGoalRecord[];
  recentTransactions: UnifiedTransactionItem[];
  monthlyTrend: MonthlyTrendPoint[];
  demoMode: boolean;
  onEnableDemoMode: () => void;
  onOpenQuickAdd: () => void;
  onNavigate: (page: PageRoute) => void;
  onEditTransaction?: (txId: string) => void;
}

const CHART_COLORS = [
  '#059669',
  '#2563eb',
  '#7c3aed',
  '#ea580c',
  '#db2777',
  '#eab308',
  '#0891b2',
  '#64748b',
];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  summary,
  totalMonthlyEmi,
  totalOutstandingPrincipal,
  budgets,
  loans,
  categoryBreakdown,
  familyBreakdown,
  savingsGoals,
  recentTransactions,
  monthlyTrend,
  demoMode,
  onEnableDemoMode,
  onOpenQuickAdd,
  onNavigate,
  onEditTransaction,
}) => {
  const isEmptyRealState =
    !demoMode &&
    summary.totalIncome === 0 &&
    summary.totalExpenses === 0 &&
    recentTransactions.length === 0;

  // Prompt 6 Part C: Monthly Budget & Loan Commitments Summary
  const monthBudgets = budgets.filter((b) => b.month === summary.month);
  const overallBudgetRecord = monthBudgets.find((b) => b.budgetType === 'overall');
  const categoryBudgetSum = monthBudgets
    .filter((b) => b.budgetType === 'category')
    .reduce((s, b) => s + b.plannedAmount, 0);
  const totalMonthlyBudget = overallBudgetRecord?.plannedAmount ?? categoryBudgetSum;
  const actualMonthlySpending = summary.totalExpenses;
  const budgetBalance = totalMonthlyBudget - actualMonthlySpending;
  const budgetUtilizationPct =
    totalMonthlyBudget > 0
      ? Number(((actualMonthlySpending / totalMonthlyBudget) * 100).toFixed(1))
      : 0;
  const totalActiveLoansCount = loans.filter((l) => l.status === 'active').length;

  // Interactive Financial & Savings Goal Calculator state (Section 4 validation tool)
  const [calcIncome, setCalcIncome] = useState<string>('120000');
  const [calcExpenses, setCalcExpenses] = useState<string>('65000');
  const [calcContributions, setCalcContributions] = useState<string>('10000');
  const [calcTargetSavings, setCalcTargetSavings] = useState<string>('300000');
  const [calcAlreadyContributed, setCalcAlreadyContributed] = useState<string>('60000');

  const numCalcIncome = Number(calcIncome) || 0;
  const numCalcExpenses = Number(calcExpenses) || 0;
  const numCalcContributions = Number(calcContributions) || 0;
  const calcMonthlySurplus = numCalcIncome - numCalcExpenses;
  const calcSavingsRate =
    numCalcIncome > 0
      ? Number(((calcMonthlySurplus / numCalcIncome) * 100).toFixed(1))
      : 0;
  const calcUnallocatedSurplus = calcMonthlySurplus - numCalcContributions;

  const numCalcTarget = Number(calcTargetSavings) || 0;
  const numCalcContributed = Number(calcAlreadyContributed) || 0;
  const calcGoalCompletion =
    numCalcTarget > 0
      ? Number(Math.min(100, (numCalcContributed / numCalcTarget) * 100).toFixed(1))
      : 0;
  const calcRemainingGoal = Math.max(0, numCalcTarget - numCalcContributed);

  // Opening Bank Balance formula state (Bank Balance + Salary Credit - All Payments = Available Balance)
  const currentOpeningBalance =
    summary.availableCashBalance -
    (summary.totalIncome - summary.totalExpenses - summary.totalContributions);
  const [showOpeningBalModal, setShowOpeningBalModal] = useState(false);
  const [openingBalInput, setOpeningBalInput] = useState<string>('');

  const handleOpenOpeningBalEditor = () => {
    setOpeningBalInput(String(Math.max(0, currentOpeningBalance)));
    setShowOpeningBalModal((prev) => !prev);
  };

  const handleSaveOpeningBal = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(openingBalInput) || 0;
    await databaseService.updatePrimaryBankOpeningBalance(val);
    setShowOpeningBalModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Banking Hero Summary Card */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-semibold text-emerald-300">
              {formatMonthLabel(summary.month)} • {summary.financialYear}
            </span>
            <h1 className="mt-2 text-lg font-bold sm:text-xl">
              Personal & Family Financial Overview
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isEmptyRealState && (
              <button
                type="button"
                onClick={onEnableDemoMode}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-200 transition cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Preview Sample Data</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Quick Entry</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-[11px] text-slate-400">Salary Credited</p>
            <p className="mt-0.5 text-sm font-bold sm:text-base text-white">
              {formatINR(summary.salaryCredited)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Additional Income</p>
            <p className="mt-0.5 text-sm font-bold sm:text-base text-emerald-300">
              {formatINR(summary.additionalIncome)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Savings Rate</p>
            <p className="mt-0.5 text-sm font-bold sm:text-base text-amber-300">
              {summary.savingsRatePercent}%
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Unallocated Surplus</p>
            <p className="mt-0.5 text-sm font-bold sm:text-base text-sky-300">
              {formatINR(summary.unallocatedSurplus)}
            </p>
          </div>
        </div>
      </section>

      {/* 8 Required Dashboard Metric Cards (Prompt 7) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {/* 1. Monthly Income */}
        <button
          type="button"
          onClick={() => onNavigate('income')}
          className="text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-emerald-500/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Income
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            {formatINR(summary.totalIncome)}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            Credited this month
          </p>
        </button>

        {/* 2. Monthly Expenses */}
        <button
          type="button"
          onClick={() => onNavigate('expenses')}
          className="text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-rose-500/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Expenses
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            {formatINR(summary.totalExpenses)}
          </p>
          <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">
            Expenses + Loan EMIs
          </p>
        </button>

        {/* 3. Monthly Surplus */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Surplus
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`mt-2 text-base font-bold sm:text-lg ${
              summary.monthlySurplus >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600'
            }`}
          >
            {formatINR(summary.monthlySurplus)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Income − All Outflows</p>
        </div>

        {/* 4. Savings Contributions */}
        <button
          type="button"
          onClick={() => onNavigate('goals')}
          className="text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-indigo-500/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Savings Contrib.
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            {formatINR(summary.totalContributions)}
          </p>
          <p className="mt-0.5 text-[11px] text-indigo-600 dark:text-indigo-400">
            Allocated to goals
          </p>
        </button>

        {/* 5. Available Balance */}
        <button
          type="button"
          onClick={handleOpenOpeningBalEditor}
          className="text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-amber-500/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Available Balance
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            {formatINR(summary.availableCashBalance)}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
            Bank + Income − Outflows
          </p>
        </button>

        {/* 6. Total EMI */}
        <button
          type="button"
          onClick={() => onNavigate('loans')}
          className="text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-purple-500/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total EMI
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            {formatINR(totalMonthlyEmi)}
          </p>
          <p className="mt-0.5 text-[11px] text-purple-600 dark:text-purple-400">
            Paid: {formatINR(summary.totalEmiPaid)}
          </p>
        </button>

        {/* 7. Monthly Budget */}
        <button
          type="button"
          onClick={() => onNavigate('budgets')}
          className="text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-teal-500/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Budget
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
              <PieChartIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            {formatINR(totalMonthlyBudget)}
          </p>
          <p className="mt-0.5 text-[11px] text-teal-600 dark:text-teal-400">
            Left: {formatINR(budgetBalance)}
          </p>
        </button>

        {/* 8. Budget Utilization */}
        <button
          type="button"
          onClick={() => onNavigate('budgets')}
          className="text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-orange-500/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Budget Utilized
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`mt-2 text-base font-bold sm:text-lg ${
              budgetUtilizationPct >= 100
                ? 'text-rose-600'
                : budgetUtilizationPct >= 80
                ? 'text-amber-600'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {budgetUtilizationPct}%
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {budgetUtilizationPct > 100
              ? 'Exceeded'
              : budgetUtilizationPct >= 80
              ? '80%+ Alert'
              : 'Within Limit'}
          </p>
        </button>
      </section>

      {showOpeningBalModal && (
        <section className="rounded-2xl border-2 border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20 p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Available & Surplus Balance Formula
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Opening Bank Balance ({formatINR(Math.max(0, currentOpeningBalance))}) + Credited Income ({formatINR(summary.totalIncome)}) − All Outflows ({formatINR(summary.totalExpenses + summary.totalContributions)}) ={' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatINR(summary.availableCashBalance)}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOpeningBalModal(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>
          <form onSubmit={handleSaveOpeningBal} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Opening Bank Balance (Before Monthly Salary Credit) (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={openingBalInput}
                onChange={(e) => setOpeningBalInput(e.target.value)}
                className="w-56 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-1.5 text-xs font-bold text-white transition cursor-pointer"
            >
              Save Opening Balance
            </button>
          </form>
        </section>
      )}

      {/* Prompt 6 Part C: Budget & Loan Commitments Overview */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Monthly Budget Summary Card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Budget Status ({formatMonthLabel(summary.month)})
              </h3>
              <p className="text-xs text-slate-500">
                Planned budget vs actual consumption spending
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <span>Manage Budgets</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
              <span className="text-[11px] text-slate-400 block">Total Monthly Budget</span>
              <strong className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white block">
                {formatINR(totalMonthlyBudget)}
              </strong>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
              <span className="text-[11px] text-slate-400 block">Actual Spending</span>
              <strong className="mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400 block">
                {formatINR(actualMonthlySpending)}
              </strong>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
              <span className="text-[11px] text-slate-400 block">Budget Balance</span>
              <strong
                className={`mt-0.5 text-sm font-bold block ${
                  budgetBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatINR(budgetBalance)}
              </strong>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Utilization: <strong>{budgetUtilizationPct}%</strong></span>
              <span
                className={`font-bold ${
                  budgetUtilizationPct > 100
                    ? 'text-rose-600'
                    : budgetUtilizationPct === 100
                    ? 'text-red-600'
                    : budgetUtilizationPct >= 80
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {totalMonthlyBudget === 0
                  ? 'No Budget Set'
                  : budgetUtilizationPct > 100
                  ? 'Budget Exceeded'
                  : budgetUtilizationPct === 100
                  ? '100% Budget Consumed'
                  : budgetUtilizationPct >= 80
                  ? '80% Budget Consumed'
                  : 'Within Budget'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetUtilizationPct >= 100
                    ? 'bg-rose-600'
                    : budgetUtilizationPct >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(100, budgetUtilizationPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Loan & EMI Commitments Summary Card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Loans & EMI Commitments
              </h3>
              <p className="text-xs text-slate-500">
                Active loan liabilities and monthly amortization obligations
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('loans')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              <span>Manage Loans</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
              <span className="text-[11px] text-slate-400 block">Total Active Loans</span>
              <strong className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white block">
                {totalActiveLoansCount} {totalActiveLoansCount === 1 ? 'Loan' : 'Loans'}
              </strong>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
              <span className="text-[11px] text-slate-400 block">Outstanding Principal</span>
              <strong className="mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400 block">
                {formatINR(totalOutstandingPrincipal)}
              </strong>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
              <span className="text-[11px] text-slate-400 block">Total EMI Commitments</span>
              <strong className="mt-0.5 text-sm font-bold text-purple-600 dark:text-purple-400 block">
                {formatINR(totalMonthlyEmi)}/mo
              </strong>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>
              EMIs Paid in {formatMonthLabel(summary.month)}:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {formatINR(summary.totalEmiPaid)}
              </strong>
            </span>
            <span>
              Remaining EMI Due:{' '}
              <strong className="text-slate-900 dark:text-white">
                {formatINR(Math.max(0, totalMonthlyEmi - summary.totalEmiPaid))}
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 & Section 2: Income vs Expense Chart + Category-wise Expense Breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Section 1: Income vs Expense */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Income vs Expense (6-Month Trend)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly comparison of Credited Income, Expenses & Surplus
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <span>Reports</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="income" name="Income" fill="#059669" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#e11d48" radius={[6, 6, 0, 0]} />
                <Bar dataKey="surplus" name="Surplus" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Section 2: Expense Breakdown (Category-wise Spending) */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Category-wise Expense Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Where your money went in {formatMonthLabel(summary.month)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <span>All Expenses</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-center text-xs text-slate-400">
              <p>No expenses recorded for {formatMonthLabel(summary.month)} yet.</p>
              <button
                type="button"
                onClick={onOpenQuickAdd}
                className="mt-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
              >
                + Add First Expense
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-center">
              <div className="h-48 sm:col-span-5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="totalAmount"
                      nameKey="categoryName"
                      innerRadius={42}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((entry, idx) => (
                        <Cell
                          key={entry.categoryId}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatINR(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5 sm:col-span-7 max-h-52 overflow-y-auto pr-1">
                {categoryBreakdown.slice(0, 6).map((item, idx) => (
                  <div key={item.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 truncate">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="truncate">{item.categoryName}</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">
                        {formatINR(item.totalAmount)}{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          ({item.percentage}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Section 3 & Section 4: Family Expense Breakdown + Savings Goal Progress */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Section 3: Family Expense Breakdown */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Family Expense Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Spending across Self, Spouse, Children, Parents & Entire Family
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('family')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <span>Manage</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {familyBreakdown.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-xs text-slate-400">
              No family expenses recorded this month.
            </div>
          ) : (
            <div className="space-y-3">
              {familyBreakdown.map((fam, idx) => (
                <div
                  key={fam.familyMemberId || fam.familyMemberName}
                  className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {fam.familyMemberName}
                      </span>
                      <span className="rounded-md bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                        {fam.transactionCount} txns
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatINR(fam.totalAmount)} ({fam.percentage}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${fam.percentage}%`,
                        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Savings Goal Progress */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Savings Goal Progress
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Monthly and yearly targets tracked independently of expenses
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <span>All Goals</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-xs text-slate-400">
              <p>No active savings goals yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('goals')}
                className="mt-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
              >
                + Create Savings Goal
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Overall Savings Goals Dashboard Strip (Prompt 5 requirement) */}
              {(() => {
                const overall = summarizeSavingsGoals(savingsGoals);
                return (
                  <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                      <div>
                        <span className="text-slate-500">Active Goals</span>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {overall.totalActiveGoals} Active ({overall.totalCompletedGoals} Done)
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Total Target</span>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatINR(overall.totalTargetAmount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Contributed</span>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatINR(overall.totalContributed)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Remaining</span>
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">
                          {formatINR(overall.remainingTargetAmount)} ({overall.overallCompletionPercent}%)
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {savingsGoals.map((goal) => {
                const metrics = calculateSavingsGoalMetrics(
                  goal.targetAmount,
                  goal.currentContribution,
                  goal.targetDate
                );
                return (
                  <div
                    key={goal.id}
                    className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {goal.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Target by {formatDateDDMMMYYYY(goal.targetDate)} •{' '}
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {metrics.completionPercent}% completed
                          </span>
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        {goal.status === 'completed' ? 'Completed' : goal.priority}
                      </span>
                    </div>

                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${metrics.completionPercent}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>
                        Saved: <strong className="text-slate-900 dark:text-white">{formatINR(goal.currentContribution)}</strong> / {formatINR(goal.targetAmount)}
                      </span>
                      <span>Remaining: {formatINR(metrics.remainingAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Section 5: Recent Transactions */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Transactions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest income credits, daily expenses, goal contributions & transfers
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No transactions recorded yet. Use the floating <strong>+ Add</strong> button or enable{' '}
            <strong>Demo: ON</strong> in the header to explore sample records.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentTransactions.slice(0, 8).map((tx) => {
              const isPositive = tx.kind === 'income';
              const isNeutral = tx.kind === 'transfer' || tx.kind === 'savings';

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        tx.kind === 'income'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                          : tx.kind === 'savings'
                          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                          : tx.kind === 'transfer'
                          ? 'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400'
                          : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.kind === 'income' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : tx.kind === 'transfer' ? (
                        <ArrowLeftRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {tx.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{formatDateDDMMMYYYY(tx.date)}</span>
                        <span>•</span>
                        <span>{tx.category}</span>
                        {tx.familyMember && (
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                            {tx.familyMember}
                          </span>
                        )}
                        {tx.paymentMode && (
                          <span className="text-[10px] text-slate-400">({tx.paymentMode})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-xs font-bold sm:text-sm ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isNeutral
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {isPositive ? '+' : '-'}
                        {formatINR(tx.amount)}
                      </p>
                      <p className="text-[10px] text-slate-400">{tx.accountName}</p>
                    </div>

                    {onEditTransaction && (
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx.id)}
                        title="Edit Transaction"
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 6: Interactive Financial & Savings Goal Calculator (Specification Section 4 Validation Tool) */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Interactive Financial &amp; Savings Goal Calculator
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                What-if simulator (does not alter IndexedDB records) • Validates Monthly Surplus vs Savings Contributions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCalcIncome('120000');
                setCalcExpenses('65000');
                setCalcContributions('10000');
                setCalcTargetSavings('300000');
                setCalcAlreadyContributed('60000');
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Load Benchmark Scenario (₹1.2L / ₹65k / ₹10k)
            </button>
            <button
              type="button"
              onClick={() => {
                setCalcIncome(String(summary.totalIncome));
                setCalcExpenses(String(summary.totalExpenses));
                setCalcContributions(String(summary.totalContributions));
                const overallGoals = summarizeSavingsGoals(savingsGoals);
                setCalcTargetSavings(String(overallGoals.totalTargetAmount || 300000));
                setCalcAlreadyContributed(String(overallGoals.totalContributed || 0));
              }}
              className="rounded-xl bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
            >
              Load Current Month Actuals
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Monthly Surplus & Unallocated Surplus Simulator */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200/60 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Monthly Financial Summary Simulator
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Monthly Income (₹)
                </label>
                <input
                  type="number"
                  value={calcIncome}
                  onChange={(e) => setCalcIncome(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Monthly Expenses (₹)
                </label>
                <input
                  type="number"
                  value={calcExpenses}
                  onChange={(e) => setCalcExpenses(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Savings Contrib. (₹)
                </label>
                <input
                  type="number"
                  value={calcContributions}
                  onChange={(e) => setCalcContributions(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-2 border-t border-slate-200/70 dark:border-slate-700 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Monthly Surplus</span>
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {formatINR(calcMonthlySurplus)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Savings Rate</span>
                <strong className="text-amber-600 dark:text-amber-400">
                  {calcSavingsRate}%
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Contribution Amt</span>
                <strong className="text-indigo-600 dark:text-indigo-400">
                  {formatINR(numCalcContributions)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Unallocated Surplus*</span>
                <strong
                  className={
                    calcUnallocatedSurplus >= 0
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-rose-600'
                  }
                >
                  {formatINR(calcUnallocatedSurplus)}
                </strong>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              *Assumes contributions are made from this month&apos;s surplus and are not already included in expenses.
            </p>
          </div>

          {/* Savings Goal Progress Calculator */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200/60 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Savings Goal Completion Calculator
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Target Savings (₹)
                </label>
                <input
                  type="number"
                  value={calcTargetSavings}
                  onChange={(e) => setCalcTargetSavings(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Already Contributed (₹)
                </label>
                <input
                  type="number"
                  value={calcAlreadyContributed}
                  onChange={(e) => setCalcAlreadyContributed(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>
                  Goal Completion: <strong className="text-emerald-600">{calcGoalCompletion.toFixed(1)}%</strong>
                </span>
                <span>
                  Remaining Goal: <strong className="text-slate-900 dark:text-white">{formatINR(calcRemainingGoal)}</strong>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${Math.min(100, calcGoalCompletion)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
