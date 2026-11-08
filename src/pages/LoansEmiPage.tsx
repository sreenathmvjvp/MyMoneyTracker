import React, { useMemo, useState } from 'react';
import {
  Landmark,
  Calendar,
  ShieldAlert,
  Plus,
  CheckCircle2,
  Clock,
  Edit3,
  Trash2,
  X,
  Calculator,
  ReceiptText,
  ArrowUpRight,
} from 'lucide-react';
import type {
  AccountRecord,
  EmiPaymentRecord,
  LoanRecord,
  PaymentMode,
} from '../types';
import {
  formatDateDDMMMYYYY,
  formatINR,
  formatMonthLabel,
  getTodayISO,
} from '../utilities/formatters';
import { databaseService } from '../services/databaseService';

interface LoansEmiPageProps {
  loans: LoanRecord[];
  emiPayments: EmiPaymentRecord[];
  accounts: AccountRecord[];
  selectedMonth: string;
  onChangeSelectedMonth: (month: string) => void;
  totalMonthlyEmi: number;
  totalOutstandingPrincipal: number;
  demoMode: boolean;
  onDisableDemoMode: () => void;
}

const PAYMENT_MODES: PaymentMode[] = [
  'Bank Transfer',
  'UPI',
  'Debit Card',
  'Google Pay',
  'PhonePe',
  'Cash',
  'Credit Card',
];

function computeDueDateForMonth(monthYYYYMM: string, dueDay: number): string {
  const [y, m] = monthYYYYMM.split('-').map(Number);
  const maxDay = new Date(y, m, 0).getDate();
  const safeDay = Math.min(Math.max(1, dueDay), maxDay);
  return `${monthYYYYMM}-${String(safeDay).padStart(2, '0')}`;
}

function calculateStandardAmortizationSplit(
  outstandingPrincipal: number,
  annualInterestRate: number,
  monthlyEmi: number
): {
  interestComponent: number;
  principalComponent: number;
  totalEmi: number;
  remainingBalanceAfter: number;
} {
  if (outstandingPrincipal <= 0) {
    return {
      interestComponent: 0,
      principalComponent: 0,
      totalEmi: 0,
      remainingBalanceAfter: 0,
    };
  }
  const monthlyRate = annualInterestRate > 0 ? annualInterestRate / 100 / 12 : 0;
  const rawInterest = Math.round(outstandingPrincipal * monthlyRate);
  const interestComponent = Math.max(0, rawInterest);
  const rawPrincipal = Math.max(0, Math.round(monthlyEmi - interestComponent));
  const principalComponent = Math.min(outstandingPrincipal, rawPrincipal);
  const totalEmi = principalComponent + interestComponent;
  const remainingBalanceAfter = Math.max(
    0,
    Number((outstandingPrincipal - principalComponent).toFixed(2))
  );

  return {
    interestComponent,
    principalComponent,
    totalEmi,
    remainingBalanceAfter,
  };
}

