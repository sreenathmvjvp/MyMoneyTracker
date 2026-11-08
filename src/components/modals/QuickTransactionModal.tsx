import React, { useMemo, useState } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
} from 'lucide-react';
import type {
  AccountRecord,
  CategoryRecord,
  FamilyMemberRecord,
  PaymentMode,
  SavingsGoalRecord,
} from '../../types';
import { databaseService } from '../../services/databaseService';
import {
  formatDateDDMMMYYYY,
  getCurrentMonthYYYYMM,
  getTodayISO,
} from '../../utilities/formatters';

interface QuickTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryRecord[];
  familyMembers: FamilyMemberRecord[];
  accounts: AccountRecord[];
  savingsGoals: SavingsGoalRecord[];
  demoMode: boolean;
  onDisableDemoMode: () => Promise<void>;
}

export const PAYMENT_MODES: PaymentMode[] = [
  'UPI',
  'Google Pay',
  'PhonePe',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
];

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2000];

export const QuickTransactionModal: React.FC<QuickTransactionModalProps> = ({
  isOpen,
  onClose,
  categories,
  familyMembers,
  accounts,
  savingsGoals,
  demoMode,
  onDisableDemoMode,
}) => {
  const [tab, setTab] = useState<'expense' | 'income' | 'savings' | 'transfer'>('expense');
  const [date, setDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'cat_groceries');
  const [subcategory, setSubcategory] = useState('');
  const [paidBy, setPaidBy] = useState('Self');
  const [familyMemberId, setFamilyMemberId] = useState('fam_entire_family');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 'acc_salary_bank');

  // Income fields
  const [incomeType, setIncomeType] = useState<
    'salary' | 'bonus' | 'interest' | 'freelance' | 'other'
  >('salary');
  const [employer, setEmployer] = useState('');

  // Savings fields
  const [goalId, setGoalId] = useState(savingsGoals[0]?.id ?? '');
  const [contributionType, setContributionType] = useState<'savings' | 'investment'>('savings');

  // Transfer fields
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? 'acc_family_savings');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Compute Latest Used Categories for <15s Quick Selection
  // Excludes Investments / Savings Transfers from consumption quick chips to enforce business rules
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

  const latestUsedCategories = useMemo(() => {
    const withLastUsed = consumptionCategories
      .filter((c) => Boolean(c.lastUsedAt))
      .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));

    const fallbackIds = [
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
      (c) => fallbackIds.includes(c.id) && !withLastUsed.some((u) => u.id === c.id)
    );

    return [...withLastUsed, ...fallbacks].slice(0, 8);
  }, [consumptionCategories]);

  if (!isOpen) return null;

  const selectedCategory =
    consumptionCategories.find((c) => c.id === categoryId) ??
    consumptionCategories[0] ??
    categories[0];

  const activeSubcategory =
    subcategory && selectedCategory?.subcategories.includes(subcategory)
      ? subcategory
      : selectedCategory?.subcategories[0] ?? 'General';

  const activeFamilyMembers = familyMembers.filter((f) => f.isActive);
  const selectedFamily =
    activeFamilyMembers.find((f) => f.id === familyMemberId) ??
    activeFamilyMembers[0] ??
    familyMembers[0];
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const handleQuickCategorySelect = (cat: CategoryRecord) => {
    setCategoryId(cat.id);
    setSubcategory(cat.subcategories[0] ?? 'General');
  };

  const handleQuickAmountAdd = (delta: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + delta));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid monetary amount greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      if (demoMode) {
        await onDisableDemoMode();
      }

      if (tab === 'expense') {
        await databaseService.addExpense({
          transactionDate: date,
          categoryId: selectedCategory?.id ?? 'cat_groceries',
          categoryName: selectedCategory?.name ?? 'Groceries',
          categoryGroup: selectedCategory?.group ?? 'Household',
          subcategory: activeSubcategory,
          description:
            description.trim() || `${selectedCategory?.name ?? 'Expense'} - ${activeSubcategory}`,
          amount: numericAmount,
          paidBy: paidBy || 'Self',
          familyMemberId: selectedFamily?.id ?? 'fam_self',
          familyMemberName: selectedFamily?.name ?? 'Self',
          paymentMode,
          accountId: selectedAccount?.id ?? 'acc_salary_bank',
          accountName: selectedAccount?.name ?? 'Primary Salary Bank Account',
          notes: notes.trim() || undefined,
        });
        setSuccessMsg('Expense saved to local IndexedDB!');
      } else if (tab === 'income') {
        await databaseService.addIncome({
          type: incomeType,
          salaryMonth: date.slice(0, 7) || getCurrentMonthYYYYMM(),
          transactionDate: date,
          status: 'credited',
          amount: numericAmount,
          employer:
            employer.trim() ||
            (incomeType === 'salary' ? 'Primary Employer' : 'Additional Income Source'),
          accountId: selectedAccount?.id ?? 'acc_salary_bank',
          bankAccountName: selectedAccount?.name ?? 'Primary Salary Bank Account',
          description: description.trim() || `${incomeType.toUpperCase()} Credited`,
          remarks: notes.trim() || undefined,
        });
        setSuccessMsg('Income record saved to local IndexedDB!');
      } else if (tab === 'savings') {
        let targetGoal = savingsGoals.find(
          (g) => g.id === goalId && !g.id.startsWith('demo_')
        );
        if (!targetGoal) {
          targetGoal = await databaseService.addSavingsGoal({
            name:
              contributionType === 'investment'
                ? 'Long-Term Investment Corpus'
                : 'Emergency Fund',
            targetAmount: 300000,
            currentContribution: 0,
            startDate: date,
            targetDate: '2027-12-31',
            priority: 'High',
            status: 'active',
            category: contributionType,
          });
        }
        await databaseService.addSavingsContribution({
          goalId: targetGoal.id,
          goalName: targetGoal.name,
          transactionDate: date,
          amount: numericAmount,
          contributionType,
          sourceAccountId: selectedAccount?.id ?? 'acc_salary_bank',
          sourceAccountName: selectedAccount?.name ?? 'Primary Salary Bank Account',
          paymentMode,
          notes: description.trim() || `${contributionType} contribution`,
        });
        setSuccessMsg(
          `${
            contributionType === 'investment' ? 'Investment' : 'Savings'
          } contribution tracked separately & goal updated!`
        );
      } else if (tab === 'transfer') {
        const destAcc =
          accounts.find((a) => a.id === toAccountId && a.id !== selectedAccount?.id) ??
          accounts.find((a) => a.id !== selectedAccount?.id) ??
          accounts[1];
        await databaseService.addSelfTransfer({
          transactionDate: date,
          fromAccountId: selectedAccount?.id ?? 'acc_salary_bank',
          fromAccountName: selectedAccount?.name ?? 'Primary Salary Bank Account',
          toAccountId: destAcc?.id ?? 'acc_family_savings',
          toAccountName: destAcc?.name ?? 'Savings Bank Account',
          amount: numericAmount,
          description: description.trim() || 'Self account transfer',
          notes: notes.trim() || undefined,
        });
        setSuccessMsg('Self-transfer recorded (not classified as an expense)!');
      }

      setAmount('');
      setDescription('');
      setNotes('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Quick Mobile Entry (&lt;15s)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1-tap latest categories • Saved directly to local IndexedDB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Transaction Type Selector */}
        <div className="mt-3.5 grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1">
          {[
            { id: 'expense', label: 'Expense', icon: ArrowUpRight },
            { id: 'income', label: 'Income', icon: ArrowDownLeft },
            { id: 'savings', label: 'Savings/Inv.', icon: PiggyBank },
            { id: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id as typeof tab);
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Amount + Quick Add Chips + Date */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Amount (₹) *
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="₹ 0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-base font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Date ({formatDateDDMMMYYYY(date)})
                </span>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </label>
            </div>

            {/* 1-Tap Quick Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAmountAdd(amt)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-500 cursor-pointer"
                >
                  +₹{amt}
                </button>
              ))}
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="rounded-lg px-2 py-1 text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {tab === 'expense' && (
            <>
              {/* Latest Used Categories for Quick Selection */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    Latest Used Categories (1-Tap)
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {latestUsedCategories.map((cat) => {
                    const isSelected = selectedCategory?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleQuickCategorySelect(cat)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer border ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: isSelected ? '#ffffff' : cat.color,
                          }}
                        />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full Category & Subcategory Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    All Categories
                  </span>
                  <select
                    value={selectedCategory?.id ?? ''}
                    onChange={(e) => {
                      const found = consumptionCategories.find((c) => c.id === e.target.value);
                      if (found) handleQuickCategorySelect(found);
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {consumptionCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.group})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Subcategory
                  </span>
                  <select
                    value={activeSubcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {(selectedCategory?.subcategories ?? ['General']).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Family Member Association & Paid By */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    For Family Member
                  </span>
                  <select
                    value={selectedFamily?.id ?? ''}
                    onChange={(e) => setFamilyMemberId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {activeFamilyMembers.map((fam) => (
                      <option key={fam.id} value={fam.id}>
                        {fam.name} ({fam.relationship})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Paid By & Account
                  </span>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
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

              {/* Payment Modes */}
              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Payment Mode
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PAYMENT_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        paymentMode === mode
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'income' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Income Type
                </span>
                <select
                  value={incomeType}
                  onChange={(e) => setIncomeType(e.target.value as typeof incomeType)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="salary">Monthly Salary</option>
                  <option value="bonus">Bonus / Incentive</option>
                  <option value="freelance">Freelance Income</option>
                  <option value="interest">Bank / FD Interest</option>
                  <option value="other">Other Income</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Employer / Source
                </span>
                <input
                  type="text"
                  placeholder="e.g. Company Name"
                  value={employer}
                  onChange={(e) => setEmployer(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>
            </div>
          )}

          {tab === 'savings' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Contribution Type
                </span>
                <select
                  value={contributionType}
                  onChange={(e) =>
                    setContributionType(e.target.value as 'savings' | 'investment')
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="savings">Savings Transfer</option>
                  <option value="investment">Investment Contribution</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Target Savings Goal
                </span>
                <select
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  {savingsGoals.length === 0 ? (
                    <option value="">Auto-Create Goal</option>
                  ) : (
                    savingsGoals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
          )}

          {tab === 'transfer' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  From Account
                </span>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  To Account
                </span>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Description (Optional)
              </span>
              <input
                type="text"
                placeholder="e.g. Monthly groceries"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </label>
            {tab === 'expense' && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Paid By
                </span>
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  {activeFamilyMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
