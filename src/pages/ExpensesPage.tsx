import React, { useMemo, useState } from 'react';
import {
  Receipt,
  Plus,
  Filter,
  Users,
  CreditCard,
  Search,
  Calendar,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  FolderPlus,
  Layers,
  X,
  BarChart3,
} from 'lucide-react';
import type {
  AccountRecord,
  CategoryGroup,
  CategoryRecord,
  ExpenseRecord,
  FamilyMemberRecord,
  PaymentMode,
} from '../types';
import type {
  CategoryBreakdownItem,
  FamilyBreakdownItem,
} from '../reports/reportEngine';
import { databaseService } from '../services/databaseService';
import {
  formatDateDDMMMYYYY,
  formatINR,
  formatMonthLabel,
  getTodayISO,
} from '../utilities/formatters';

interface ExpensesPageProps {
  expenses: ExpenseRecord[];
  categories: CategoryRecord[];
  familyMembers: FamilyMemberRecord[];
  accounts: AccountRecord[];
  selectedMonth: string;
  onChangeSelectedMonth: (month: string) => void;
  categoryBreakdown: CategoryBreakdownItem[];
  familyBreakdown: FamilyBreakdownItem[];
  demoMode: boolean;
  onDisableDemoMode: () => Promise<void>;
}

const ALL_PAYMENT_MODES: PaymentMode[] = [
  'Cash',
  'UPI',
  'Google Pay',
  'PhonePe',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
];

const CATEGORY_GROUPS: CategoryGroup[] = [
  'Household',
  'Family',
  'Financial',
  'Personal',
  'Custom',
];

