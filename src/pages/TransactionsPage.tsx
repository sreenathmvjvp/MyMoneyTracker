import React, { useEffect, useState } from 'react';
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type {
  AccountRecord,
  CategoryRecord,
  EmiPaymentRecord,
  ExpenseRecord,
  FamilyMemberRecord,
  IncomeRecord,
  IncomeType,
  LoanRecord,
  PaymentMode,
  SavingsContributionRecord,
  SavingsGoalRecord,
  TransferRecord,
} from '../types';
import type { UnifiedTransactionItem } from '../types/navigation';
import { formatDateDDMMMYYYY, formatINR } from '../utilities/formatters';
import { databaseService } from '../services/databaseService';

interface TransactionsPageProps {
  transactions: UnifiedTransactionItem[];
  onOpenQuickAdd: () => void;
  income?: IncomeRecord[];
  expenses?: ExpenseRecord[];
  savingsContributions?: SavingsContributionRecord[];
  emiPayments?: EmiPaymentRecord[];
  transfers?: TransferRecord[];
  categories?: CategoryRecord[];
  familyMembers?: FamilyMemberRecord[];
  accounts?: AccountRecord[];
  savingsGoals?: SavingsGoalRecord[];
  loans?: LoanRecord[];
  demoMode?: boolean;
  onDisableDemoMode?: () => void;
  initialEditTxId?: string | null;
  onClearInitialEditTx?: () => void;
}

