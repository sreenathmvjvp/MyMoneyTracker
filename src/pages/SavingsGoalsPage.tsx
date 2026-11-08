import React, { useMemo, useState } from 'react';
import {
  Target,
  PiggyBank,
  Plus,
  Calendar,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Sparkles,
  BarChart3,
  X,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type {
  AccountRecord,
  GoalPriority,
  GoalStatus,
  MonthlyFinancialSummary,
  PaymentMode,
  SavingsContributionRecord,
  SavingsGoalRecord,
} from '../types';
import { calculateSavingsGoalMetrics } from '../calculations/financialCalculations';
import { databaseService } from '../services/databaseService';
import {
  formatDateDDMMMYYYY,
  formatINR,
  formatMonthLabel,
  getTodayISO,
} from '../utilities/formatters';

interface SavingsGoalsPageProps {
  goals: SavingsGoalRecord[];
  contributions: SavingsContributionRecord[];
  accounts: AccountRecord[];
  summary: MonthlyFinancialSummary;
  selectedMonth: string;
  onChangeSelectedMonth: (month: string) => void;
  goalsSummary: {
    totalActiveGoals: number;
    totalCompletedGoals: number;
    totalTargetAmount: number;
    totalContributed: number;
    remainingTargetAmount: number;
    overallCompletionPercent: number;
  };
  demoMode: boolean;
  onDisableDemoMode: () => Promise<void>;
}

const GOAL_TEMPLATES: Array<{
  name: string;
  targetAmount: number;
  priority: GoalPriority;
  category: 'savings' | 'investment';
  description: string;
}> = [
  {
    name: 'Emergency Fund',
    targetAmount: 300000,
    priority: 'High',
    category: 'savings',
    description: '6 months of household expenses in liquid savings / sweep FD',
  },
  {
    name: "Children's Education",
    targetAmount: 500000,
    priority: 'High',
    category: 'investment',
    description: 'Higher education corpus via SIP & long-term funds',
  },
  {
    name: 'Home Purchase',
    targetAmount: 1000000,
    priority: 'High',
    category: 'savings',
    description: 'Down payment & registration corpus for home purchase',
  },
  {
    name: 'Family Vacation',
    targetAmount: 80000,
    priority: 'Medium',
    category: 'savings',
    description: 'Annual family travel & holiday fund',
  },
  {
    name: 'Annual Savings',
    targetAmount: 150000,
    priority: 'Medium',
    category: 'savings',
    description: 'Yearly household reserve & festival fund',
  },
  {
    name: 'Long-term Investments',
    targetAmount: 600000,
    priority: 'Medium',
    category: 'investment',
    description: 'Retirement & wealth building portfolio (PPF, NPS, Index Funds)',
  },
];

const PAYMENT_MODES: PaymentMode[] = [
  'Bank Transfer',
  'UPI',
  'Google Pay',
  'PhonePe',
  'Debit Card',
  'Cash',
];

export const SavingsGoalsPage: React.FC<SavingsGoalsPageProps> = ({
  goals,
  contributions,
  accounts,
  summary,
  selectedMonth,
  onChangeSelectedMonth,
  goalsSummary,
  demoMode,
  onDisableDemoMode,
}) => {
  // Sub-views: 'goals' | 'analysis' | 'contributions'
  const [activeTab, setActiveTab] = useState<'goals' | 'analysis' | 'contributions'>('goals');
  const [statusFilter, setStatusFilter] = useState<'ALL' | GoalStatus>('ALL');

  // Add / Edit Goal Modal State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalRecord | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalCurrentContribution, setGoalCurrentContribution] = useState('0');
  const [goalStartDate, setGoalStartDate] = useState(getTodayISO());
  const [goalTargetDate, setGoalTargetDate] = useState('2027-12-31');
  const [goalPriority, setGoalPriority] = useState<GoalPriority>('High');
  const [goalCategory, setGoalCategory] = useState<'savings' | 'investment'>('savings');
  const [goalStatus, setGoalStatus] = useState<GoalStatus>('active');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  // Add / Edit Contribution Modal State
  const [isContribModalOpen, setIsContribModalOpen] = useState(false);
  const [editingContrib, setEditingContrib] = useState<SavingsContributionRecord | null>(
    null
  );
  const [contribGoalId, setContribGoalId] = useState('');
  const [contribDate, setContribDate] = useState(getTodayISO());
  const [contribAmount, setContribAmount] = useState('');
  const [contribType, setContribType] = useState<'savings' | 'investment'>('savings');
  const [contribAccountId, setContribAccountId] = useState(
    accounts[0]?.id ?? 'acc_salary_bank'
  );
  const [contribPaymentMode, setContribPaymentMode] =
    useState<PaymentMode>('Bank Transfer');
  const [contribNotes, setContribNotes] = useState('');
  const [contribError, setContribError] = useState<string | null>(null);
  const [contribSubmitting, setContribSubmitting] = useState(false);

  // Delete Confirmation Modals
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoalRecord | null>(null);
  const [contribToDelete, setContribToDelete] =
    useState<SavingsContributionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Filtered goals list
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => statusFilter === 'ALL' || g.status === statusFilter);
  }, [goals, statusFilter]);

  const completedGoalsList = useMemo(
    () => goals.filter((g) => g.status === 'completed'),
    [goals]
  );

  // Goal-wise contributions breakdown for chart & analysis
  const goalWiseChartData = useMemo(() => {
    return goals.map((g) => {
      const monthAdded = contributions
        .filter((c) => c.goalId === g.id && c.month === selectedMonth)
        .reduce((s, c) => s + c.amount, 0);
      const remaining = Math.max(0, g.targetAmount - g.currentContribution);
      const pct =
        g.targetAmount > 0
          ? Number(Math.min(100, (g.currentContribution / g.targetAmount) * 100).toFixed(1))
          : 0;
      return {
        id: g.id,
        name: g.name.length > 18 ? `${g.name.slice(0, 18)}…` : g.name,
        fullName: g.name,
        target: g.targetAmount,
        contributed: g.currentContribution,
        remaining,
        monthAdded,
        pct,
      };
    });
  }, [goals, contributions, selectedMonth]);

  // Yearly Contribution Trend (Indian Financial Year April to March)
  const yearlyContributionTrend = useMemo(() => {
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const fyStartYear = (mo || 11) >= 4 ? yr || 2026 : (yr || 2026) - 1;

    const months: string[] = [];
    for (let m = 4; m <= 12; m++) {
      months.push(`${fyStartYear}-${String(m).padStart(2, '0')}`);
    }
    for (let m = 1; m <= 3; m++) {
      months.push(`${fyStartYear + 1}-${String(m).padStart(2, '0')}`);
    }

    let runningCumulative = 0;
    return months.map((ym) => {
      const monthContribs = contributions.filter((c) => c.month === ym);
      const savingsAmt = monthContribs
        .filter((c) => c.contributionType === 'savings')
        .reduce((s, c) => s + c.amount, 0);
      const investmentAmt = monthContribs
        .filter((c) => c.contributionType === 'investment')
        .reduce((s, c) => s + c.amount, 0);
      const totalAmt = savingsAmt + investmentAmt;
      runningCumulative += totalAmt;

      return {
        month: ym,
        label: formatMonthLabel(ym).split(' ')[0],
        savings: savingsAmt,
        investment: investmentAmt,
        total: totalAmt,
        cumulative: runningCumulative,
      };
    });
  }, [contributions, selectedMonth]);

  const cumulativeContributionsAllTime = useMemo(
    () => contributions.reduce((s, c) => s + c.amount, 0),
    [contributions]
  );

  // Open Create Goal Modal
  const openCreateGoalModal = (template?: (typeof GOAL_TEMPLATES)[number]) => {
    setEditingGoal(null);
    setGoalName(template?.name ?? '');
    setGoalTargetAmount(template ? String(template.targetAmount) : '');
    setGoalCurrentContribution('0');
    setGoalStartDate(getTodayISO());
    setGoalTargetDate('2027-12-31');
    setGoalPriority(template?.priority ?? 'High');
    setGoalCategory(template?.category ?? 'savings');
    setGoalStatus('active');
    setGoalDescription(template?.description ?? '');
    setGoalError(null);
    setIsGoalModalOpen(true);
  };

  // Open Edit Goal Modal
  const openEditGoalModal = (goal: SavingsGoalRecord) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalTargetAmount(String(goal.targetAmount));
    setGoalCurrentContribution(String(goal.currentContribution));
    setGoalStartDate(goal.startDate);
    setGoalTargetDate(goal.targetDate);
    setGoalPriority(goal.priority);
    setGoalCategory(goal.category);
    setGoalStatus(goal.status);
    setGoalDescription(goal.description ?? '');
    setGoalError(null);
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalError(null);

    const targetNum = Number(goalTargetAmount);
    const currentNum = Number(goalCurrentContribution) || 0;

    if (!goalName.trim()) {
      setGoalError('Goal Name is required.');
      return;
    }
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setGoalError('Target Amount must be greater than ₹0.');
      return;
    }
    if (currentNum < 0) {
      setGoalError('Current Contribution cannot be negative.');
      return;
    }

    setGoalSubmitting(true);
    try {
      if (demoMode) {
        await onDisableDemoMode();
      }

      const payload = {
        name: goalName.trim(),
        targetAmount: targetNum,
        currentContribution: currentNum,
        startDate: goalStartDate,
        targetDate: goalTargetDate,
        priority: goalPriority,
        category: goalCategory,
        status: goalStatus,
        description: goalDescription.trim() || undefined,
      };

      if (editingGoal && !editingGoal.id.startsWith('demo_')) {
        await databaseService.updateSavingsGoal(editingGoal.id, payload);
        showToast(`Updated savings goal "${payload.name}" in IndexedDB.`);
      } else {
        await databaseService.addSavingsGoal(payload);
        showToast(`Created savings goal "${payload.name}" (${formatINR(targetNum)})!`);
      }

      setIsGoalModalOpen(false);
    } catch (err: unknown) {
      setGoalError(err instanceof Error ? err.message : String(err));
    } finally {
      setGoalSubmitting(false);
    }
  };

  // Open Add Contribution Modal
  const openAddContribModal = (presetGoal?: SavingsGoalRecord) => {
    setEditingContrib(null);
    const defaultGoal = presetGoal ?? goals[0];
    setContribGoalId(defaultGoal?.id ?? '');
    setContribDate(getTodayISO());
    setContribAmount('');
    setContribType(defaultGoal?.category ?? 'savings');
    setContribAccountId(accounts[0]?.id ?? 'acc_salary_bank');
    setContribPaymentMode('Bank Transfer');
    setContribNotes('');
    setContribError(null);
    setIsContribModalOpen(true);
  };

  // Open Edit Contribution Modal
  const openEditContribModal = (c: SavingsContributionRecord) => {
    setEditingContrib(c);
    setContribGoalId(c.goalId);
    setContribDate(c.transactionDate);
    setContribAmount(String(c.amount));
    setContribType(c.contributionType);
    setContribAccountId(c.sourceAccountId);
    setContribPaymentMode(c.paymentMode);
    setContribNotes(c.notes ?? '');
    setContribError(null);
    setIsContribModalOpen(true);
  };

  const handleSaveContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    setContribError(null);

    const amtNum = Number(contribAmount);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      setContribError('Please enter a valid contribution amount greater than ₹0.');
      return;
    }

    setContribSubmitting(true);
    try {
      if (demoMode) {
        await onDisableDemoMode();
      }

      let targetGoal = goals.find(
        (g) => g.id === contribGoalId && !g.id.startsWith('demo_')
      );
      if (!targetGoal) {
        // If user was in demo mode or had no real goal yet, create the goal in IndexedDB
        const demoRef = goals.find((g) => g.id === contribGoalId);
        targetGoal = await databaseService.addSavingsGoal({
          name: demoRef?.name ?? 'Emergency Fund',
          targetAmount: demoRef?.targetAmount ?? 300000,
          currentContribution: 0,
          startDate: getTodayISO(),
          targetDate: demoRef?.targetDate ?? '2027-12-31',
          priority: demoRef?.priority ?? 'High',
          category: contribType,
          status: 'active',
          description: demoRef?.description,
        });
      }

      const chosenAcc =
        accounts.find((a) => a.id === contribAccountId) ?? accounts[0];

      const payload = {
        goalId: targetGoal.id,
        goalName: targetGoal.name,
        transactionDate: contribDate,
        amount: amtNum,
        contributionType: contribType,
        sourceAccountId: chosenAcc?.id ?? 'acc_salary_bank',
        sourceAccountName: chosenAcc?.name ?? 'Primary Salary Bank Account',
        paymentMode: contribPaymentMode,
        notes: contribNotes.trim() || undefined,
      };

      if (editingContrib && !editingContrib.id.startsWith('demo_')) {
        await databaseService.updateSavingsContribution(editingContrib.id, payload);
        showToast(
          `Updated contribution (${formatINR(amtNum)}) & recalculated "${targetGoal.name}".`
        );
      } else {
        await databaseService.addSavingsContribution(payload);
        showToast(
          `Recorded ${formatINR(amtNum)} contribution to "${targetGoal.name}"!`
        );
      }

      onChangeSelectedMonth(contribDate.slice(0, 7));
      setIsContribModalOpen(false);
    } catch (err: unknown) {
      setContribError(err instanceof Error ? err.message : String(err));
    } finally {
      setContribSubmitting(false);
    }
  };

  const handleConfirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    setDeleting(true);
    try {
      if (demoMode || goalToDelete.id.startsWith('demo_')) {
        await onDisableDemoMode();
        setGoalToDelete(null);
        return;
      }
      await databaseService.deleteSavingsGoal(goalToDelete.id);
      showToast(`Deleted savings goal "${goalToDelete.name}" from IndexedDB.`);
      setGoalToDelete(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmDeleteContrib = async () => {
    if (!contribToDelete) return;
    setDeleting(true);
    try {
      if (demoMode || contribToDelete.id.startsWith('demo_')) {
        await onDisableDemoMode();
        setContribToDelete(null);
        return;
      }
      await databaseService.deleteSavingsContribution(contribToDelete.id);
      showToast(
        `Deleted ${formatINR(contribToDelete.amount)} contribution & updated "${contribToDelete.goalName}" goal progress.`
      );
      setContribToDelete(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Feedback Banner */}
      {toastMsg && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/70 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-emerald-600 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Primary Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            Savings Goals & Monthly Savings Tracking
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track emergency funds, education corpus & investments separately from consumption expenses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold">
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-slate-500">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) onChangeSelectedMonth(e.target.value);
              }}
              className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={() => openCreateGoalModal()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
          >
            <Target className="h-4 w-4" />
            <span>+ New Savings Goal</span>
          </button>

          <button
            type="button"
            onClick={() => openAddContribModal()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Contribution</span>
          </button>
        </div>
      </div>

      {/* 5 Required Dashboard Metrics for Savings Goals */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
            <span className="text-[11px] font-medium text-slate-500">
              1. Active Savings Goals
            </span>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {goalsSummary.totalActiveGoals}
            </p>
            <span className="text-[10px] font-semibold text-emerald-600">
              +{goalsSummary.totalCompletedGoals} Completed Goals
            </span>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
            <span className="text-[11px] font-medium text-slate-500">
              2. Total Target Amount
            </span>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {formatINR(goalsSummary.totalTargetAmount)}
            </p>
            <span className="text-[10px] text-slate-400">Combined goal targets</span>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
            <span className="text-[11px] font-medium text-slate-500">
              3. Total Contributions
            </span>
            <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatINR(goalsSummary.totalContributed)}
            </p>
            <span className="text-[10px] text-slate-400">Accumulated corpus</span>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
            <span className="text-[11px] font-medium text-slate-500">
              4. Remaining Target
            </span>
            <p className="mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {formatINR(goalsSummary.remainingTargetAmount)}
            </p>
            <span className="text-[10px] text-slate-400">Balance to achieve 100%</span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-900 p-3.5">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              5. Overall Completion
            </span>
            <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {goalsSummary.overallCompletionPercent}%
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${goalsSummary.overallCompletionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'goals', label: `Savings Goals (${goals.length})`, icon: Target },
          {
            id: 'analysis',
            label: 'Monthly Savings & Yearly Trend Analysis',
            icon: BarChart3,
          },
          {
            id: 'contributions',
            label: `Contribution Transactions (${contributions.length})`,
            icon: PiggyBank,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                active
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SAVINGS GOALS CARDS & COMPLETED GOALS */}
      {activeTab === 'goals' && (
        <div className="space-y-5">
          {/* Status Filter Pills + Quick Goal Templates */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: `All Goals (${goals.length})` },
                  {
                    id: 'active',
                    label: `Active (${goalsSummary.totalActiveGoals})`,
                  },
                  {
                    id: 'completed',
                    label: `Completed (${goalsSummary.totalCompletedGoals})`,
                  },
                  { id: 'paused', label: 'Paused' },
                ] as { id: 'ALL' | GoalStatus; label: string }[]
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400">
                Quick Goal Templates:
              </span>
              {GOAL_TEMPLATES.slice(0, 3).map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => openCreateGoalModal(tpl)}
                  className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                >
                  + {tpl.name}
                </button>
              ))}
            </div>
          </div>

          {filteredGoals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-xs text-slate-400">
              No savings goals match this filter. Click <strong>+ New Savings Goal</strong> to start
              tracking a financial target.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {filteredGoals.map((goal) => {
                const metrics = calculateSavingsGoalMetrics(
                  goal.targetAmount,
                  goal.currentContribution,
                  goal.targetDate
                );
                const isCompleted =
                  goal.status === 'completed' || metrics.completionPercent >= 100;

                return (
                  <div
                    key={goal.id}
                    className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition ${
                      isCompleted
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isCompleted ? (
                              <Award className="h-5 w-5" />
                            ) : (
                              <Target className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              {goal.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {goal.category}
                              </span>
                              <span>•</span>
                              <span className="text-slate-500">{goal.priority} Priority</span>
                              <span>•</span>
                              <span
                                className={
                                  isCompleted
                                    ? 'text-emerald-600'
                                    : goal.status === 'paused'
                                    ? 'text-amber-600'
                                    : 'text-sky-600'
                                }
                              >
                                {isCompleted ? 'Completed' : goal.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {metrics.completionPercent}%
                        </span>
                      </div>

                      {goal.description && (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                          {goal.description}
                        </p>
                      )}

                      {/* Progress Bar */}
                      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCompleted ? 'bg-emerald-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${metrics.completionPercent}%` }}
                        />
                      </div>

                      {/* Contributed, Target, Remaining */}
                      <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400">Contributed</span>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatINR(goal.currentContribution)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400">Remaining</span>
                          <p className="font-bold text-indigo-600 dark:text-indigo-400">
                            {formatINR(metrics.remainingAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400">Target Amount</span>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {formatINR(goal.targetAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Start Date, Target Date & Required Monthly Contribution */}
                      <div className="mt-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" /> Start Date:
                          </span>
                          <span className="font-semibold">
                            {formatDateDDMMMYYYY(goal.startDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-emerald-600" /> Target Completion:
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatDateDDMMMYYYY(goal.targetDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700">
                          <span>Monthly Requirement:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {isCompleted
                              ? 'Goal Achieved! (₹0/mo)'
                              : `${formatINR(metrics.requiredMonthlyContribution)} / month`}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openAddContribModal(goal)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Contribute
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditGoalModal(goal)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-emerald-500 cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setGoalToDelete(goal)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dedicated Completed Goals Highlight Section */}
          {completedGoalsList.length > 0 && statusFilter === 'ALL' && (
            <section className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Award className="h-4 w-4 text-emerald-600" />
                <span>
                  Completed Goals Milestone ({completedGoalsList.length} Achieved)
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {completedGoalsList.map((cg) => (
                  <span
                    key={cg.id}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {cg.name}: {formatINR(cg.currentContribution)} / {formatINR(cg.targetAmount)} (100%)
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: MONTHLY SAVINGS & YEARLY CONTRIBUTION ANALYSIS */}
      {activeTab === 'analysis' && (
        <div className="space-y-5">
          {/* Monthly Savings Analysis Strip */}
          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Monthly Savings Analysis ({formatMonthLabel(selectedMonth)})
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Business Rule: Monthly surplus (Income − Expenses) is displayed separately from actual
              Savings & Investment contributions.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-[11px] text-slate-500">Monthly Surplus</span>
                <p className="mt-1 text-base font-bold text-emerald-600">
                  {formatINR(summary.monthlySurplus)}
                </p>
                <span className="text-[10px] text-slate-400">Income − Expenses</span>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-[11px] text-slate-500">Savings Contributions</span>
                <p className="mt-1 text-base font-bold text-sky-600">
                  {formatINR(summary.savingsContributions)}
                </p>
                <span className="text-[10px] text-slate-400">Allocated to savings</span>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-[11px] text-slate-500">Investment Contrib.</span>
                <p className="mt-1 text-base font-bold text-indigo-600">
                  {formatINR(summary.investmentContributions)}
                </p>
                <span className="text-[10px] text-slate-400">Allocated to investments</span>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-[11px] text-slate-500">Unallocated Surplus</span>
                <p className="mt-1 text-base font-bold text-amber-600">
                  {formatINR(summary.unallocatedSurplus)}
                </p>
                <span className="text-[10px] text-slate-400">Surplus − Contributions</span>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <span className="text-[11px] text-slate-500">Cumulative Saved</span>
                <p className="mt-1 text-base font-bold text-purple-600">
                  {formatINR(
                    Math.max(goalsSummary.totalContributed, cumulativeContributionsAllTime)
                  )}
                </p>
                <span className="text-[10px] text-slate-400">All-time goal corpus</span>
              </div>
            </div>
          </section>

          {/* Charts Row: Yearly Contribution Trend + Goal-wise Progress Chart */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Chart 1: Yearly Contribution Trend */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Yearly Contribution Trend ({summary.financialYear})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Monthly Savings vs Investment allocations (April to March)
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={yearlyContributionTrend}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(val: number) => formatINR(val)} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="savings"
                      name="Savings Contributions"
                      stackId="a"
                      fill="#059669"
                    />
                    <Bar
                      dataKey="investment"
                      name="Investment Contributions"
                      stackId="a"
                      fill="#4f46e5"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Chart 2: Goal-wise Contributions vs Remaining Target */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Goal-wise Corpus vs Remaining Target
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparison of accumulated contributions and remaining target per goal
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={goalWiseChartData}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(val: number) => formatINR(val)} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="contributed"
                      name="Contributed (₹)"
                      stackId="goal"
                      fill="#10b981"
                    />
                    <Bar
                      dataKey="remaining"
                      name="Remaining Target (₹)"
                      stackId="goal"
                      fill="#cbd5e1"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 3: CONTRIBUTION TRANSACTIONS LEDGER (Add / Edit / Delete) */}
      {activeTab === 'contributions' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Savings & Investment Contribution Records ({contributions.length})
              </h2>
              <p className="text-xs text-slate-500">
                Editing or deleting any contribution atomically recalculates its associated goal
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddContribModal()}
              className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer"
            >
              + Record Contribution
            </button>
          </div>

          {contributions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No savings contributions recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {contributions
                .slice()
                .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                        <PiggyBank className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                            {c.goalName}
                          </h3>
                          <span className="rounded-full bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                            {c.contributionType}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Date: <strong>{formatDateDDMMMYYYY(c.transactionDate)}</strong> • Mode:{' '}
                          {c.paymentMode} • From: {c.sourceAccountName}
                        </p>
                        {c.notes && (
                          <p className="mt-0.5 text-[11px] italic text-slate-400">
                            Notes: {c.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800 pt-2 sm:pt-0">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatINR(c.amount)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditContribModal(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setContribToDelete(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* CREATE / EDIT SAVINGS GOAL MODAL */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingGoal ? 'Edit Savings Goal' : 'Create Savings / Investment Goal'}
                </h2>
                <p className="text-xs text-slate-500">
                  Define target amount, start/completion dates, and priority
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!editingGoal && (
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-500">
                  1-Tap Goal Presets:
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {GOAL_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => openCreateGoalModal(tpl)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3 text-emerald-600" />
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveGoal} className="mt-4 space-y-3.5">
              {goalError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{goalError}</span>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Goal Name *
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emergency Fund, Children's Education"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Target Amount (₹) *
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 300000"
                    value={goalTargetAmount}
                    onChange={(e) => setGoalTargetAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Current Contribution (₹)
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={goalCurrentContribution}
                    onChange={(e) => setGoalCurrentContribution(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Target Start Date *
                  </span>
                  <input
                    type="date"
                    required
                    value={goalStartDate}
                    onChange={(e) => setGoalStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Target Completion Date *
                  </span>
                  <input
                    type="date"
                    required
                    value={goalTargetDate}
                    onChange={(e) => setGoalTargetDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Priority
                  </span>
                  <select
                    value={goalPriority}
                    onChange={(e) => setGoalPriority(e.target.value as GoalPriority)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-medium"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Category
                  </span>
                  <select
                    value={goalCategory}
                    onChange={(e) =>
                      setGoalCategory(e.target.value as 'savings' | 'investment')
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-medium"
                  >
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Goal Status
                  </span>
                  <select
                    value={goalStatus}
                    onChange={(e) => setGoalStatus(e.target.value as GoalStatus)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Goal Description
                </span>
                <textarea
                  rows={2}
                  placeholder="Describe where this fund is held or its purpose..."
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={goalSubmitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  {goalSubmitting
                    ? 'Saving...'
                    : editingGoal
                    ? 'Update Goal'
                    : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT CONTRIBUTION MODAL */}
      {isContribModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingContrib ? 'Edit Goal Contribution' : 'Add Savings Contribution'}
                </h2>
                <p className="text-xs text-slate-500">
                  Recorded separately from consumption expenses
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsContribModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContribution} className="mt-4 space-y-3.5">
              {contribError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{contribError}</span>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Target Savings Goal *
                </span>
                <select
                  value={contribGoalId}
                  onChange={(e) => setContribGoalId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (Target: {formatINR(g.targetAmount)})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Contribution Amount (₹) *
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 10000"
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Contribution Date *
                  </span>
                  <input
                    type="date"
                    required
                    value={contribDate}
                    onChange={(e) => setContribDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Allocation Type
                  </span>
                  <select
                    value={contribType}
                    onChange={(e) =>
                      setContribType(e.target.value as 'savings' | 'investment')
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    <option value="savings">Savings Contribution</option>
                    <option value="investment">Investment Contribution</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Payment Mode
                  </span>
                  <select
                    value={contribPaymentMode}
                    onChange={(e) => setContribPaymentMode(e.target.value as PaymentMode)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Source Bank Account
                </span>
                <select
                  value={contribAccountId}
                  onChange={(e) => setContribAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Notes (Optional)
                </span>
                <input
                  type="text"
                  placeholder="e.g. Monthly SIP installment / Sweep FD transfer"
                  value={contribNotes}
                  onChange={(e) => setContribNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsContribModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contribSubmitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  {contribSubmitting
                    ? 'Saving...'
                    : editingContrib
                    ? 'Update Contribution'
                    : 'Save Contribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE GOAL CONFIRMATION MODAL */}
      {goalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Confirm Delete Savings Goal
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Deleting <strong>{goalToDelete.name}</strong> will also remove its associated
              contribution records from IndexedDB.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGoalToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDeleteGoal}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONTRIBUTION CONFIRMATION MODAL */}
      {contribToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Confirm Delete Contribution
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Deleting this <strong>{formatINR(contribToDelete.amount)}</strong> contribution will
              automatically deduct {formatINR(contribToDelete.amount)} from{' '}
              <strong>{contribToDelete.goalName}</strong> and restore the source account balance.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContribToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDeleteContrib}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