export const ExpensesPage: React.FC<ExpensesPageProps> = ({
  expenses,
  categories,
  familyMembers,
  accounts,
  selectedMonth,
  onChangeSelectedMonth,
  categoryBreakdown,
  familyBreakdown,
  demoMode,
  onDisableDemoMode,
}) => {
  // Sub-views: 'list' | 'daily_totals' | 'category_totals' | 'family_totals'
  const [activeTab, setActiveTab] = useState<
    'list' | 'daily_totals' | 'category_totals' | 'family_totals'
  >('list');

  // Search & Multi-Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('ALL');
  const [filterFamily, setFilterFamily] = useState<string>('ALL');
  const [filterPaymentMode, setFilterPaymentMode] = useState<string>('ALL');

  // <15s Quick Entry Strip State
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDate, setQuickDate] = useState(getTodayISO());
  const [quickCatId, setQuickCatId] = useState('cat_groceries');
  const [quickSubcategory, setQuickSubcategory] = useState('');
  const [quickFamilyId, setQuickFamilyId] = useState('fam_entire_family');
  const [quickMode, setQuickMode] = useState<PaymentMode>('UPI');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  // Full Add / Edit Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [formDate, setFormDate] = useState(getTodayISO());
  const [formCategoryId, setFormCategoryId] = useState('cat_groceries');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaidBy, setFormPaidBy] = useState('Self');
  const [formFamilyMemberId, setFormFamilyMemberId] = useState('fam_entire_family');
  const [formPaymentMode, setFormPaymentMode] = useState<PaymentMode>('UPI');
  const [formAccountId, setFormAccountId] = useState(accounts[0]?.id ?? 'acc_salary_bank');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Inline Add Subcategory inside Expense Modal
  const [newSubInput, setNewSubInput] = useState('');
  const [addingSub, setAddingSub] = useState(false);

  // Custom Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [customCatName, setCustomCatName] = useState('');
  const [customCatGroup, setCustomCatGroup] = useState<CategoryGroup>('Household');
  const [customCatSubs, setCustomCatSubs] = useState('General, Monthly');
  const [customCatColor, setCustomCatColor] = useState('#059669');
  const [customCatError, setCustomCatError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Toast feedback
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => {
      setBannerMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Active consumption categories (excluding Investments & Savings Transfers per business rule)
  const consumptionCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.isActive &&
          !['cat_investments', 'cat_savings_transfers'].includes(c.id) &&
          !['investments', 'savings transfers'].includes(c.name.toLowerCase())
      ),
    [categories]
  );

  // Latest Used Categories for <15s Quick Selection
  const latestUsedCategories = useMemo(() => {
    const used = consumptionCategories
      .filter((c) => Boolean(c.lastUsedAt))
      .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));

    const defaultPriorityIds = [
      'cat_groceries',
      'cat_vegetables',
      'cat_fuel',
      'cat_restaurants',
      'cat_medical',
      'cat_electricity',
      'cat_mobile_recharge',
      'cat_rent',
    ];
    const fallbacks = consumptionCategories.filter(
      (c) => defaultPriorityIds.includes(c.id) && !used.some((u) => u.id === c.id)
    );
    return [...used, ...fallbacks].slice(0, 8);
  }, [consumptionCategories]);

  const activeFamilyMembers = useMemo(
    () => familyMembers.filter((m) => m.isActive),
    [familyMembers]
  );

  // Filter expenses for the selected month (or specific filterDate)
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.month === selectedMonth),
    [expenses, selectedMonth]
  );

  const filteredExpenses = useMemo(() => {
    return monthExpenses
      .filter((exp) => {
        const matchDate = !filterDate || exp.transactionDate === filterDate;
        const matchGroup = filterGroup === 'ALL' || exp.categoryGroup === filterGroup;
        const matchCat = filterCategoryId === 'ALL' || exp.categoryId === filterCategoryId;
        const matchFam =
          filterFamily === 'ALL' ||
          exp.familyMemberName === filterFamily ||
          exp.familyMemberId === filterFamily;
        const matchMode =
          filterPaymentMode === 'ALL' || exp.paymentMode === filterPaymentMode;

        const q = searchQuery.trim().toLowerCase();
        const matchQuery =
          !q ||
          exp.description.toLowerCase().includes(q) ||
          exp.categoryName.toLowerCase().includes(q) ||
          exp.subcategory.toLowerCase().includes(q) ||
          exp.familyMemberName.toLowerCase().includes(q) ||
          exp.paidBy.toLowerCase().includes(q) ||
          (exp.notes && exp.notes.toLowerCase().includes(q));

        return (
          matchDate && matchGroup && matchCat && matchFam && matchMode && matchQuery
        );
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [
    monthExpenses,
    filterDate,
    filterGroup,
    filterCategoryId,
    filterFamily,
    filterPaymentMode,
    searchQuery,
  ]);

  // Daily Totals Calculation
  const dailyTotalsList = useMemo(() => {
    const map = new Map<
      string,
      { date: string; totalAmount: number; count: number; items: ExpenseRecord[] }
    >();

    for (const exp of filteredExpenses) {
      const existing = map.get(exp.transactionDate);
      if (existing) {
        existing.totalAmount += exp.amount;
        existing.count += 1;
        existing.items.push(exp);
      } else {
        map.set(exp.transactionDate, {
          date: exp.transactionDate,
          totalAmount: exp.amount,
          count: 1,
          items: [exp],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredExpenses]);

  const todayISO = getTodayISO();
  const todayOrSelectedDate = filterDate || todayISO;
  const dailySpendForTargetDate = monthExpenses
    .filter((e) => e.transactionDate === todayOrSelectedDate)
    .reduce((s, e) => s + e.amount, 0);

  const monthlySpendTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const filteredTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  // Quick Entry Submit (<15s mobile form)
  const handleQuickExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(quickAmount);
    if (!Number.isFinite(numAmt) || numAmt <= 0) return;

    const chosenCat =
      consumptionCategories.find((c) => c.id === quickCatId) ??
      consumptionCategories[0];
    const chosenFam =
      activeFamilyMembers.find((f) => f.id === quickFamilyId) ??
      activeFamilyMembers[0] ??
      familyMembers[0];
    const chosenAcc = accounts[0];
    const sub =
      quickSubcategory && chosenCat?.subcategories.includes(quickSubcategory)
        ? quickSubcategory
        : chosenCat?.subcategories[0] ?? 'General';

    setQuickSaving(true);
    try {
      if (demoMode) {
        await onDisableDemoMode();
      }
      await databaseService.addExpense({
        transactionDate: quickDate,
        categoryId: chosenCat?.id ?? 'cat_groceries',
        categoryName: chosenCat?.name ?? 'Groceries',
        categoryGroup: chosenCat?.group ?? 'Household',
        subcategory: sub,
        description: quickDesc.trim() || `${chosenCat?.name ?? 'Expense'} (${sub})`,
        amount: numAmt,
        paidBy: 'Self',
        familyMemberId: chosenFam?.id ?? 'fam_entire_family',
        familyMemberName: chosenFam?.name ?? 'Entire Family',
        paymentMode: quickMode,
        accountId: chosenAcc?.id ?? 'acc_salary_bank',
        accountName: chosenAcc?.name ?? 'Primary Salary Bank Account',
      });

      setQuickAmount('');
      setQuickDesc('');
      onChangeSelectedMonth(quickDate.slice(0, 7));
      showToast(
        `Quick Expense (${formatINR(numAmt)} for ${chosenCat?.name}) saved to IndexedDB!`
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setQuickSaving(false);
    }
  };

  // Open Full Add Expense Modal
  const openAddExpenseModal = () => {
    setEditingExpense(null);
    const defaultCat = latestUsedCategories[0] ?? consumptionCategories[0];
    setFormDate(getTodayISO());
    setFormCategoryId(defaultCat?.id ?? 'cat_groceries');
    setFormSubcategory(defaultCat?.subcategories[0] ?? 'General');
    setFormDescription('');
    setFormAmount('');
    setFormPaidBy('Self');
    setFormFamilyMemberId('fam_entire_family');
    setFormPaymentMode('UPI');
    setFormAccountId(accounts[0]?.id ?? 'acc_salary_bank');
    setFormNotes('');
    setFormError(null);
    setIsExpenseModalOpen(true);
  };

  // Open Edit Expense Modal
  const openEditExpenseModal = (exp: ExpenseRecord) => {
    setEditingExpense(exp);
    setFormDate(exp.transactionDate);
    setFormCategoryId(exp.categoryId);
    setFormSubcategory(exp.subcategory);
    setFormDescription(exp.description);
    setFormAmount(String(exp.amount));
    setFormPaidBy(exp.paidBy);
    setFormFamilyMemberId(exp.familyMemberId);
    setFormPaymentMode(exp.paymentMode);
    setFormAccountId(exp.accountId);
    setFormNotes(exp.notes ?? '');
    setFormError(null);
    setIsExpenseModalOpen(true);
  };

  const selectedFormCategory =
    categories.find((c) => c.id === formCategoryId) ?? consumptionCategories[0];

  const isInvestmentOrSavingsTransferSelected =
    selectedFormCategory &&
    (['cat_investments', 'cat_savings_transfers'].includes(selectedFormCategory.id) ||
      ['investments', 'savings transfers'].includes(
        selectedFormCategory.name.toLowerCase()
      ));

  const handleSaveExpenseModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isInvestmentOrSavingsTransferSelected) {
      setFormError(
        'Business Rule: Investment contributions and Savings Transfers must be tracked separately under Savings Goals (not as consumption expenses).'
      );
      return;
    }

    const numericAmount = Number(formAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid expense amount greater than ₹0.');
      return;
    }

    const chosenCat = selectedFormCategory ?? consumptionCategories[0];
    const chosenFam =
      familyMembers.find((f) => f.id === formFamilyMemberId) ?? familyMembers[0];
    const chosenAcc =
      accounts.find((a) => a.id === formAccountId) ?? accounts[0];
    const sub =
      formSubcategory || chosenCat?.subcategories[0] || 'General';

    setFormSubmitting(true);
    try {
      if (demoMode) {
        await onDisableDemoMode();
      }

      const payload = {
        transactionDate: formDate,
        categoryId: chosenCat.id,
        categoryName: chosenCat.name,
        categoryGroup: chosenCat.group,
        subcategory: sub,
        description: formDescription.trim() || `${chosenCat.name} - ${sub}`,
        amount: numericAmount,
        paidBy: formPaidBy.trim() || 'Self',
        familyMemberId: chosenFam?.id ?? 'fam_entire_family',
        familyMemberName: chosenFam?.name ?? 'Entire Family',
        paymentMode: formPaymentMode,
        accountId: chosenAcc?.id ?? 'acc_salary_bank',
        accountName: chosenAcc?.name ?? 'Primary Salary Bank Account',
        notes: formNotes.trim() || undefined,
      };

      if (editingExpense && !editingExpense.id.startsWith('demo_')) {
        await databaseService.updateExpense(editingExpense.id, payload);
        showToast(`Updated expense "${payload.description}" (${formatINR(numericAmount)}).`);
      } else {
        await databaseService.addExpense(payload);
        showToast(`Saved expense "${payload.description}" (${formatINR(numericAmount)}) to IndexedDB!`);
      }

      onChangeSelectedMonth(formDate.slice(0, 7));
      setIsExpenseModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAddInlineSubcategory = async () => {
    if (!newSubInput.trim() || !selectedFormCategory) return;
    try {
      const updated = await databaseService.addSubcategoryToCategory(
        selectedFormCategory.id,
        newSubInput.trim()
      );
      setFormSubcategory(newSubInput.trim());
      setNewSubInput('');
      setAddingSub(false);
      showToast(`Added subcategory to ${updated.name}!`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomCatError(null);
    try {
      const subs = customCatSubs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const created = await databaseService.addCustomCategory({
        name: customCatName,
        group: customCatGroup,
        subcategories: subs,
        color: customCatColor,
      });
      setCustomCatName('');
      setIsCategoryModalOpen(false);
      setFormCategoryId(created.id);
      setFormSubcategory(created.subcategories[0] ?? 'General');
      showToast(`Created custom category "${created.name}" in IndexedDB!`);
    } catch (err: unknown) {
      setCustomCatError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeleteSubmitting(true);
    try {
      if (demoMode || expenseToDelete.id.startsWith('demo_')) {
        await onDisableDemoMode();
        setExpenseToDelete(null);
        return;
      }
      await databaseService.deleteExpense(expenseToDelete.id);
      showToast(
        `Deleted expense "${expenseToDelete.description}" (${formatINR(expenseToDelete.amount)}).`
      );
      setExpenseToDelete(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const quickSelectedCat =
    consumptionCategories.find((c) => c.id === quickCatId) ??
    consumptionCategories[0];

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {bannerMsg && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/70 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-emerald-600 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            Daily & Family Expense Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manual daily expense tracking across Household, Family, Financial & Personal categories
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
            onClick={() => setIsCategoryModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5 text-emerald-600" />
            <span>+ Custom Category</span>
          </button>

          <button
            type="button"
            onClick={openAddExpenseModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Full Expense Form</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards: Daily Total, Monthly Total, Top Category, Top Family Member */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">
            Daily Total ({formatDateDDMMMYYYY(todayOrSelectedDate)})
          </span>
          <p className="mt-1.5 text-lg font-bold text-rose-600 dark:text-rose-400">
            {formatINR(dailySpendForTargetDate)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {dailyTotalsList.length} active spending days in month
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">
            Monthly Total ({formatMonthLabel(selectedMonth)})
          </span>
          <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
            {formatINR(monthlySpendTotal)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {monthExpenses.length} expense transactions
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Top Category Spend</span>
          <p className="mt-1.5 text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
            {categoryBreakdown[0]
              ? `${categoryBreakdown[0].categoryName} (${formatINR(categoryBreakdown[0].totalAmount)})`
              : '₹0'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {categoryBreakdown[0]
              ? `${categoryBreakdown[0].percentage}% of monthly expenses`
              : 'No expenses yet'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Top Family Allocation</span>
          <p className="mt-1.5 text-lg font-bold text-blue-600 dark:text-blue-400 truncate">
            {familyBreakdown[0]
              ? `${familyBreakdown[0].familyMemberName} (${formatINR(familyBreakdown[0].totalAmount)})`
              : '₹0'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {familyBreakdown[0]
              ? `${familyBreakdown[0].percentage}% share (${familyBreakdown[0].transactionCount} txns)`
              : 'No family allocation yet'}
          </p>
        </div>
      </div>

      {/* PART D: <15 SECOND MOBILE QUICK EXPENSE ENTRY CARD */}
      <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20 p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                &lt;15s Mobile Quick Expense Bar
              </h2>
              <p className="text-[11px] text-slate-500">
                Tap a recent category, enter ₹ amount, and press Save
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Clock className="h-3 w-3" /> Latest Used Categories
          </span>
        </div>

        {/* 1-Tap Latest Used Category Chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {latestUsedCategories.map((cat) => {
            const active = quickSelectedCat?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setQuickCatId(cat.id);
                  setQuickSubcategory(cat.subcategories[0] ?? 'General');
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition cursor-pointer border ${
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? '#fff' : cat.color }}
                />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        <form
          onSubmit={handleQuickExpenseSubmit}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-6 items-end"
        >
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Amount (₹) *
            </label>
            <input
              type="number"
              step="any"
              required
              placeholder="₹ Amount"
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Subcategory
            </label>
            <select
              value={
                quickSubcategory &&
                quickSelectedCat?.subcategories.includes(quickSubcategory)
                  ? quickSubcategory
                  : quickSelectedCat?.subcategories[0] ?? 'General'
              }
              onChange={(e) => setQuickSubcategory(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-medium"
            >
              {(quickSelectedCat?.subcategories ?? ['General']).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Family Member
            </label>
            <select
              value={quickFamilyId}
              onChange={(e) => setQuickFamilyId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-medium"
            >
              {activeFamilyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Payment Mode
            </label>
            <select
              value={quickMode}
              onChange={(e) => setQuickMode(e.target.value as PaymentMode)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-medium"
            >
              {ALL_PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Short Note / Date
            </label>
            <input
              type="text"
              placeholder="Optional description..."
              value={quickDesc}
              onChange={(e) => setQuickDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={quickSaving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 px-4 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {quickSaving ? 'Saving...' : '+ Quick Add'}
          </button>
        </form>
      </section>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          {
            id: 'list',
            label: `Expense Transactions (${filteredExpenses.length})`,
            icon: Receipt,
          },
          {
            id: 'daily_totals',
            label: `Daily Totals (${dailyTotalsList.length} Days)`,
            icon: Calendar,
          },
          {
            id: 'category_totals',
            label: `Category Totals (${categoryBreakdown.length})`,
            icon: Layers,
          },
          {
            id: 'family_totals',
            label: `Family Member Totals (${familyBreakdown.length})`,
            icon: BarChart3,
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

      {/* Search & Multi-Filter Controls */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Filter className="h-3.5 w-3.5 text-emerald-600" />
            Search & Filter Expenses (Date, Category, Family Member, Payment Mode)
          </span>
          <div className="flex items-center gap-3">
            {(searchQuery ||
              filterDate ||
              filterGroup !== 'ALL' ||
              filterCategoryId !== 'ALL' ||
              filterFamily !== 'ALL' ||
              filterPaymentMode !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterDate('');
                  setFilterGroup('ALL');
                  setFilterCategoryId('ALL');
                  setFilterFamily('ALL');
                  setFilterPaymentMode('ALL');
                }}
                className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              Filtered Total: {formatINR(filteredTotal)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search description, subcategory, paid by, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-xs"
            />
          </div>

          {/* Filter by Specific Date */}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
            title="Filter by specific date"
          />

          {/* Filter by Category */}
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.group})
              </option>
            ))}
          </select>

          {/* Filter by Payment Mode */}
          <select
            value={filterPaymentMode}
            onChange={(e) => setFilterPaymentMode(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="ALL">All Payment Modes</option>
            {ALL_PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Family Member & Category Group Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-1.5">
            {['ALL', ...familyMembers.map((f) => f.name)].map((famName) => (
              <button
                key={famName}
                type="button"
                onClick={() => setFilterFamily(famName)}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  filterFamily === famName
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {famName === 'ALL' ? 'All Family Members' : famName}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {['ALL', ...CATEGORY_GROUPS].map((grp) => (
              <button
                key={grp}
                type="button"
                onClick={() => setFilterGroup(grp)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  filterGroup === grp
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400'
                }`}
              >
                {grp === 'ALL' ? 'All Groups' : grp}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: EXPENSE TRANSACTIONS LIST */}
      {activeTab === 'list' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Expense Transactions ({filteredExpenses.length})
            </h2>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No expense records match your filters. Use the Quick Expense Bar above or click{' '}
              <strong>+ Full Expense Form</strong>.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 transition hover:border-emerald-500/30"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                          {exp.description}
                        </p>
                        <span className="rounded-md bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                          {exp.categoryGroup}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatDateDDMMMYYYY(exp.transactionDate)}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {exp.categoryName} → {exp.subcategory}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                          <Users className="h-2.5 w-2.5" /> For: {exp.familyMemberName} (Paid by{' '}
                          {exp.paidBy})
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <CreditCard className="h-2.5 w-2.5" /> {exp.paymentMode} •{' '}
                          {exp.accountName}
                        </span>
                      </div>

                      {exp.notes && (
                        <p className="mt-1 text-[11px] italic text-slate-500 dark:text-slate-400">
                          Notes: {exp.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800 pt-2 sm:pt-0">
                    <p className="text-xs font-bold sm:text-sm text-rose-600 dark:text-rose-400">
                      -{formatINR(exp.amount)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditExpenseModal(exp)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseToDelete(exp)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
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
      )}

      {/* TAB 2: DAILY TOTALS VIEW */}
      {activeTab === 'daily_totals' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Date-wise Daily Spending Totals ({formatMonthLabel(selectedMonth)})
          </h2>

          {dailyTotalsList.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No daily expenses recorded for this period.
            </p>
          ) : (
            <div className="space-y-3">
              {dailyTotalsList.map((day) => (
                <div
                  key={day.date}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                        {formatDateDDMMMYYYY(day.date)}
                      </span>
                      <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold">
                        {day.count} {day.count === 1 ? 'expense' : 'expenses'}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {formatINR(day.totalAmount)}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5">
                    {day.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300"
                      >
                        <span>
                          <strong>{item.categoryName}</strong> ({item.subcategory}) —{' '}
                          {item.description} •{' '}
                          <span className="text-[11px] text-blue-600 dark:text-blue-400">
                            {item.familyMemberName}
                          </span>
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatINR(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: CATEGORY-WISE TOTALS VIEW */}
      {activeTab === 'category_totals' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Category-wise Expense Totals ({formatMonthLabel(selectedMonth)})
          </h2>
          {categoryBreakdown.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No category spending data for this month.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.categoryId}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                        {cat.categoryName}
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        {cat.group} • {cat.transactionCount} transactions
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatINR(cat.totalAmount)}
                      </p>
                      <span className="text-[11px] font-semibold text-emerald-600">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: FAMILY MEMBER-WISE TOTALS VIEW */}
      {activeTab === 'family_totals' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Family Member-wise Expense Summary ({formatMonthLabel(selectedMonth)})
          </h2>
          {familyBreakdown.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No family expenses recorded for this month.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {familyBreakdown.map((fam) => (
                <div
                  key={fam.familyMemberId || fam.familyMemberName}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                        {fam.familyMemberName}
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        {fam.transactionCount} allocated expenses
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {formatINR(fam.totalAmount)}
                      </p>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {fam.percentage}% of total
                      </span>
                    </div>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${fam.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* FULL ADD / EDIT EXPENSE MODAL (All 10 Required Fields) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingExpense ? 'Edit Expense Transaction' : 'Add Daily / Family Expense'}
                </h2>
                <p className="text-xs text-slate-500">
                  Complete 10-field expense form • Stored locally in IndexedDB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseModal} className="mt-4 space-y-3.5">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Expense Date & 5. Amount */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    1. Expense Date ({formatDateDDMMMYYYY(formDate)}) *
                  </span>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    2. Amount (₹) *
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 2500"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                  />
                </label>
              </div>

              {/* 3. Expense Category & 4. Subcategory */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    3. Expense Category *
                  </span>
                  <select
                    value={formCategoryId}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      setFormCategoryId(e.target.value);
                      if (cat) setFormSubcategory(cat.subcategories[0] ?? 'General');
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  >
                    {CATEGORY_GROUPS.map((grp) => {
                      const groupCats = consumptionCategories.filter((c) => c.group === grp);
                      if (groupCats.length === 0) return null;
                      return (
                        <optgroup key={grp} label={`${grp} Categories`}>
                          {groupCats.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </label>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      4. Subcategory *
                    </span>
                    <button
                      type="button"
                      onClick={() => setAddingSub((prev) => !prev)}
                      className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                    >
                      {addingSub ? 'Cancel' : '+ Add Subcategory'}
                    </button>
                  </div>
                  {addingSub ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="New subcategory..."
                        value={newSubInput}
                        onChange={(e) => setNewSubInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddInlineSubcategory}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formSubcategory}
                      onChange={(e) => setFormSubcategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                    >
                      {(selectedFormCategory?.subcategories ?? ['General']).map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 5. Description */}
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  5. Description *
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly supermarket groceries & provisions"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              {/* 6. Paid By & 7. Family Member */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    6. Paid By *
                  </span>
                  <select
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {familyMembers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    7. For Family Member *
                  </span>
                  <select
                    value={formFamilyMemberId}
                    onChange={(e) => setFormFamilyMemberId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {familyMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.relationship})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* 8. Payment Mode & 9. Account */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    8. Payment Mode *
                  </span>
                  <select
                    value={formPaymentMode}
                    onChange={(e) => setFormPaymentMode(e.target.value as PaymentMode)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  >
                    {ALL_PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    9. Source Account *
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

              {/* 10. Notes */}
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  10. Notes (Optional)
                </span>
                <textarea
                  rows={2}
                  placeholder="Optional receipt details, bill number, or warranty info..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
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
                    : editingExpense
                    ? 'Update Expense'
                    : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Create Custom Expense Category
                </h3>
                <p className="text-xs text-slate-500">
                  Add your own category and comma-separated subcategories
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomCategory} className="mt-4 space-y-3">
              {customCatError && (
                <div className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">
                  {customCatError}
                </div>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Category Name *
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pet Care, Home Maintenance, Elder Care"
                  value={customCatName}
                  onChange={(e) => setCustomCatName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Category Group
                  </span>
                  <select
                    value={customCatGroup}
                    onChange={(e) => setCustomCatGroup(e.target.value as CategoryGroup)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {CATEGORY_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Badge Color
                  </span>
                  <input
                    type="color"
                    value={customCatColor}
                    onChange={(e) => setCustomCatColor(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 cursor-pointer"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Subcategories (comma-separated) *
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supplies, Service, Monthly"
                  value={customCatSubs}
                  onChange={(e) => setCustomCatSubs(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Confirm Delete Expense
                </h3>
                <p className="text-xs text-slate-500">
                  Deleting this expense will also restore its amount to the source account.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">
                {expenseToDelete.description}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Category: <strong>{expenseToDelete.categoryName}</strong> (
                {expenseToDelete.subcategory})
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Family Member: <strong>{expenseToDelete.familyMemberName}</strong> • Date:{' '}
                {formatDateDDMMMYYYY(expenseToDelete.transactionDate)}
              </p>
              <p className="text-rose-600 font-bold">
                Amount: {formatINR(expenseToDelete.amount)} ({expenseToDelete.paymentMode})
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDeleteExpense}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
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
