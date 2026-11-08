import React, { useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  AlertCircle,
  TrendingUp,
  Briefcase,
  Sparkles,
  Search,
  Filter,
  CalendarClock,
  X,
  BarChart3,
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
  IncomeRecord,
  IncomeStatus,
  IncomeType,
  MonthlyFinancialSummary,
} from '../types';
import { databaseService } from '../services/databaseService';
import {
  formatDateDDMMMYYYY,
  formatINR,
  formatMonthLabel,
  getCurrentMonthYYYYMM,
  getIndianFinancialYear,
  getTodayISO,
} from '../utilities/formatters';

interface IncomePageProps {
  incomeRecords: IncomeRecord[];
  accounts: AccountRecord[];
  summary: MonthlyFinancialSummary;
  selectedMonth: string;
  onChangeSelectedMonth: (month: string) => void;
  expectedSalaryCreditDay: number;
  demoMode: boolean;
  onDisableDemoMode: () => Promise<void>;
}

const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary: 'Monthly Salary',
  bonus: 'Bonus / Incentive',
  interest: 'Bank / FD Interest',
  freelance: 'Freelance Income',
  other: 'Other Income',
};

const INCOME_TYPE_BADGE_STYLES: Record<IncomeType, string> = {
  salary:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  bonus:
    'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  interest:
    'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  freelance:
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  other:
    'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

export const IncomePage: React.FC<IncomePageProps> = ({
  incomeRecords,
  accounts,
  summary,
  selectedMonth,
  onChangeSelectedMonth,
  expectedSalaryCreditDay,
  demoMode,
  onDisableDemoMode,
}) => {
  // Active sub-tab on the Income Page
  const [activeView, setActiveView] = useState<'records' | 'salary_history' | 'yearly_summary'>(
    'records'
  );

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | IncomeType>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | IncomeStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Yearly summary mode: Indian FY (Apr-Mar) vs Calendar Year (Jan-Dec)
  const [yearMode, setYearMode] = useState<'FY' | 'CALENDAR'>('FY');
  const currentYearNum = Number(selectedMonth.split('-')[0]) || 2026;
  const currentMonthNum = Number(selectedMonth.split('-')[1]) || 11;
  const defaultFyStartYear = currentMonthNum >= 4 ? currentYearNum : currentYearNum - 1;
  const [selectedYearStart, setSelectedYearStart] = useState<number>(defaultFyStartYear);

  // Expected salary credit day editor
  const [editingExpectedDay, setEditingExpectedDay] = useState(false);
  const [expectedDayInput, setExpectedDayInput] = useState<string>(
    String(expectedSalaryCreditDay || 1)
  );

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncomeRecord | null>(null);
  const [formType, setFormType] = useState<IncomeType>('salary');
  const [formSalaryMonth, setFormSalaryMonth] = useState<string>(selectedMonth);
  const [formStatus, setFormStatus] = useState<IncomeStatus>('credited');
  const [formTransactionDate, setFormTransactionDate] = useState<string>(getTodayISO());
  const [formExpectedDate, setFormExpectedDate] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formEmployer, setFormEmployer] = useState<string>('');
  const [formAccountId, setFormAccountId] = useState<string>(
    accounts[0]?.id ?? 'acc_salary_bank'
  );
  const [formDescription, setFormDescription] = useState<string>('');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [recordToDelete, setRecordToDelete] = useState<IncomeRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Feedback banner
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => {
      setBannerMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Distinct employers from history for quick auto-fill
  const knownEmployers = useMemo(() => {
    const set = new Set<string>();
    incomeRecords.forEach((r) => {
      if (r.employer?.trim()) set.add(r.employer.trim());
    });
    return Array.from(set);
  }, [incomeRecords]);

  // Distinct months available in records + recent 6 months
  const availableMonths = useMemo(() => {
    const set = new Set<string>([getCurrentMonthYYYYMM(), selectedMonth]);
    incomeRecords.forEach((r) => set.add(r.salaryMonth));
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [incomeRecords, selectedMonth]);

  // Check selected month's salary status
  const selectedMonthSalaries = useMemo(
    () =>
      incomeRecords.filter(
        (r) => r.salaryMonth === selectedMonth && r.type === 'salary'
      ),
    [incomeRecords, selectedMonth]
  );

  const hasCreditedSalaryThisMonth = selectedMonthSalaries.some(
    (r) => r.status === 'credited'
  );
  const pendingSalaryRecordThisMonth = selectedMonthSalaries.find(
    (r) => r.status === 'pending'
  );

  const expectedDateForSelectedMonth = `${selectedMonth}-${String(
    expectedSalaryCreditDay || 1
  ).padStart(2, '0')}`;

  // Additional income breakdown for selected month (credited only)
  const selectedMonthAdditionalBreakdown = useMemo(() => {
    const monthRecs = incomeRecords.filter(
      (r) =>
        r.salaryMonth === selectedMonth &&
        r.type !== 'salary' &&
        r.status === 'credited'
    );
    return {
      bonus: monthRecs
        .filter((r) => r.type === 'bonus')
        .reduce((s, r) => s + r.amount, 0),
      interest: monthRecs
        .filter((r) => r.type === 'interest')
        .reduce((s, r) => s + r.amount, 0),
      freelance: monthRecs
        .filter((r) => r.type === 'freelance')
        .reduce((s, r) => s + r.amount, 0),
      other: monthRecs
        .filter((r) => r.type === 'other')
        .reduce((s, r) => s + r.amount, 0),
    };
  }, [incomeRecords, selectedMonth]);

  // Yearly Income Summary calculation (12 months of selected FY or Calendar Year)
  const yearlyAnalysis = useMemo(() => {
    const monthsList: string[] = [];
    if (yearMode === 'FY') {
      // April of selectedYearStart to March of selectedYearStart + 1
      for (let m = 4; m <= 12; m++) {
        monthsList.push(`${selectedYearStart}-${String(m).padStart(2, '0')}`);
      }
      for (let m = 1; m <= 3; m++) {
        monthsList.push(`${selectedYearStart + 1}-${String(m).padStart(2, '0')}`);
      }
    } else {
      for (let m = 1; m <= 12; m++) {
        monthsList.push(`${selectedYearStart}-${String(m).padStart(2, '0')}`);
      }
    }

    const monthlyRows = monthsList.map((ym) => {
      const recs = incomeRecords.filter(
        (r) => r.salaryMonth === ym && r.status === 'credited'
      );
      const pendingRecs = incomeRecords.filter(
        (r) => r.salaryMonth === ym && r.status === 'pending'
      );

      const salary = recs
        .filter((r) => r.type === 'salary')
        .reduce((s, r) => s + r.amount, 0);
      const bonus = recs
        .filter((r) => r.type === 'bonus')
        .reduce((s, r) => s + r.amount, 0);
      const freelance = recs
        .filter((r) => r.type === 'freelance')
        .reduce((s, r) => s + r.amount, 0);
      const interest = recs
        .filter((r) => r.type === 'interest')
        .reduce((s, r) => s + r.amount, 0);
      const other = recs
        .filter((r) => r.type === 'other')
        .reduce((s, r) => s + r.amount, 0);
      const additional = bonus + freelance + interest + other;
      const total = salary + additional;
      const pending = pendingRecs.reduce((s, r) => s + r.amount, 0);

      return {
        month: ym,
        shortLabel: formatMonthLabel(ym).split(' ')[0],
        fullLabel: formatMonthLabel(ym),
        salary,
        additional,
        bonus,
        freelance,
        interest,
        other,
        total,
        pending,
      };
    });

    const totalYearlySalary = monthlyRows.reduce((s, r) => s + r.salary, 0);
    const totalYearlyAdditional = monthlyRows.reduce((s, r) => s + r.additional, 0);
    const totalYearlyIncome = totalYearlySalary + totalYearlyAdditional;
    const totalYearlyPending = monthlyRows.reduce((s, r) => s + r.pending, 0);
    const monthsWithSalaryCount = monthlyRows.filter((r) => r.salary > 0).length;

    return {
      label:
        yearMode === 'FY'
          ? `FY ${selectedYearStart}-${String((selectedYearStart + 1) % 100).padStart(2, '0')}`
          : `Calendar Year ${selectedYearStart}`,
      monthlyRows,
      totalYearlySalary,
      totalYearlyAdditional,
      totalYearlyIncome,
      totalYearlyPending,
      monthsWithSalaryCount,
    };
  }, [incomeRecords, yearMode, selectedYearStart]);

  // Filtered records for the main list
  const filteredRecords = useMemo(() => {
    return incomeRecords
      .filter((r) => {
        const matchMonth = filterMonth === 'ALL' || r.salaryMonth === filterMonth;
        const matchType = filterType === 'ALL' || r.type === filterType;
        const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
        const q = searchQuery.trim().toLowerCase();
        const matchSearch =
          !q ||
          r.employer.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.remarks && r.remarks.toLowerCase().includes(q)) ||
          r.bankAccountName.toLowerCase().includes(q) ||
          r.salaryMonth.includes(q);
        return matchMonth && matchType && matchStatus && matchSearch;
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [incomeRecords, filterMonth, filterType, filterStatus, searchQuery]);

  // Dedicated Salary Credit History list
  const salaryHistoryRecords = useMemo(() => {
    return incomeRecords
      .filter((r) => r.type === 'salary')
      .sort((a, b) => b.salaryMonth.localeCompare(a.salaryMonth));
  }, [incomeRecords]);

  // Open Modal for Add Salary or Add Additional Income
  const openAddModal = (presetType: IncomeType = 'salary', presetStatus: IncomeStatus = 'credited') => {
    setEditingRecord(null);
    setFormType(presetType);
    setFormSalaryMonth(selectedMonth);
    setFormStatus(presetStatus);
    const defaultDate =
      presetStatus === 'pending' ? expectedDateForSelectedMonth : getTodayISO();
    setFormTransactionDate(defaultDate);
    setFormExpectedDate(expectedDateForSelectedMonth);
    setFormAmount('');
    setFormEmployer(knownEmployers[0] ?? '');
    setFormAccountId(accounts[0]?.id ?? 'acc_salary_bank');
    setFormDescription(
      presetType === 'salary'
        ? `${formatMonthLabel(selectedMonth)} Monthly Salary`
        : ''
    );
    setFormRemarks('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Modal for Editing an existing record
  const openEditModal = (rec: IncomeRecord) => {
    setEditingRecord(rec);
    setFormType(rec.type);
    setFormSalaryMonth(rec.salaryMonth);
    setFormStatus(rec.status);
    setFormTransactionDate(rec.transactionDate);
    setFormExpectedDate(rec.expectedCreditDate ?? expectedDateForSelectedMonth);
    setFormAmount(String(rec.amount));
    setFormEmployer(rec.employer);
    setFormAccountId(rec.accountId);
    setFormDescription(rec.description);
    setFormRemarks(rec.remarks ?? '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numericAmount = Number(formAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid amount greater than ₹0.');
      return;
    }
    if (!formEmployer.trim()) {
      setFormError(
        formType === 'salary'
          ? 'Employer name is required for salary entries.'
          : 'Income source / payer is required.'
      );
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(formSalaryMonth)) {
      setFormError('Please select a valid Salary / Income Month (YYYY-MM).');
      return;
    }

    const chosenAccount =
      accounts.find((a) => a.id === formAccountId) ?? accounts[0];

    setFormSubmitting(true);
    try {
      // Never mix demo records with real user records
      if (demoMode) {
        await onDisableDemoMode();
      }

      const payload = {
        type: formType,
        salaryMonth: formSalaryMonth,
        transactionDate: formTransactionDate,
        expectedCreditDate: formExpectedDate || undefined,
        status: formStatus,
        amount: numericAmount,
        employer: formEmployer.trim(),
        accountId: chosenAccount?.id ?? 'acc_salary_bank',
        bankAccountName: chosenAccount?.name ?? 'Primary Salary Bank Account',
        description:
          formDescription.trim() ||
          `${formatMonthLabel(formSalaryMonth)} ${INCOME_TYPE_LABELS[formType]}`,
        remarks: formRemarks.trim() || undefined,
      };

      if (editingRecord && !editingRecord.id.startsWith('demo_')) {
        await databaseService.updateIncome(editingRecord.id, payload);
        showFeedback(
          `Updated ${INCOME_TYPE_LABELS[formType]} (${formatINR(numericAmount)}) in IndexedDB.`
        );
      } else {
        await databaseService.addIncome(payload);
        showFeedback(
          formStatus === 'credited'
            ? `Credited ${INCOME_TYPE_LABELS[formType]} of ${formatINR(numericAmount)} saved to IndexedDB!`
            : `Pending salary of ${formatINR(numericAmount)} logged (excluded from actual income until credited).`
        );
      }

      // Sync dashboard month to the entry's month so user sees it immediately
      onChangeSelectedMonth(formSalaryMonth);
      setIsFormOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleMarkAsCredited = async (rec: IncomeRecord) => {
    try {
      if (demoMode || rec.id.startsWith('demo_')) {
        await onDisableDemoMode();
        return;
      }
      await databaseService.markSalaryAsCredited(rec.id, getTodayISO());
      showFeedback(
        `Marked ${formatMonthLabel(rec.salaryMonth)} salary (${formatINR(rec.amount)}) as Credited!`
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleteSubmitting(true);
    try {
      if (demoMode || recordToDelete.id.startsWith('demo_')) {
        await onDisableDemoMode();
        setRecordToDelete(null);
        return;
      }
      await databaseService.deleteIncome(recordToDelete.id);
      showFeedback(
        `Deleted ${recordToDelete.description} (${formatINR(recordToDelete.amount)}) from IndexedDB.`
      );
      setRecordToDelete(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleSaveExpectedDay = async () => {
    const day = Number(expectedDayInput);
    if (!Number.isFinite(day) || day < 1 || day > 31) return;
    await databaseService.updateExpectedSalaryDay(day);
    setEditingExpectedDay(false);
    showFeedback(`Expected monthly salary credit date updated to Day ${day} of each month.`);
  };

  return (
    <div className="space-y-5">
      {/* Feedback Toast Banner */}
      {bannerMessage && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/70 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-emerald-600 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            Salary & Income Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Record monthly salary when credited, track additional income & monitor yearly earnings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active Month Picker synced with Dashboard */}
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
            onClick={() => openAddModal('salary', 'credited')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Salary</span>
          </button>

          <button
            type="button"
            onClick={() => openAddModal('bonus', 'credited')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>+ Other Income</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards: Credited Salary, Additional Income, Total Monthly Income, Yearly Income */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Monthly Salary Credited */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Salary ({formatMonthLabel(selectedMonth)})
            </span>
            <Briefcase className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatINR(summary.salaryCredited)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            {hasCreditedSalaryThisMonth ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Salary Credited
              </span>
            ) : pendingSalaryRecordThisMonth ? (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" /> Pending ({formatINR(pendingSalaryRecordThisMonth.amount)})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Clock className="h-3 w-3" /> Not yet credited
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Monthly Additional Income */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Additional Income</span>
            <Sparkles className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-1.5 text-lg font-bold text-sky-600 dark:text-sky-400">
            {formatINR(summary.additionalIncome)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            Bonus {formatINR(selectedMonthAdditionalBreakdown.bonus)} • Freelance{' '}
            {formatINR(selectedMonthAdditionalBreakdown.freelance)} • Interest{' '}
            {formatINR(selectedMonthAdditionalBreakdown.interest)}
          </p>
        </div>

        {/* Card 3: Total Actual Monthly Income */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Actual Monthly Income
            </span>
            <Wallet className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
            {formatINR(summary.totalIncome)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {summary.pendingSalary > 0
              ? `Excludes ${formatINR(summary.pendingSalary)} pending salary`
              : 'Salary + Additional (Credited only)'}
          </p>
        </div>

        {/* Card 4: Yearly Income Summary */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {yearlyAnalysis.label} Total
            </span>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-1.5 text-lg font-bold text-purple-600 dark:text-purple-400">
            {formatINR(yearlyAnalysis.totalYearlyIncome)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {yearlyAnalysis.monthsWithSalaryCount} salary months credited in year
          </p>
        </div>
      </div>

      {/* Expected Salary Credit Date & Pending Status Banner */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                  Expected Salary Credit Schedule • {formatMonthLabel(selectedMonth)}
                </h2>
                {hasCreditedSalaryThisMonth ? (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    Credited for {formatMonthLabel(selectedMonth)}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    Pending Credit for {formatMonthLabel(selectedMonth)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Expected Credit Date:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatDateDDMMMYYYY(expectedDateForSelectedMonth)}
                </strong>{' '}
                (Day {expectedSalaryCreditDay} of month). Expected/pending salary is never counted in
                Actual Income until marked as Credited.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editingExpectedDay ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={expectedDayInput}
                  onChange={(e) => setExpectedDayInput(e.target.value)}
                  className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={handleSaveExpectedDay}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                >
                  Save Day
                </button>
                <button
                  type="button"
                  onClick={() => setEditingExpectedDay(false)}
                  className="rounded-lg px-2 py-1 text-xs text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setExpectedDayInput(String(expectedSalaryCreditDay || 1));
                  setEditingExpectedDay(true);
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-500/50 cursor-pointer"
              >
                Change Credit Day ({expectedSalaryCreditDay})
              </button>
            )}

            {!hasCreditedSalaryThisMonth && !pendingSalaryRecordThisMonth && (
              <button
                type="button"
                onClick={() => openAddModal('salary', 'pending')}
                className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 cursor-pointer"
              >
                Log Pending Salary
              </button>
            )}

            {pendingSalaryRecordThisMonth && (
              <button
                type="button"
                onClick={() => handleMarkAsCredited(pendingSalaryRecordThisMonth)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                Mark {formatMonthLabel(selectedMonth)} Salary Credited
              </button>
            )}
          </div>
        </div>
      </section>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'records', label: `All Income Records (${incomeRecords.length})`, icon: Wallet },
          {
            id: 'salary_history',
            label: `Salary Credit History (${salaryHistoryRecords.length})`,
            icon: Briefcase,
          },
          { id: 'yearly_summary', label: 'Yearly & Monthly Summary', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id as typeof activeView)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
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

      {/* VIEW 1: ALL INCOME RECORDS (With Search & Filters) */}
      {activeView === 'records' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employer, description, remarks, or bank..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-xs"
                />
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full bg-transparent font-medium focus:outline-none"
                >
                  <option value="ALL">All Salary Months</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)} ({m})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  className="w-full bg-transparent font-medium focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="credited">Credited Only (Actual)</option>
                  <option value="pending">Pending / Expected Only</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'All Income Types' },
                  { id: 'salary', label: 'Salary' },
                  { id: 'bonus', label: 'Bonus' },
                  { id: 'freelance', label: 'Freelance' },
                  { id: 'interest', label: 'Interest' },
                  { id: 'other', label: 'Other Income' },
                ] as { id: 'ALL' | IncomeType; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilterType(item.id)}
                  className={`rounded-xl px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    filterType === item.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Income & Salary Entries ({filteredRecords.length})
              </h2>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Credited Total:{' '}
                {formatINR(
                  filteredRecords
                    .filter((r) => r.status === 'credited')
                    .reduce((s, r) => s + r.amount, 0)
                )}
              </span>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No income records match the selected filters. Click <strong>+ Add Salary</strong> or{' '}
                <strong>+ Other Income</strong> to create an entry.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition hover:border-emerald-500/30"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                            {rec.description}
                          </h3>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                              INCOME_TYPE_BADGE_STYLES[rec.type]
                            }`}
                          >
                            {INCOME_TYPE_LABELS[rec.type]}
                          </span>
                          {rec.status === 'credited' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Credited
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              <Clock className="h-3 w-3" /> Pending (Excluded from Actual)
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" /> {rec.employer}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {rec.status === 'credited' ? 'Credited:' : 'Expected:'}{' '}
                            {formatDateDDMMMYYYY(rec.transactionDate)}
                          </span>
                          <span>Month: {formatMonthLabel(rec.salaryMonth)}</span>
                          <span>Bank: {rec.bankAccountName}</span>
                        </div>

                        {rec.remarks && (
                          <p className="mt-1 text-[11px] italic text-slate-500 dark:text-slate-400">
                            Remarks: {rec.remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800 pt-2.5 sm:pt-0">
                      <p
                        className={`text-sm font-bold sm:text-base ${
                          rec.status === 'credited'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {rec.status === 'credited' ? '+' : ''}
                        {formatINR(rec.amount)}
                      </p>

                      <div className="flex items-center gap-1.5">
                        {rec.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsCredited(rec)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            Mark Credited
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(rec)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
                          title="Edit record"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecordToDelete(rec)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* VIEW 2: DEDICATED SALARY CREDIT HISTORY */}
      {activeView === 'salary_history' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Salary Credit History ({salaryHistoryRecords.length})
              </h2>
              <p className="text-xs text-slate-500">
                Chronological audit log of salary months, actual credit dates, employers & bank accounts
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddModal('salary', 'credited')}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
            >
              + Record Past / Current Salary
            </button>
          </div>

          {salaryHistoryRecords.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No salary entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">Salary Month</th>
                    <th className="py-2.5 px-3 font-semibold">Credit Date</th>
                    <th className="py-2.5 px-3 font-semibold">Employer</th>
                    <th className="py-2.5 px-3 font-semibold">Bank Account</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Amount (₹)</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {salaryHistoryRecords.map((sal) => (
                    <tr key={sal.id}>
                      <td className="py-3 pr-3 font-bold text-slate-900 dark:text-white">
                        {formatMonthLabel(sal.salaryMonth)}{' '}
                        <span className="font-mono text-[10px] text-slate-400">
                          ({sal.salaryMonth})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {formatDateDDMMMYYYY(sal.transactionDate)}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {sal.employer}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{sal.bankAccountName}</td>
                      <td className="py-3 px-3">
                        {sal.status === 'credited' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Credited
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatINR(sal.amount)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(sal)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit salary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecordToDelete(sal)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                            title="Delete salary"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* VIEW 3: YEARLY & MONTHLY INCOME SUMMARY */}
      {activeView === 'yearly_summary' && (
        <div className="space-y-5">
          {/* Year Mode & Year Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setYearMode('FY')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  yearMode === 'FY'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Indian Financial Year (Apr–Mar)
              </button>
              <button
                type="button"
                onClick={() => setYearMode('CALENDAR')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  yearMode === 'CALENDAR'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Calendar Year (Jan–Dec)
              </button>
            </div>

            <div className="flex items-center gap-2">
              {[2025, 2026, 2027].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYearStart(yr)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    selectedYearStart === yr
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {yearMode === 'FY' ? `FY ${yr}-${String((yr + 1) % 100).padStart(2, '0')}` : yr}
                </button>
              ))}
            </div>
          </div>

          {/* Yearly Chart */}
          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {yearlyAnalysis.label} — Monthly Salary vs Additional Income
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Total Credited: <strong>{formatINR(yearlyAnalysis.totalYearlyIncome)}</strong> (Salary:{' '}
              {formatINR(yearlyAnalysis.totalYearlySalary)} • Additional:{' '}
              {formatINR(yearlyAnalysis.totalYearlyAdditional)})
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={yearlyAnalysis.monthlyRows}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                  />
                  <Tooltip formatter={(val: number) => formatINR(val)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="salary"
                    name="Credited Salary"
                    stackId="a"
                    fill="#059669"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="additional"
                    name="Additional Income"
                    stackId="a"
                    fill="#0284c7"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 12-Month Breakdown Table */}
          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Month-by-Month Income Breakdown ({yearlyAnalysis.label})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">Month</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Salary (₹)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Bonus (₹)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Freelance (₹)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Interest/Other (₹)</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Total Actual (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {yearlyAnalysis.monthlyRows.map((row) => (
                    <tr key={row.month}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                        {row.fullLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">
                        {formatINR(row.salary)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                        {formatINR(row.bonus)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                        {formatINR(row.freelance)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                        {formatINR(row.interest + row.other)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatINR(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                    <td className="pt-3 pr-3">Total ({yearlyAnalysis.label})</td>
                    <td className="pt-3 px-3 text-right text-emerald-600">
                      {formatINR(yearlyAnalysis.totalYearlySalary)}
                    </td>
                    <td className="pt-3 px-3 text-right" colSpan={3}>
                      Additional: {formatINR(yearlyAnalysis.totalYearlyAdditional)}
                    </td>
                    <td className="pt-3 pl-3 text-right text-emerald-600">
                      {formatINR(yearlyAnalysis.totalYearlyIncome)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ADD / EDIT SALARY & INCOME MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingRecord ? 'Edit Income / Salary Record' : 'Add Salary or Income'}
                </h2>
                <p className="text-xs text-slate-500">
                  Duplicate salary entries for the same month & employer are automatically prevented
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIncome} className="mt-4 space-y-3.5">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Income Type Pills */}
              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Income Category *
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {(['salary', 'bonus', 'interest', 'freelance', 'other'] as IncomeType[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormType(t)}
                        className={`rounded-xl py-2 px-2 text-[11px] font-bold capitalize transition cursor-pointer ${
                          formType === t
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t === 'salary' ? 'Salary' : t}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Salary Month & Credit Status */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {formType === 'salary' ? 'Salary Month *' : 'Income Month *'} (Current or Past)
                  </span>
                  <input
                    type="month"
                    required
                    value={formSalaryMonth}
                    onChange={(e) => setFormSalaryMonth(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Credit Status *
                  </span>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as IncomeStatus)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="credited">Actually Credited (Counts in Income)</option>
                    <option value="pending">Expected / Pending (Excluded from Income)</option>
                  </select>
                </label>
              </div>

              {/* Credit Date & Amount */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {formStatus === 'credited' ? 'Salary Credit Date *' : 'Expected Credit Date *'}{' '}
                    <span className="font-normal text-emerald-600">
                      ({formatDateDDMMMYYYY(formTransactionDate)})
                    </span>
                  </span>
                  <input
                    type="date"
                    required
                    value={formTransactionDate}
                    onChange={(e) => setFormTransactionDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {formType === 'salary' ? 'Salary Amount (₹) *' : 'Income Amount (₹) *'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 110000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                  />
                </label>
              </div>

              {/* Employer & Bank Account */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {formType === 'salary' ? 'Employer Name *' : 'Source / Payer *'}
                  </span>
                  <input
                    type="text"
                    required
                    list="known-employers-list"
                    placeholder="e.g. TechVista Solutions Pvt Ltd"
                    value={formEmployer}
                    onChange={(e) => setFormEmployer(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  />
                  <datalist id="known-employers-list">
                    {knownEmployers.map((emp) => (
                      <option key={emp} value={emp} />
                    ))}
                  </datalist>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Bank Account *
                  </span>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Description & Remarks */}
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Description *
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Net Salary Credited"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Remarks (Optional)
                </span>
                <textarea
                  rows={2}
                  placeholder="Optional notes (NEFT ref, TDS, arrears, variable payout)..."
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting
                    ? 'Saving...'
                    : editingRecord
                    ? 'Update Record'
                    : 'Save to IndexedDB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Confirm Delete Income Record
                </h3>
                <p className="text-xs text-slate-500">
                  This action will permanently remove the record from IndexedDB.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">
                {recordToDelete.description} ({INCOME_TYPE_LABELS[recordToDelete.type]})
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Employer / Source: <strong>{recordToDelete.employer}</strong>
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Month: <strong>{formatMonthLabel(recordToDelete.salaryMonth)}</strong> • Date:{' '}
                {formatDateDDMMMYYYY(recordToDelete.transactionDate)}
              </p>
              <p className="text-emerald-600 font-bold">
                Amount: {formatINR(recordToDelete.amount)} ({recordToDelete.bankAccountName})
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