export const LoansEmiPage: React.FC<LoansEmiPageProps> = ({
  loans,
  emiPayments,
  accounts,
  selectedMonth,
  onChangeSelectedMonth,
  totalMonthlyEmi,
  totalOutstandingPrincipal,
  demoMode,
  onDisableDemoMode,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [historyLoanFilter, setHistoryLoanFilter] = useState<string>('all');

  // Modals
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
  const [emiModalOpen, setEmiModalOpen] = useState(false);
  const [deleteLoanTarget, setDeleteLoanTarget] = useState<LoanRecord | null>(null);
  const [deleteEmiTarget, setDeleteEmiTarget] = useState<EmiPaymentRecord | null>(null);

  // Loan Form State (All 10 Prompt 6 fields)
  const [loanName, setLoanName] = useState('');
  const [bankName, setBankName] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [outstandingPrincipal, setOutstandingPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [monthlyEmi, setMonthlyEmi] = useState('');
  const [emiDueDay, setEmiDueDay] = useState('5');
  const [startDate, setStartDate] = useState('2024-04-01');
  const [expectedClosureDate, setExpectedClosureDate] = useState('2034-03-31');
  const [loanStatus, setLoanStatus] = useState<'active' | 'closed' | 'paused'>('active');

  // EMI Payment Form State
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [emiDate, setEmiDate] = useState(getTodayISO());
  const [emiTotalAmount, setEmiTotalAmount] = useState('');
  const [emiPrincipalComponent, setEmiPrincipalComponent] = useState('');
  const [emiInterestComponent, setEmiInterestComponent] = useState('');
  const [emiPaymentMode, setEmiPaymentMode] = useState<PaymentMode>('Bank Transfer');
  const [emiAccountId, setEmiAccountId] = useState(accounts[0]?.id ?? 'acc_primary_bank');
  const [emiNotes, setEmiNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeLoans = useMemo(
    () => loans.filter((l) => l.status === 'active'),
    [loans]
  );

  const filteredLoans = useMemo(() => {
    if (statusFilter === 'all') return loans;
    return loans.filter((l) => l.status === statusFilter);
  }, [loans, statusFilter]);

  const filteredEmiHistory = useMemo(() => {
    if (historyLoanFilter === 'all') return emiPayments;
    return emiPayments.filter((e) => e.loanId === historyLoanFilter);
  }, [emiPayments, historyLoanFilter]);

  // Upcoming & Monthly EMI schedule for selectedMonth
  const monthlyEmiSchedule = useMemo(() => {
    const today = getTodayISO();
    return activeLoans.map((loan) => {
      const dueDate = computeDueDateForMonth(selectedMonth, loan.emiDueDay);
      const paidRecord = emiPayments.find(
        (p) => p.loanId === loan.id && p.month === selectedMonth
      );
      const split = calculateStandardAmortizationSplit(
        loan.outstandingPrincipal,
        loan.interestRate,
        loan.monthlyEmi
      );
      const isOverdue = !paidRecord && dueDate < today;

      return {
        loan,
        dueDate,
        paidRecord,
        estimatedSplit: split,
        isOverdue,
      };
    });
  }, [activeLoans, emiPayments, selectedMonth]);

  const totalEmiPaidThisMonth = useMemo(
    () =>
      emiPayments
        .filter((e) => e.month === selectedMonth)
        .reduce((sum, e) => sum + e.totalAmount, 0),
    [emiPayments, selectedMonth]
  );

  const upcomingUnpaidCount = monthlyEmiSchedule.filter((s) => !s.paidRecord).length;

  // Open Add / Edit Loan Modal
  const openLoanModal = (loan?: LoanRecord) => {
    setFormError(null);
    if (loan) {
      setEditingLoan(loan);
      setLoanName(loan.name);
      setBankName(loan.bank);
      setOriginalAmount(String(loan.originalAmount));
      setOutstandingPrincipal(String(loan.outstandingPrincipal));
      setInterestRate(String(loan.interestRate));
      setMonthlyEmi(String(loan.monthlyEmi));
      setEmiDueDay(String(loan.emiDueDay));
      setStartDate(loan.startDate);
      setExpectedClosureDate(loan.expectedClosureDate);
      setLoanStatus(loan.status);
    } else {
      setEditingLoan(null);
      setLoanName('Home Loan');
      setBankName('SBI');
      setOriginalAmount('3500000');
      setOutstandingPrincipal('2850000');
      setInterestRate('8.5');
      setMonthlyEmi('30500');
      setEmiDueDay('5');
      setStartDate('2023-04-05');
      setExpectedClosureDate('2038-03-05');
      setLoanStatus('active');
    }
    setLoanModalOpen(true);
  };

  // Auto-calculate standard reducing-balance EMI inside Loan modal
  const handleCalculateEmiHelper = () => {
    const P = Number(originalAmount);
    const annualRate = Number(interestRate);
    if (!P || P <= 0) return;

    const start = new Date(startDate);
    const end = new Date(expectedClosureDate);
    const months = Math.max(
      1,
      (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth())
    );

    if (annualRate <= 0) {
      setMonthlyEmi(String(Math.round(P / months)));
      return;
    }

    const r = annualRate / 100 / 12;
    const factor = Math.pow(1 + r, months);
    const emi = Math.round((P * r * factor) / (factor - 1));
    if (Number.isFinite(emi) && emi > 0) {
      setMonthlyEmi(String(emi));
    }
  };

  // Open Record EMI Modal with auto-calculated Principal & Interest split
  const openRecordEmiModal = (loan: LoanRecord, defaultDate?: string) => {
    setFormError(null);
    setSelectedLoanId(loan.id);
    const targetDate =
      defaultDate ?? computeDueDateForMonth(selectedMonth, loan.emiDueDay);
    setEmiDate(targetDate);

    const split = calculateStandardAmortizationSplit(
      loan.outstandingPrincipal,
      loan.interestRate,
      loan.monthlyEmi
    );
    setEmiTotalAmount(String(split.totalEmi));
    setEmiPrincipalComponent(String(split.principalComponent));
    setEmiInterestComponent(String(split.interestComponent));
    setEmiPaymentMode('Bank Transfer');
    setEmiAccountId(accounts[0]?.id ?? 'acc_primary_bank');
    setEmiNotes(`Monthly EMI for ${formatMonthLabel(targetDate.slice(0, 7))}`);
    setEmiModalOpen(true);
  };

  const handleSelectLoanInEmiModal = (loanId: string) => {
    setSelectedLoanId(loanId);
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    const split = calculateStandardAmortizationSplit(
      loan.outstandingPrincipal,
      loan.interestRate,
      loan.monthlyEmi
    );
    setEmiTotalAmount(String(split.totalEmi));
    setEmiPrincipalComponent(String(split.principalComponent));
    setEmiInterestComponent(String(split.interestComponent));
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (demoMode) {
      onDisableDemoMode();
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: loanName,
        bank: bankName,
        originalAmount: Number(originalAmount),
        outstandingPrincipal: Number(outstandingPrincipal),
        interestRate: Number(interestRate),
        monthlyEmi: Number(monthlyEmi),
        emiDueDay: Number(emiDueDay),
        startDate,
        expectedClosureDate,
        status: loanStatus,
      };

      if (editingLoan) {
        await databaseService.updateLoan(editingLoan.id, payload);
        setFeedbackMsg(`Updated loan "${loanName}".`);
      } else {
        await databaseService.addLoan(payload);
        setFeedbackMsg(`Added new loan "${loanName}" (${bankName}).`);
      }
      setLoanModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save loan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEmiPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (demoMode) {
      onDisableDemoMode();
    }

    const selectedAccount = accounts.find((a) => a.id === emiAccountId);
    setIsSubmitting(true);
    try {
      const record = await databaseService.recordEmiPayment({
        loanId: selectedLoanId,
        transactionDate: emiDate,
        totalAmount: Number(emiTotalAmount),
        principalComponent: Number(emiPrincipalComponent),
        interestComponent: Number(emiInterestComponent),
        paymentMode: emiPaymentMode,
        accountId: emiAccountId,
        accountName: selectedAccount?.name ?? 'Primary Bank Account',
        notes: emiNotes,
      });

      setEmiModalOpen(false);
      setFeedbackMsg(
        `Recorded EMI of ${formatINR(record.totalAmount)} for ${
          record.loanName
        }. Principal reduced by ${formatINR(
          record.principalComponent
        )}; remaining loan balance is ${formatINR(record.remainingPrincipalAfter)}.`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record EMI payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteLoan = async () => {
    if (!deleteLoanTarget) return;
    try {
      await databaseService.deleteLoan(deleteLoanTarget.id);
      setFeedbackMsg(`Deleted loan "${deleteLoanTarget.name}".`);
      setDeleteLoanTarget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete loan.');
    }
  };

  const handleConfirmDeleteEmi = async () => {
    if (!deleteEmiTarget) return;
    try {
      await databaseService.deleteEmiPayment(deleteEmiTarget.id);
      setFeedbackMsg(
        `Deleted EMI payment for "${deleteEmiTarget.loanName}" and restored ${formatINR(
          deleteEmiTarget.principalComponent
        )} to outstanding principal.`
      );
      setDeleteEmiTarget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete EMI record.');
    }
  };

  const selectedLoanForModal = loans.find((l) => l.id === selectedLoanId);
  const projectedBalanceAfterModalEmi = selectedLoanForModal
    ? Math.max(
        0,
        Number(
          (
            selectedLoanForModal.outstandingPrincipal -
            (Number(emiPrincipalComponent) || 0)
          ).toFixed(2)
        )
      )
    : 0;

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            Loans & Monthly EMI Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track Original Loan, Outstanding Principal, Principal vs Interest amortization & upcoming EMIs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            aria-label="Select EMI Schedule Month"
            value={selectedMonth}
            onChange={(e) => e.target.value && onChangeSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
          />

          {activeLoans.length > 0 && (
            <button
              type="button"
              onClick={() => openRecordEmiModal(activeLoans[0])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 transition cursor-pointer"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              <span>Record EMI</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openLoanModal()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Loan</span>
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

      {/* 4-Card Loan Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Total Active Loans</span>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {activeLoans.length}
          </p>
          <span className="text-[11px] text-slate-400">
            {loans.filter((l) => l.status === 'closed').length} closed
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Outstanding Principal</span>
          <p className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
            {formatINR(totalOutstandingPrincipal)}
          </p>
          <span className="text-[11px] text-slate-400">Remaining loan balance</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Monthly EMI Commitment</span>
          <p className="mt-1 text-lg font-bold text-purple-600 dark:text-purple-400">
            {formatINR(totalMonthlyEmi)}
          </p>
          <span className="text-[11px] text-slate-400">
            Paid in {formatMonthLabel(selectedMonth).split(' ')[0]}: {formatINR(totalEmiPaidThisMonth)}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Upcoming EMIs</span>
          <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
            {upcomingUnpaidCount} Pending
          </p>
          <span className="text-[11px] text-slate-400">
            For {formatMonthLabel(selectedMonth)}
          </span>
        </div>
      </div>

      {/* Upcoming EMI Payments Schedule for Selected Month */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Upcoming & Scheduled EMI Payments ({formatMonthLabel(selectedMonth)})
              </h2>
              <p className="text-xs text-slate-500">
                1-tap EMI recording automatically splits Principal and Interest and reduces loan balance
              </p>
            </div>
          </div>
        </div>

        {monthlyEmiSchedule.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No active loans with scheduled EMIs. Click <strong>+ Add Loan</strong> to start tracking.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {monthlyEmiSchedule.map(({ loan, dueDate, paidRecord, estimatedSplit, isOverdue }) => (
              <div
                key={loan.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 ${
                  paidRecord
                    ? 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : isOverdue
                    ? 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {loan.name} ({loan.bank})
                    </p>
                    {paidRecord ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Paid
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        <Clock className="h-3 w-3" /> Due {formatDateDDMMMYYYY(dueDate)}
                      </span>
                    )}
                  </div>

                  {paidRecord ? (
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      Paid <strong>{formatINR(paidRecord.totalAmount)}</strong> on{' '}
                      {formatDateDDMMMYYYY(paidRecord.transactionDate)} (Principal:{' '}
                      {formatINR(paidRecord.principalComponent)} + Interest:{' '}
                      {formatINR(paidRecord.interestComponent)})
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      EMI: <strong className="text-slate-900 dark:text-white">{formatINR(loan.monthlyEmi)}</strong> • Est. Principal:{' '}
                      <span className="text-emerald-600 font-semibold">
                        {formatINR(estimatedSplit.principalComponent)}
                      </span>{' '}
                      • Interest:{' '}
                      <span className="text-amber-600 font-semibold">
                        {formatINR(estimatedSplit.interestComponent)}
                      </span>
                    </p>
                  )}
                </div>

                {!paidRecord && (
                  <button
                    type="button"
                    onClick={() => openRecordEmiModal(loan, dueDate)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                  >
                    <span>Pay EMI</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Loan-wise Summary Filter Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(['all', 'active', 'closed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {st} Loans (
              {st === 'all'
                ? loans.length
                : loans.filter((l) => l.status === st).length}
              )
            </button>
          ))}
        </div>
      </div>

      {/* Loan-wise Summary Cards */}
      {filteredLoans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-8 text-center">
          <p className="text-xs text-slate-500">No loans found for the selected filter.</p>
          <button
            type="button"
            onClick={() => openLoanModal()}
            className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
          >
            + Add First Loan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredLoans.map((loan) => {
            const repaidPrincipal = Math.max(
              0,
              loan.originalAmount - loan.outstandingPrincipal
            );
            const repaidPct =
              loan.originalAmount > 0
                ? Number(((repaidPrincipal / loan.originalAmount) * 100).toFixed(1))
                : 0;
            const loanEmis = emiPayments.filter((e) => e.loanId === loan.id);
            const cumulativeInterestPaid = loanEmis.reduce(
              (s, e) => s + e.interestComponent,
              0
            );
            const cumulativePrincipalPaid = loanEmis.reduce(
              (s, e) => s + e.principalComponent,
              0
            );

            return (
              <div
                key={loan.id}
                className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {loan.name}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            loan.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : loan.status === 'closed'
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {loan.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {loan.bank} • <strong>{loan.interestRate}% p.a.</strong> • EMI Due:{' '}
                        {loan.emiDueDay}th of month
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {loan.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => openRecordEmiModal(loan)}
                        className="rounded-xl bg-purple-50 dark:bg-purple-950/80 hover:bg-purple-100 px-2.5 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 cursor-pointer"
                      >
                        + EMI
                      </button>
                    )}
                    <button
                      type="button"
                      title="Edit Loan"
                      onClick={() => openLoanModal(loan)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete Loan"
                      onClick={() => setDeleteLoanTarget(loan)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Repayment Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">
                      Principal Repaid: <strong className="text-emerald-600">{formatINR(repaidPrincipal)}</strong> ({repaidPct}%)
                    </span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      Monthly EMI: {formatINR(loan.monthlyEmi)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-purple-600 transition-all"
                      style={{ width: `${Math.min(100, repaidPct)}%` }}
                    />
                  </div>
                </div>

                {/* Loan Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Original Loan</span>
                    <strong className="text-slate-900 dark:text-white">
                      {formatINR(loan.originalAmount)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Remaining Balance</span>
                    <strong className="text-rose-600 dark:text-rose-400">
                      {formatINR(loan.outstandingPrincipal)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">EMIs Recorded</span>
                    <strong className="text-slate-900 dark:text-white">
                      {loanEmis.length} ({formatINR(cumulativePrincipalPaid)} P)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Interest Paid</span>
                    <strong className="text-amber-600 dark:text-amber-400">
                      {formatINR(cumulativeInterestPaid)}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                  <span>Start Date: {formatDateDDMMMYYYY(loan.startDate)}</span>
                  <span>Expected Closure: {formatDateDDMMMYYYY(loan.expectedClosureDate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EMI Payment History Section */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              EMI Payment Ledger ({filteredEmiHistory.length})
            </h2>
            <p className="text-xs text-slate-500">
              Detailed breakdown of Total EMI Paid, Principal Component, Interest Component & Remaining Balance
            </p>
          </div>

          <select
            aria-label="Filter EMI History by Loan"
            value={historyLoanFilter}
            onChange={(e) => setHistoryLoanFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Loans ({emiPayments.length})</option>
            {loans.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.bank})
              </option>
            ))}
          </select>
        </div>

        {filteredEmiHistory.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No EMI payments recorded yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredEmiHistory.map((emi) => (
              <div
                key={emi.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/60 dark:border-slate-800"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {emi.loanName}
                    </p>
                    <span className="rounded bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      {formatDateDDMMMYYYY(emi.transactionDate)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {emi.paymentMode} • {emi.accountName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Principal Component:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {formatINR(emi.principalComponent)}
                    </strong>{' '}
                    • Interest Component:{' '}
                    <strong className="text-amber-600 dark:text-amber-400">
                      {formatINR(emi.interestComponent)}
                    </strong>
                    {emi.notes ? ` • ${emi.notes}` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      EMI Paid: {formatINR(emi.totalAmount)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Balance After:{' '}
                      <strong className="text-rose-600 dark:text-rose-400">
                        {formatINR(emi.remainingPrincipalAfter)}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    title="Delete EMI & Restore Principal"
                    onClick={() => setDeleteEmiTarget(emi)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 p-4 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <span>
          <strong>Amortization Integrity Rule:</strong> Outstanding loan principal is never blindly
          reduced by the full EMI amount; only the <strong>Principal Component</strong> reduces the
          remaining loan balance, and the loan automatically transitions to <strong>Closed</strong>{' '}
          when the balance reaches ₹0.
        </span>
      </div>

      {/* Add / Edit Loan Modal (10 Required Fields) */}
      {loanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingLoan ? `Edit Loan: ${editingLoan.name}` : 'Add New Loan'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Enter loan principal, interest rate, EMI schedule, and closure timeline
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoanModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!editingLoan && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['Home Loan', 'Car Loan', 'Personal Loan', 'Education Loan', 'Gold Loan'].map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLoanName(preset)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        loanName === preset
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
            )}

            <form onSubmit={handleSaveLoan} className="mt-4 space-y-3">
              {formError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    1. Loan Name
                  </label>
                  <input
                    type="text"
                    required
                    value={loanName}
                    onChange={(e) => setLoanName(e.target.value)}
                    placeholder="e.g. Home Loan"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    2. Bank / Lender
                  </label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. SBI, HDFC Bank"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    3. Original Loan Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    4. Outstanding Principal (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={outstandingPrincipal}
                    onChange={(e) => setOutstandingPrincipal(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    5. Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      6. Monthly EMI (₹)
                    </label>
                    <button
                      type="button"
                      onClick={handleCalculateEmiHelper}
                      title="Calculate EMI from Principal, Rate & Dates"
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-purple-600 hover:underline cursor-pointer"
                    >
                      <Calculator className="h-3 w-3" /> Calc
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={monthlyEmi}
                    onChange={(e) => setMonthlyEmi(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    7. EMI Due Day (1–31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={emiDueDay}
                    onChange={(e) => setEmiDueDay(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    8. Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    9. Expected Closure
                  </label>
                  <input
                    type="date"
                    required
                    value={expectedClosureDate}
                    onChange={(e) => setExpectedClosureDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    10. Loan Status
                  </label>
                  <select
                    value={loanStatus}
                    onChange={(e) =>
                      setLoanStatus(e.target.value as 'active' | 'closed' | 'paused')
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setLoanModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingLoan ? 'Update Loan' : 'Save Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record EMI Payment Modal (with Principal & Interest Split) */}
      {emiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Record Monthly EMI Payment
                </h3>
                <p className="text-[11px] text-slate-500">
                  Principal component reduces loan balance; interest is tracked separately
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEmiModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmiPayment} className="mt-4 space-y-3.5">
              {formError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Loan
                </label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => handleSelectLoanInEmiModal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {loans
                    .filter((l) => l.status === 'active' || l.id === selectedLoanId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.bank}) — Bal: {formatINR(l.outstandingPrincipal)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={emiDate}
                    onChange={(e) => setEmiDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total EMI Paid (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={emiTotalAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmiTotalAmount(val);
                      const numTotal = Number(val) || 0;
                      const numInt = Number(emiInterestComponent) || 0;
                      const nextPrincipal = Math.max(0, Number((numTotal - numInt).toFixed(2)));
                      setEmiPrincipalComponent(String(nextPrincipal));
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                    Principal Component (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={emiPrincipalComponent}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmiPrincipalComponent(val);
                      const numP = Number(val) || 0;
                      const numInt = Number(emiInterestComponent) || 0;
                      setEmiTotalAmount(String(Number((numP + numInt).toFixed(2))));
                    }}
                    className="w-full rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                    Interest Component (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={emiInterestComponent}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmiInterestComponent(val);
                      const numInt = Number(val) || 0;
                      const numP = Number(emiPrincipalComponent) || 0;
                      setEmiTotalAmount(String(Number((numP + numInt).toFixed(2))));
                    }}
                    className="w-full rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200"
                  />
                </div>
              </div>

              {/* Live Amortization Preview Box */}
              {selectedLoanForModal && (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Outstanding Principal:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {formatINR(selectedLoanForModal.outstandingPrincipal)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remaining Balance After EMI:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {formatINR(projectedBalanceAfterModalEmi)}
                    </strong>
                  </div>
                  {projectedBalanceAfterModalEmi === 0 && (
                    <p className="text-[11px] font-bold text-emerald-600 pt-1">
                      ★ This payment fully repays the principal and will mark the loan as CLOSED.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={emiPaymentMode}
                    onChange={(e) => setEmiPaymentMode(e.target.value as PaymentMode)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bank Account
                  </label>
                  <select
                    value={emiAccountId}
                    onChange={(e) => setEmiAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={emiNotes}
                  onChange={(e) => setEmiNotes(e.target.value)}
                  placeholder="Optional note"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEmiModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm EMI Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Loan Confirmation Modal */}
      {deleteLoanTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Delete Loan Record?
            </h3>
            <p className="text-xs text-slate-500">
              Delete <strong>{deleteLoanTarget.name}</strong> ({deleteLoanTarget.bank}) and its
              associated EMI payment history?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteLoanTarget(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLoan}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Delete Loan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete EMI Payment Confirmation Modal */}
      {deleteEmiTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Revert & Delete EMI Payment?
            </h3>
            <p className="text-xs text-slate-500">
              Deleting this EMI of <strong>{formatINR(deleteEmiTarget.totalAmount)}</strong> for{' '}
              <strong>{deleteEmiTarget.loanName}</strong> will restore{' '}
              <strong>{formatINR(deleteEmiTarget.principalComponent)}</strong> back to the loan&apos;s
              outstanding principal balance.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteEmiTarget(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEmi}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Revert EMI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