const PAYMENT_MODES: PaymentMode[] = [
  'UPI',
  'Google Pay',
  'PhonePe',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
];

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  onOpenQuickAdd,
  income = [],
  expenses = [],
  savingsContributions = [],
  emiPayments = [],
  transfers = [],
  categories = [],
  familyMembers = [],
  accounts = [],
  savingsGoals = [],
  loans = [],
  demoMode = false,
  onDisableDemoMode,
  initialEditTxId,
  onClearInitialEditTx,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState<
    'all' | 'income' | 'expense' | 'savings' | 'emi' | 'transfer'
  >('all');

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Modal State
  const [editingTx, setEditingTx] = useState<UnifiedTransactionItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Shared & Specific Edit Fields
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState<PaymentMode>('UPI');

  // Expense-specific fields
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editFamilyMemberId, setEditFamilyMemberId] = useState('');
  const [editPaidBy, setEditPaidBy] = useState<string>('Self');
  const [editNotes, setEditNotes] = useState('');

  // Income-specific fields
  const [editIncomeType, setEditIncomeType] = useState<IncomeType>('salary');
  const [editSalaryMonth, setEditSalaryMonth] = useState('');
  const [editEmployer, setEditEmployer] = useState('');
  const [editIncomeStatus, setEditIncomeStatus] = useState<'credited' | 'pending'>('credited');

  // Savings-specific fields
  const [editGoalId, setEditGoalId] = useState('');
  const [editContributionType, setEditContributionType] = useState<'savings' | 'investment'>(
    'savings'
  );

  // EMI-specific fields
  const [editLoanId, setEditLoanId] = useState('');
  const [editPrincipalComp, setEditPrincipalComp] = useState('');
  const [editInterestComp, setEditInterestComp] = useState('');

  // Transfer-specific fields
  const [editFromAccountId, setEditFromAccountId] = useState('');
  const [editToAccountId, setEditToAccountId] = useState('');

  // Delete Confirmation State
  const [deletingTx, setDeletingTx] = useState<UnifiedTransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = transactions.filter((tx) => {
    const matchKind = filterKind === 'all' || tx.kind === filterKind;
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      tx.title.toLowerCase().includes(q) ||
      tx.subtitle.toLowerCase().includes(q) ||
      tx.category.toLowerCase().includes(q) ||
      (tx.familyMember && tx.familyMember.toLowerCase().includes(q)) ||
      (tx.paymentMode && tx.paymentMode.toLowerCase().includes(q));
    return matchKind && matchQuery;
  });

  // Open Edit Modal pre-populated with the underlying record
  const handleStartEdit = (tx: UnifiedTransactionItem) => {
    setFeedbackMsg(null);
    setErrorMsg(null);

    if (demoMode) {
      setErrorMsg(
        'Demo Mode is currently active. Switch off Demo Mode above to add and edit your real transactions.'
      );
      return;
    }

    setEditingTx(tx);
    setEditDate(tx.date);
    setEditAmount(String(tx.amount));

    if (tx.kind === 'expense') {
      const exp = expenses.find((e) => e.id === tx.id);
      if (exp) {
        setEditDate(exp.transactionDate);
        setEditAmount(String(exp.amount));
        setEditCategoryId(exp.categoryId);
        setEditSubcategory(exp.subcategory);
        setEditDescription(exp.description);
        setEditFamilyMemberId(exp.familyMemberId);
        setEditPaidBy(exp.paidBy);
        setEditPaymentMode(exp.paymentMode);
        setEditAccountId(exp.accountId);
        setEditNotes(exp.notes || '');
      }
    } else if (tx.kind === 'income') {
      const inc = income.find((i) => i.id === tx.id);
      if (inc) {
        setEditDate(inc.transactionDate);
        setEditAmount(String(inc.amount));
        setEditIncomeType(inc.type);
        setEditSalaryMonth(inc.salaryMonth);
        setEditEmployer(inc.employer);
        setEditIncomeStatus(inc.status);
        setEditAccountId(inc.accountId);
        setEditDescription(inc.description);
        setEditNotes(inc.remarks || '');
      }
    } else if (tx.kind === 'savings') {
      const con = savingsContributions.find((c) => c.id === tx.id);
      if (con) {
        setEditDate(con.transactionDate);
        setEditAmount(String(con.amount));
        setEditGoalId(con.goalId);
        setEditContributionType(con.contributionType);
        setEditAccountId(con.sourceAccountId);
        setEditPaymentMode(con.paymentMode);
        setEditNotes(con.notes || '');
      }
    } else if (tx.kind === 'emi') {
      const emi = emiPayments.find((p) => p.id === tx.id);
      if (emi) {
        setEditDate(emi.transactionDate);
        setEditAmount(String(emi.totalAmount));
        setEditLoanId(emi.loanId);
        setEditPrincipalComp(String(emi.principalComponent));
        setEditInterestComp(String(emi.interestComponent));
        setEditAccountId(emi.accountId);
        setEditPaymentMode(emi.paymentMode);
        setEditNotes(emi.notes || '');
      }
    } else if (tx.kind === 'transfer') {
      const trf = transfers.find((t) => t.id === tx.id);
      if (trf) {
        setEditDate(trf.transactionDate);
        setEditAmount(String(trf.amount));
        setEditFromAccountId(trf.fromAccountId);
        setEditToAccountId(trf.toAccountId);
        setEditDescription(trf.description);
      }
    }
  };

  useEffect(() => {
    if (initialEditTxId) {
      const target = transactions.find((t) => t.id === initialEditTxId);
      if (target) {
        handleStartEdit(target);
      }
      if (onClearInitialEditTx) {
        onClearInitialEditTx();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditTxId]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setErrorMsg(null);
    setFeedbackMsg(null);

    const parsedAmount = Number(editAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than ₹0.');
      return;
    }

    setIsSavingEdit(true);
    try {
      if (editingTx.kind === 'expense') {
        const cat =
          categories.find((c) => c.id === editCategoryId) || categories[0];
        const fam =
          familyMembers.find((f) => f.id === editFamilyMemberId) ||
          familyMembers[0];
        const acc =
          accounts.find((a) => a.id === editAccountId) || accounts[0];

        await databaseService.updateExpense(editingTx.id, {
          transactionDate: editDate,
          categoryId: cat?.id || 'cat_groceries',
          categoryName: cat?.name || 'Groceries',
          categoryGroup: cat?.group || 'Household',
          subcategory:
            editSubcategory.trim() || cat?.subcategories[0] || 'General',
          description:
            editDescription.trim() || cat?.name || 'Expense Transaction',
          amount: parsedAmount,
          paidBy: editPaidBy,
          familyMemberId: fam?.id || 'fam_self',
          familyMemberName: fam?.name || 'Self',
          paymentMode: editPaymentMode,
          accountId: acc?.id || 'acc_salary_bank',
          accountName: acc?.name || 'Primary Salary Bank Account',
          notes: editNotes.trim() || undefined,
        });
        setFeedbackMsg('Expense transaction updated successfully.');
      } else if (editingTx.kind === 'income') {
        const acc =
          accounts.find((a) => a.id === editAccountId) || accounts[0];
        await databaseService.updateIncome(editingTx.id, {
          type: editIncomeType,
          salaryMonth: editSalaryMonth || editDate.slice(0, 7),
          transactionDate: editDate,
          status: editIncomeStatus,
          amount: parsedAmount,
          employer: editEmployer.trim() || 'Primary Employer',
          accountId: acc?.id || 'acc_salary_bank',
          bankAccountName: acc?.name || 'Primary Salary Bank Account',
          description: editDescription.trim() || 'Income Entry',
          remarks: editNotes.trim() || undefined,
        });
        setFeedbackMsg('Income transaction updated successfully.');
      } else if (editingTx.kind === 'savings') {
        const goal =
          savingsGoals.find((g) => g.id === editGoalId) || savingsGoals[0];
        const acc =
          accounts.find((a) => a.id === editAccountId) || accounts[0];
        if (!goal) {
          throw new Error('Please select a valid savings goal.');
        }
        await databaseService.updateSavingsContribution(editingTx.id, {
          goalId: goal.id,
          goalName: goal.name,
          transactionDate: editDate,
          amount: parsedAmount,
          contributionType: editContributionType,
          sourceAccountId: acc?.id || 'acc_salary_bank',
          sourceAccountName: acc?.name || 'Primary Salary Bank Account',
          paymentMode: editPaymentMode,
          notes: editNotes.trim() || undefined,
        });
        setFeedbackMsg(
          'Savings contribution updated and goal progress recalculated.'
        );
      } else if (editingTx.kind === 'emi') {
        const loan = loans.find((l) => l.id === editLoanId) || loans[0];
        const acc =
          accounts.find((a) => a.id === editAccountId) || accounts[0];
        if (!loan) {
          throw new Error('Associated loan not found.');
        }
        const pComp = Number(editPrincipalComp) || 0;
        const iComp = Number(editInterestComp) || 0;
        await databaseService.updateEmiPayment(editingTx.id, {
          loanId: loan.id,
          transactionDate: editDate,
          totalAmount: parsedAmount,
          principalComponent: pComp,
          interestComponent: iComp,
          accountId: acc?.id || 'acc_salary_bank',
          accountName: acc?.name || 'Primary Salary Bank Account',
          paymentMode: editPaymentMode,
          notes: editNotes.trim() || undefined,
        });
        setFeedbackMsg(
          'EMI payment updated and loan outstanding principal recalculated.'
        );
      } else if (editingTx.kind === 'transfer') {
        const fromAcc = accounts.find((a) => a.id === editFromAccountId);
        const toAcc = accounts.find((a) => a.id === editToAccountId);
        if (!fromAcc || !toAcc) {
          throw new Error('Please select valid source and destination accounts.');
        }
        await databaseService.updateSelfTransfer(editingTx.id, {
          transactionDate: editDate,
          fromAccountId: fromAcc.id,
          fromAccountName: fromAcc.name,
          toAccountId: toAcc.id,
          toAccountName: toAcc.name,
          amount: parsedAmount,
          description: editDescription.trim() || 'Self Account Transfer',
        });
        setFeedbackMsg('Self-transfer updated successfully.');
      }

      setEditingTx(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update transaction.'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTx) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsDeleting(true);

    try {
      if (deletingTx.kind === 'expense') {
        await databaseService.deleteExpense(deletingTx.id);
      } else if (deletingTx.kind === 'income') {
        await databaseService.deleteIncome(deletingTx.id);
      } else if (deletingTx.kind === 'savings') {
        await databaseService.deleteSavingsContribution(deletingTx.id);
      } else if (deletingTx.kind === 'emi') {
        await databaseService.deleteEmiPayment(deletingTx.id);
      } else if (deletingTx.kind === 'transfer') {
        await databaseService.deleteSelfTransfer(deletingTx.id);
      }

      setFeedbackMsg(`Deleted "${deletingTx.title}" and updated balances.`);
      setDeletingTx(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to delete transaction.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedEditCategory = categories.find((c) => c.id === editCategoryId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            All Transactions Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            View, search, edit, or delete any Income, Expense, Goal Contribution, EMI, or Transfer
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Transaction</span>
        </button>
      </div>

      {/* Demo Mode Notice */}
      {demoMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Sample Demo Mode Active:</strong> Switch to Real Data to edit or delete your
              own personal transactions.
            </span>
          </div>
          {onDisableDemoMode && (
            <button
              type="button"
              onClick={onDisableDemoMode}
              className="rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
            >
              Switch to Real Data
            </button>
          )}
        </div>
      )}

      {/* Status & Error Banners */}
      {feedbackMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/90 dark:bg-emerald-950/40 px-4 py-3 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search & Kind Filter */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by description, category, family member, or payment mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'All Types' },
            { id: 'expense', label: 'Expenses' },
            { id: 'income', label: 'Income' },
            { id: 'savings', label: 'Savings Contrib.' },
            { id: 'emi', label: 'Loan EMIs' },
            { id: 'transfer', label: 'Self Transfers' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id as typeof filterKind)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                filterKind === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Feed */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Matching Transactions ({filtered.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            Tap Edit (✎) or Delete (🗑) on any entry
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No transactions match your search or filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((tx) => {
              const isPositive = tx.kind === 'income';
              const isNeutral = tx.kind === 'transfer' || tx.kind === 'savings';

              return (
                <div
                  key={tx.id}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                        {tx.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{formatDateDDMMMYYYY(tx.date)}</span>
                        <span>•</span>
                        <span>{tx.subtitle}</span>
                        {tx.familyMember && (
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium">
                            {tx.familyMember}
                          </span>
                        )}
                        {tx.paymentMode && (
                          <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium">
                            {tx.paymentMode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <div className="text-right">
                      <p
                        className={`text-xs font-bold sm:text-sm ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isNeutral
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? '+' : '-'}
                        {formatINR(tx.amount)}
                      </p>
                      <p className="text-[10px] text-slate-400">{tx.accountName}</p>
                    </div>

                    {/* Direct Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tx)}
                        title="Edit Transaction"
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (demoMode) {
                            setErrorMsg(
                              'Demo Mode is active. Switch off Demo Mode to delete real transactions.'
                            );
                            return;
                          }
                          setDeletingTx(tx);
                        }}
                        title="Delete Transaction"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-300 p-1.5 text-rose-600 dark:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          EDIT TRANSACTION MODAL (Supports Expense, Income, Savings, EMI, Transfer)
          ===================================================================== */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Edit {editingTx.kind.toUpperCase()} Transaction
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingTx.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* EXPENSE SPECIFIC FIELDS */}
              {editingTx.kind === 'expense' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Category
                      </label>
                      <select
                        value={editCategoryId}
                        onChange={(e) => {
                          setEditCategoryId(e.target.value);
                          const nextCat = categories.find((c) => c.id === e.target.value);
                          if (nextCat && nextCat.subcategories.length > 0) {
                            setEditSubcategory(nextCat.subcategories[0]);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.group})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Subcategory
                      </label>
                      <select
                        value={editSubcategory}
                        onChange={(e) => setEditSubcategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {(selectedEditCategory?.subcategories || ['General']).map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Family Member
                      </label>
                      <select
                        value={editFamilyMemberId}
                        onChange={(e) => {
                          setEditFamilyMemberId(e.target.value);
                          const fm = familyMembers.find((f) => f.id === e.target.value);
                          if (fm) setEditPaidBy(fm.relationship);
                        }}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {familyMembers.map((fm) => (
                          <option key={fm.id} value={fm.id}>
                            {fm.name} ({fm.relationship})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={editPaymentMode}
                        onChange={(e) => setEditPaymentMode(e.target.value as PaymentMode)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {PAYMENT_MODES.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Bank / Cash Account
                      </label>
                      <select
                        value={editAccountId}
                        onChange={(e) => setEditAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        required
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* INCOME SPECIFIC FIELDS */}
              {editingTx.kind === 'income' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Income Type
                      </label>
                      <select
                        value={editIncomeType}
                        onChange={(e) => setEditIncomeType(e.target.value as IncomeType)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        <option value="salary">Monthly Salary</option>
                        <option value="bonus">Bonus / Incentive</option>
                        <option value="interest">Bank / FD Interest</option>
                        <option value="freelance">Freelance / Consulting</option>
                        <option value="other">Other Income</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Salary / Income Month
                      </label>
                      <input
                        type="month"
                        required
                        value={editSalaryMonth}
                        onChange={(e) => setEditSalaryMonth(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Employer / Source
                      </label>
                      <input
                        type="text"
                        required
                        value={editEmployer}
                        onChange={(e) => setEditEmployer(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        value={editIncomeStatus}
                        onChange={(e) =>
                          setEditIncomeStatus(e.target.value as 'credited' | 'pending')
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        <option value="credited">Credited (Received)</option>
                        <option value="pending">Pending (Expected)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Destination Bank Account
                      </label>
                      <select
                        value={editAccountId}
                        onChange={(e) => setEditAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        required
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* SAVINGS CONTRIBUTION SPECIFIC FIELDS */}
              {editingTx.kind === 'savings' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Savings Goal
                      </label>
                      <select
                        value={editGoalId}
                        onChange={(e) => setEditGoalId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {savingsGoals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Contribution Type
                      </label>
                      <select
                        value={editContributionType}
                        onChange={(e) =>
                          setEditContributionType(
                            e.target.value as 'savings' | 'investment'
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        <option value="savings">Savings Allocation</option>
                        <option value="investment">Investment (SIP/MF/PPF)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Source Account
                      </label>
                      <select
                        value={editAccountId}
                        onChange={(e) => setEditAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Optional note..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* EMI PAYMENT SPECIFIC FIELDS */}
              {editingTx.kind === 'emi' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Principal Component (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={editPrincipalComp}
                        onChange={(e) => {
                          setEditPrincipalComp(e.target.value);
                          const total = Number(editAmount) || 0;
                          const p = Number(e.target.value) || 0;
                          if (total >= p) {
                            setEditInterestComp(String(Math.max(0, total - p)));
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Interest Component (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={editInterestComp}
                        onChange={(e) => setEditInterestComp(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* TRANSFER SPECIFIC FIELDS */}
              {editingTx.kind === 'transfer' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        From Account
                      </label>
                      <select
                        value={editFromAccountId}
                        onChange={(e) => setEditFromAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        To Account
                      </label>
                      <select
                        value={editToAccountId}
                        onChange={(e) => setEditToAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          DELETE CONFIRMATION MODAL
          ===================================================================== */}
      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete Transaction?
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingTx.title} ({formatINR(deletingTx.amount)})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              This will permanently remove this record from IndexedDB and automatically reverse its
              impact on your account balance, savings goal, or loan principal.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
