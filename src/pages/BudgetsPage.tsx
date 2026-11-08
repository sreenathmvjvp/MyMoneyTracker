import React, { useMemo, useState } from 'react';
import {
  PieChart,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Copy,
  Edit3,
  Trash2,
  Users,
  Tag,
  X,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';
import type {
  BudgetRecord,
  CategoryRecord,
  ExpenseRecord,
  FamilyMemberRecord,
  MonthlyFinancialSummary,
} from '../types';
import type {
  CategoryBreakdownItem,
  FamilyBreakdownItem,
} from '../reports/reportEngine';
import { formatINR, formatMonthLabel } from '../utilities/formatters';
import { databaseService } from '../services/databaseService';

interface BudgetsPageProps {
  budgets: BudgetRecord[];
  summary: MonthlyFinancialSummary;
  selectedMonth: string;
  onChangeSelectedMonth: (month: string) => void;
  categories: CategoryRecord[];
  familyMembers: FamilyMemberRecord[];
  expenses: ExpenseRecord[];
  categoryBreakdown: CategoryBreakdownItem[];
  familyBreakdown: FamilyBreakdownItem[];
  demoMode: boolean;
  onDisableDemoMode: () => void;
}

/**
 * Prompt 6 core budget categories with smart mapping to seeded expense categories
 */
const PROMPT_6_CATEGORY_PRESETS: Array<{
  id: string;
  name: string;
  defaultLimit: number;
  matchCategoryIds: string[];
  matchNames: string[];
}> = [
  {
    id: 'cat_rent',
    name: 'Rent',
    defaultLimit: 25000,
    matchCategoryIds: ['cat_rent'],
    matchNames: ['rent'],
  },
  {
    id: 'cat_groceries',
    name: 'Groceries',
    defaultLimit: 12000,
    matchCategoryIds: ['cat_groceries', 'cat_vegetables'],
    matchNames: ['groceries', 'vegetables'],
  },
  {
    id: 'cat_school_fees',
    name: 'School Fees',
    defaultLimit: 15000,
    matchCategoryIds: ['cat_school_fees', 'cat_children_edu'],
    matchNames: ['school fees', "children's school fees", "children's education"],
  },
  {
    id: 'cat_electricity',
    name: 'Electricity',
    defaultLimit: 4000,
    matchCategoryIds: ['cat_electricity'],
    matchNames: ['electricity'],
  },
  {
    id: 'cat_transport',
    name: 'Transportation',
    defaultLimit: 6000,
    matchCategoryIds: ['cat_transport', 'cat_fuel'],
    matchNames: ['transportation', 'fuel'],
  },
  {
    id: 'cat_medical',
    name: 'Medical',
    defaultLimit: 5000,
    matchCategoryIds: ['cat_medical'],
    matchNames: ['medical'],
  },
  {
    id: 'cat_family_shopping',
    name: 'Shopping',
    defaultLimit: 8000,
    matchCategoryIds: ['cat_family_shopping', 'cat_personal_shopping', 'cat_clothing'],
    matchNames: ['shopping', 'family shopping', 'personal shopping', 'clothing'],
  },
  {
    id: 'cat_entertainment',
    name: 'Entertainment',
    defaultLimit: 4000,
    matchCategoryIds: ['cat_entertainment', 'cat_restaurants'],
    matchNames: ['entertainment', 'restaurants'],
  },
  {
    id: 'cat_misc',
    name: 'Other Expenses',
    defaultLimit: 5000,
    matchCategoryIds: ['cat_misc'],
    matchNames: ['other expenses', 'miscellaneous'],
  },
];

type BudgetAlertLevel = 'exceeded' | 'full' | 'warning80' | 'ok';

function getBudgetAlertState(utilizationPct: number, threshold = 80): {
  level: BudgetAlertLevel;
  label: string;
  badgeClass: string;
  barClass: string;
} {
  if (utilizationPct > 100) {
    return {
      level: 'exceeded',
      label: 'Budget Exceeded',
      badgeClass:
        'bg-rose-100 text-rose-700 dark:bg-rose-950/90 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800',
      barClass: 'bg-rose-600',
    };
  }
  if (utilizationPct === 100) {
    return {
      level: 'full',
      label: '100% Budget Consumed',
      badgeClass:
        'bg-red-100 text-red-700 dark:bg-red-950/90 dark:text-red-300 border border-red-300/60 dark:border-red-800',
      barClass: 'bg-red-600',
    };
  }
  if (utilizationPct >= threshold) {
    return {
      level: 'warning80',
      label: '80% Budget Consumed',
      badgeClass:
        'bg-amber-100 text-amber-800 dark:bg-amber-950/90 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800',
      barClass: 'bg-amber-500',
    };
  }
  return {
    level: 'ok',
    label: 'Within Budget',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800',
    barClass: 'bg-emerald-600',
  };
}

function getPreviousMonthYYYYMM(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const BudgetsPage: React.FC<BudgetsPageProps> = ({
  budgets,
  summary,
  selectedMonth,
  onChangeSelectedMonth,
  categories,
  familyMembers,
  expenses,
  categoryBreakdown,
  familyBreakdown,
  demoMode,
  onDisableDemoMode,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'category' | 'family'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BudgetRecord | null>(null);

  // Add/Edit form state
  const [budgetType, setBudgetType] = useState<'overall' | 'category' | 'family'>('category');
  const [targetId, setTargetId] = useState<string>('cat_groceries');
  const [targetName, setTargetName] = useState<string>('Groceries');
  const [plannedAmount, setPlannedAmount] = useState<string>('12000');
  const [alertThresholdPercent, setAlertThresholdPercent] = useState<string>('80');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Copy budget state
  const [sourceCopyMonth, setSourceCopyMonth] = useState<string>(() =>
    getPreviousMonthYYYYMM(selectedMonth)
  );
  const [overwriteExistingOnCopy, setOverwriteExistingOnCopy] = useState(false);

  // Filter budgets for the currently selected month
  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.month === selectedMonth),
    [budgets, selectedMonth]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.month === selectedMonth),
    [expenses, selectedMonth]
  );

  const overallBudgetRecord = monthBudgets.find((b) => b.budgetType === 'overall');
  const categoryBudgets = monthBudgets.filter((b) => b.budgetType === 'category');
  const familyBudgets = monthBudgets.filter((b) => b.budgetType === 'family');

  // Calculate Overall Budget metrics
  const totalCategoryPlannedSum = categoryBudgets.reduce((s, b) => s + b.plannedAmount, 0);
  const overallPlanned = overallBudgetRecord?.plannedAmount ?? totalCategoryPlannedSum;
  const actualSpending = summary.totalExpenses;
  const remainingOverall = overallPlanned - actualSpending;
  const overallUtilization =
    overallPlanned > 0 ? Number(((actualSpending / overallPlanned) * 100).toFixed(1)) : 0;
  const overallAlert = getBudgetAlertState(
    overallUtilization,
    overallBudgetRecord?.alert80Enabled === false ? 100 : 80
  );

  // Compute actual spending for a category budget (supporting both direct category and Prompt 6 preset groups)
  const getCategoryActualSpent = (bgt: BudgetRecord): number => {
    const preset = PROMPT_6_CATEGORY_PRESETS.find(
      (p) =>
        p.name.toLowerCase() === bgt.targetName.toLowerCase() || p.id === bgt.targetId
    );
    if (preset) {
      return monthExpenses
        .filter(
          (e) =>
            preset.matchCategoryIds.includes(e.categoryId) ||
            preset.matchNames.includes(e.categoryName.toLowerCase()) ||
            e.categoryId === bgt.targetId ||
            e.categoryName.toLowerCase() === bgt.targetName.toLowerCase()
        )
        .reduce((sum, e) => sum + e.amount, 0);
    }

    return (
      categoryBreakdown.find(
        (c) =>
          c.categoryId === bgt.targetId ||
          c.categoryName.toLowerCase() === bgt.targetName.toLowerCase()
      )?.totalAmount ?? 0
    );
  };

  // Compute actual spending for a family member budget
  const getFamilyActualSpent = (bgt: BudgetRecord): number => {
    const fromBreakdown = familyBreakdown.find(
      (f) =>
        f.familyMemberId === bgt.targetId ||
        f.familyMemberName.toLowerCase() === bgt.targetName.toLowerCase()
    );
    if (fromBreakdown) return fromBreakdown.totalAmount;

    return monthExpenses
      .filter(
        (e) =>
          e.familyMemberId === bgt.targetId ||
          e.familyMemberName.toLowerCase() === bgt.targetName.toLowerCase() ||
          e.paidBy.toLowerCase() === bgt.targetName.toLowerCase()
      )
      .reduce((sum, e) => sum + e.amount, 0);
  };

  // Gather all active alerts (80% consumed, 100% consumed, Budget exceeded)
  const activeAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      title: string;
      typeLabel: string;
      planned: number;
      actual: number;
      pct: number;
      level: BudgetAlertLevel;
      message: string;
    }> = [];

    if (overallPlanned > 0 && overallAlert.level !== 'ok') {
      alerts.push({
        id: 'overall',
        title: 'Overall Monthly Budget',
        typeLabel: 'Overall',
        planned: overallPlanned,
        actual: actualSpending,
        pct: overallUtilization,
        level: overallAlert.level,
        message: overallAlert.label,
      });
    }

    for (const bgt of categoryBudgets) {
      const spent = getCategoryActualSpent(bgt);
      const pct =
        bgt.plannedAmount > 0 ? Number(((spent / bgt.plannedAmount) * 100).toFixed(1)) : 0;
      const st = getBudgetAlertState(pct, bgt.alert80Enabled === false ? 100 : 80);
      if (st.level !== 'ok') {
        alerts.push({
          id: bgt.id,
          title: bgt.targetName,
          typeLabel: 'Category',
          planned: bgt.plannedAmount,
          actual: spent,
          pct,
          level: st.level,
          message: st.label,
        });
      }
    }

    for (const bgt of familyBudgets) {
      const spent = getFamilyActualSpent(bgt);
      const pct =
        bgt.plannedAmount > 0 ? Number(((spent / bgt.plannedAmount) * 100).toFixed(1)) : 0;
      const st = getBudgetAlertState(pct, bgt.alert80Enabled === false ? 100 : 80);
      if (st.level !== 'ok') {
        alerts.push({
          id: bgt.id,
          title: bgt.targetName,
          typeLabel: 'Family',
          planned: bgt.plannedAmount,
          actual: spent,
          pct,
          level: st.level,
          message: st.label,
        });
      }
    }

    return alerts.sort((a, b) => b.pct - a.pct);
  }, [
    overallPlanned,
    overallAlert,
    actualSpending,
    overallUtilization,
    categoryBudgets,
    familyBudgets,
    monthExpenses,
    categoryBreakdown,
    familyBreakdown,
  ]);

  // Distinct months that have saved budgets (for copying)
  const availableBudgetMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(getPreviousMonthYYYYMM(selectedMonth));
    budgets.forEach((b) => {
      if (b.month !== selectedMonth) set.add(b.month);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [budgets, selectedMonth]);

  const openBudgetModal = (
    type: 'overall' | 'category' | 'family',
    presetTargetId?: string,
    presetTargetName?: string,
    presetAmount?: number,
    existingRecord?: BudgetRecord
  ) => {
    setFormError(null);
    setBudgetType(type);

    if (existingRecord) {
      setTargetId(existingRecord.targetId);
      setTargetName(existingRecord.targetName);
      setPlannedAmount(String(existingRecord.plannedAmount));
      setAlertThresholdPercent(existingRecord.alert80Enabled === false ? '100' : '80');
    } else if (type === 'overall') {
      setTargetId('overall');
      setTargetName('Overall Monthly Expense Budget');
      setPlannedAmount(String(overallBudgetRecord?.plannedAmount || 75000));
      setAlertThresholdPercent(overallBudgetRecord?.alert80Enabled === false ? '100' : '80');
    } else if (type === 'category') {
      const tId = presetTargetId ?? PROMPT_6_CATEGORY_PRESETS[0].id;
      const tName = presetTargetName ?? PROMPT_6_CATEGORY_PRESETS[0].name;
      const existing = categoryBudgets.find(
        (b) => b.targetId === tId || b.targetName.toLowerCase() === tName.toLowerCase()
      );
      setTargetId(existing?.targetId ?? tId);
      setTargetName(existing?.targetName ?? tName);
      setPlannedAmount(
        String(existing?.plannedAmount ?? presetAmount ?? PROMPT_6_CATEGORY_PRESETS[0].defaultLimit)
      );
      setAlertThresholdPercent(existing?.alert80Enabled === false ? '100' : '80');
    } else {
      const firstFam = familyMembers[0];
      const tId = presetTargetId ?? firstFam?.id ?? 'fam_self';
      const tName = presetTargetName ?? firstFam?.name ?? 'Self';
      const existing = familyBudgets.find(
        (b) => b.targetId === tId || b.targetName.toLowerCase() === tName.toLowerCase()
      );
      setTargetId(existing?.targetId ?? tId);
      setTargetName(existing?.targetName ?? tName);
      setPlannedAmount(String(existing?.plannedAmount ?? presetAmount ?? 20000));
      setAlertThresholdPercent(existing?.alert80Enabled === false ? '100' : '80');
    }

    setModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (demoMode) {
      onDisableDemoMode();
    }

    const amountNum = Number(plannedAmount);
    const thresholdNum = Number(alertThresholdPercent) || 80;

    setIsSubmitting(true);
    try {
      await databaseService.upsertBudget({
        month: selectedMonth,
        budgetType,
        targetId: budgetType === 'overall' ? 'overall' : targetId,
        targetName:
          budgetType === 'overall' ? 'Overall Monthly Expense Budget' : targetName,
        plannedAmount: amountNum,
        alert80Enabled: thresholdNum <= 80,
        alert100Enabled: true,
      });
      setModalOpen(false);
      setFeedbackMsg(
        `Saved ${
          budgetType === 'overall' ? 'Overall Monthly Budget' : targetName
        } (${formatINR(amountNum)}) for ${formatMonthLabel(selectedMonth)}.`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save budget.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickCopyPreviousMonth = async () => {
    setFormError(null);
    if (demoMode) {
      onDisableDemoMode();
    }
    try {
      const copiedCount = await databaseService.copyBudgetsFromMonth(
        sourceCopyMonth,
        selectedMonth
      );
      setCopyModalOpen(false);
      setFeedbackMsg(
        `Copied ${copiedCount} budget(s) from ${formatMonthLabel(
          sourceCopyMonth
        )} to ${formatMonthLabel(selectedMonth)}.`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not copy budgets.');
    }
  };

  const handleSeedRecommendedBudgets = async () => {
    if (demoMode) {
      onDisableDemoMode();
    }
    setIsSubmitting(true);
    try {
      await databaseService.upsertBudget({
        month: selectedMonth,
        budgetType: 'overall',
        targetId: 'overall',
        targetName: 'Overall Monthly Expense Budget',
        plannedAmount: 84000,
        alert80Enabled: true,
        alert100Enabled: true,
      });
      for (const preset of PROMPT_6_CATEGORY_PRESETS) {
        await databaseService.upsertBudget({
          month: selectedMonth,
          budgetType: 'category',
          targetId: preset.id,
          targetName: preset.name,
          plannedAmount: preset.defaultLimit,
          alert80Enabled: true,
          alert100Enabled: true,
        });
      }
      setFeedbackMsg(
        `Initialized Overall Budget and all 9 standard category budgets for ${formatMonthLabel(
          selectedMonth
        )}.`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to seed budgets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await databaseService.deleteBudget(deleteTarget.id);
      setFeedbackMsg(`Deleted budget "${deleteTarget.targetName}".`);
      setDeleteTarget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete budget.');
    }
  };

  // Combined list of category options (Prompt 6 presets + custom user categories)
  const categorySelectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const p of PROMPT_6_CATEGORY_PRESETS) {
      map.set(p.name.toLowerCase(), { id: p.id, name: p.name });
    }
    for (const c of categories.filter((cat) => cat.type === 'expense')) {
      if (!map.has(c.name.toLowerCase())) {
        map.set(c.name.toLowerCase(), { id: c.id, name: c.name });
      }
    }
    return Array.from(map.values());
  }, [categories]);

  return (
    <div className="space-y-5">
      {/* Header & Month Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            Monthly Budget Planner ({formatMonthLabel(selectedMonth)})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track Overall, Category-wise & Family-wise budgets with 80%, 100%, and Exceeded alerts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            aria-label="Select Budget Month"
            value={selectedMonth}
            onChange={(e) => {
              if (e.target.value) {
                onChangeSelectedMonth(e.target.value);
                setSourceCopyMonth(getPreviousMonthYYYYMM(e.target.value));
              }
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
          />

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setSourceCopyMonth(getPreviousMonthYYYYMM(selectedMonth));
              setCopyModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5 text-indigo-600" />
            <span>Copy Month</span>
          </button>

          <button
            type="button"
            onClick={() => openBudgetModal('category')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Set Budget</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-200">
          <span>{feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="ml-2 text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Active Threshold Alerts Banner (80% consumed, 100% consumed, Budget exceeded) */}
      {activeAlerts.length > 0 && (
        <section className="rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-200">
            <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0" />
            <span>
              Budget Utilization Alerts ({activeAlerts.length} threshold{activeAlerts.length > 1 ? 's' : ''} triggered in{' '}
              {formatMonthLabel(selectedMonth)})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeAlerts.map((al) => (
              <div
                key={al.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white/90 dark:bg-slate-900/90 p-2.5 border border-slate-200/70 dark:border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">
                    {al.title}{' '}
                    <span className="text-[10px] font-normal text-slate-400">({al.typeLabel})</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatINR(al.actual)} of {formatINR(al.planned)} ({al.pct}%)
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    al.level === 'exceeded'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : al.level === 'full'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {al.message}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Overall Monthly Expense Budget Card */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Overall Monthly Expense Budget
                </h2>
                {!overallBudgetRecord && totalCategoryPlannedSum > 0 && (
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                    Auto-summed from categories
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Utilization: <strong>{overallUtilization}%</strong> • Alerts: 80% &amp; 100%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {overallPlanned > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${overallAlert.badgeClass}`}
              >
                {overallAlert.level === 'ok' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {overallAlert.label}
              </span>
            )}

            <button
              type="button"
              onClick={() =>
                openBudgetModal(
                  'overall',
                  'overall',
                  'Overall Monthly Expense Budget',
                  overallPlanned || 75000,
                  overallBudgetRecord
                )
              }
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{overallBudgetRecord ? 'Edit Limit' : 'Set Overall Limit'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${overallAlert.barClass}`}
            style={{ width: `${Math.min(100, overallUtilization)}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] text-slate-400">Planned Budget</span>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {formatINR(overallPlanned)}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400">Actual Spending</span>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
              {formatINR(actualSpending)}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400">Remaining Budget</span>
            <p
              className={`text-sm font-bold ${
                remainingOverall >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatINR(remainingOverall)}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400">Utilization %</span>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {overallUtilization}%
            </p>
          </div>
        </div>
      </div>

      {/* Prompt 6 Core Category Presets Strip */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Essential Household Categories (1-Tap Set / Edit Budget)
            </h3>
            <p className="text-[11px] text-slate-400">
              Rent, Groceries, School Fees, Electricity, Transportation, Medical, Shopping, Entertainment & Other Expenses
            </p>
          </div>
          {categoryBudgets.length === 0 && !demoMode && (
            <button
              type="button"
              onClick={handleSeedRecommendedBudgets}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Auto-Fill All 9 Category Budgets</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {PROMPT_6_CATEGORY_PRESETS.map((preset) => {
            const existing = categoryBudgets.find(
              (b) =>
                b.targetId === preset.id ||
                b.targetName.toLowerCase() === preset.name.toLowerCase()
            );
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  openBudgetModal(
                    'category',
                    preset.id,
                    preset.name,
                    preset.defaultLimit,
                    existing
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer border ${
                  existing
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                }`}
              >
                <Tag className="h-3 w-3" />
                <span>{preset.name}</span>
                {existing ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ({formatINR(existing.plannedAmount)})
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">+ Set</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter Tabs: All / Category-wise / Family-wise */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Budgets ({categoryBudgets.length + familyBudgets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('category')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'category'
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Category-wise ({categoryBudgets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('family')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'family'
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Family-wise ({familyBudgets.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            openBudgetModal(activeTab === 'family' ? 'family' : 'category')
          }
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add {activeTab === 'family' ? 'Family' : 'Category'} Budget</span>
        </button>
      </div>

      {/* Category-wise Budgets Section */}
      {(activeTab === 'all' || activeTab === 'category') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Tag className="h-4 w-4 text-emerald-600" />
              <span>Category-wise Budgets ({categoryBudgets.length})</span>
            </h2>
          </div>

          {categoryBudgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-6 text-center">
              <p className="text-xs text-slate-500">
                No category budgets configured for {formatMonthLabel(selectedMonth)}.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={handleSeedRecommendedBudgets}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Initialize 9 Default Category Budgets
                </button>
                <button
                  type="button"
                  onClick={() => setCopyModalOpen(true)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Copy from Previous Month
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categoryBudgets.map((bgt) => {
                const spent = getCategoryActualSpent(bgt);
                const pct =
                  bgt.plannedAmount > 0
                    ? Number(((spent / bgt.plannedAmount) * 100).toFixed(1))
                    : 0;
                const remaining = bgt.plannedAmount - spent;
                const alert = getBudgetAlertState(
                  pct,
                  bgt.alert80Enabled === false ? 100 : 80
                );

                return (
                  <div
                    key={bgt.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                          {bgt.targetName}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Utilization: <strong className="text-slate-700 dark:text-slate-200">{pct}%</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${alert.badgeClass}`}
                        >
                          {alert.label}
                        </span>
                        <button
                          type="button"
                          title="Edit Budget"
                          onClick={() =>
                            openBudgetModal(
                              'category',
                              bgt.targetId,
                              bgt.targetName,
                              bgt.plannedAmount,
                              bgt
                            )
                          }
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete Budget"
                          onClick={() => setDeleteTarget(bgt)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${alert.barClass}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Planned</span>
                        <strong className="text-slate-900 dark:text-white">
                          {formatINR(bgt.plannedAmount)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Actual Spent</span>
                        <strong className="text-rose-600 dark:text-rose-400">
                          {formatINR(spent)}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Remaining</span>
                        <strong
                          className={
                            remaining >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {formatINR(remaining)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Family-wise Budgets Section */}
      {(activeTab === 'all' || activeTab === 'family') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span>Family-wise Budgets ({familyBudgets.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => openBudgetModal('family')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              + Set Family Member Budget
            </button>
          </div>

          {familyBudgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-5 text-center">
              <p className="text-xs text-slate-500">
                Set family member budgets (Self, Spouse, Children, Parents, Entire Family) to monitor member-wise spending limits.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {familyMembers.map((fam) => (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => openBudgetModal('family', fam.id, fam.name, 20000)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 cursor-pointer"
                  >
                    + {fam.name} ({fam.relationship})
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {familyBudgets.map((bgt) => {
                const spent = getFamilyActualSpent(bgt);
                const pct =
                  bgt.plannedAmount > 0
                    ? Number(((spent / bgt.plannedAmount) * 100).toFixed(1))
                    : 0;
                const remaining = bgt.plannedAmount - spent;
                const alert = getBudgetAlertState(
                  pct,
                  bgt.alert80Enabled === false ? 100 : 80
                );

                return (
                  <div
                    key={bgt.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                          {bgt.targetName}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Family Member Budget • <strong>{pct}%</strong> utilized
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${alert.badgeClass}`}
                        >
                          {alert.label}
                        </span>
                        <button
                          type="button"
                          title="Edit Family Budget"
                          onClick={() =>
                            openBudgetModal(
                              'family',
                              bgt.targetId,
                              bgt.targetName,
                              bgt.plannedAmount,
                              bgt
                            )
                          }
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete Family Budget"
                          onClick={() => setDeleteTarget(bgt)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${alert.barClass}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Planned</span>
                        <strong className="text-slate-900 dark:text-white">
                          {formatINR(bgt.plannedAmount)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Actual Spent</span>
                        <strong className="text-rose-600 dark:text-rose-400">
                          {formatINR(spent)}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Remaining</span>
                        <strong
                          className={
                            remaining >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {formatINR(remaining)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Add / Edit Budget Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Configure Monthly Budget ({formatMonthLabel(selectedMonth)})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Set overall, category-wise, or family-wise spending limits
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="mt-4 space-y-3.5">
              {formError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Budget Scope
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['overall', 'category', 'family'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setBudgetType(t);
                        if (t === 'overall') {
                          setTargetId('overall');
                          setTargetName('Overall Monthly Expense Budget');
                        } else if (t === 'category') {
                          setTargetId(categorySelectOptions[0]?.id ?? 'cat_groceries');
                          setTargetName(categorySelectOptions[0]?.name ?? 'Groceries');
                        } else {
                          setTargetId(familyMembers[0]?.id ?? 'fam_self');
                          setTargetName(familyMembers[0]?.name ?? 'Self');
                        }
                      }}
                      className={`rounded-xl py-2 text-xs font-bold capitalize border cursor-pointer ${
                        budgetType === t
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {budgetType === 'category' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Category
                  </label>
                  <select
                    value={targetName}
                    onChange={(e) => {
                      const opt = categorySelectOptions.find(
                        (o) => o.name === e.target.value
                      );
                      if (opt) {
                        setTargetId(opt.id);
                        setTargetName(opt.name);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  >
                    {categorySelectOptions.map((opt) => (
                      <option key={opt.id} value={opt.name}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {budgetType === 'family' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Family Member
                  </label>
                  <select
                    value={targetName}
                    onChange={(e) => {
                      const fam = familyMembers.find((f) => f.name === e.target.value);
                      if (fam) {
                        setTargetId(fam.id);
                        setTargetName(fam.name);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  >
                    {familyMembers.map((fam) => (
                      <option key={fam.id} value={fam.name}>
                        {fam.name} ({fam.relationship})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Planned Budget (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={plannedAmount}
                    onChange={(e) => setPlannedAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Warning Alert (%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    required
                    value={alertThresholdPercent}
                    onChange={(e) => setAlertThresholdPercent(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Budgets From Another Month Modal */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Copy Budgets to {formatMonthLabel(selectedMonth)}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Carry forward Overall, Category-wise & Family-wise budgets from another month
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-600 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source Month to Copy From
              </label>
              <input
                type="month"
                value={sourceCopyMonth}
                onChange={(e) => setSourceCopyMonth(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              />
              {availableBudgetMonths.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {availableBudgetMonths.slice(0, 4).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSourceCopyMonth(m)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                        sourceCopyMonth === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {formatMonthLabel(m)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteExistingOnCopy}
                onChange={(e) => setOverwriteExistingOnCopy(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Overwrite existing budgets in {formatMonthLabel(selectedMonth)}</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickCopyPreviousMonth}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Budgets Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Delete Budget Limit?
            </h3>
            <p className="text-xs text-slate-500">
              Remove <strong>{deleteTarget.targetName}</strong> ({formatINR(deleteTarget.plannedAmount)}) from{' '}
              {formatMonthLabel(deleteTarget.month)}? Your actual expense records will not be affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Delete Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
