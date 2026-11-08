import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { initializeDatabaseFoundation } from '../database/seed';
import { getDemoDataset } from '../services/demoDataService';
import {
  calculateMonthlyFinancialSummary,
  summarizeSavingsGoals,
} from '../calculations/financialCalculations';
import {
  buildCategoryExpenseBreakdown,
  buildFamilyExpenseBreakdown,
} from '../reports/reportEngine';
import {
  formatMonthLabel,
  getCurrentMonthYYYYMM,
  getIndianFinancialYear,
} from '../utilities/formatters';
import type { MonthlyTrendPoint, UnifiedTransactionItem } from '../types/navigation';

export function useFinanceData(selectedMonth = getCurrentMonthYYYYMM()) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    initializeDatabaseFoundation()
      .then(() => {
        if (active) setIsReady(true);
      })
      .catch(() => {
        if (active) setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const dbState = useLiveQuery(async () => {
    const [
      settings,
      categories,
      familyMembers,
      accounts,
      income,
      expenses,
      savingsGoals,
      savingsContributions,
      loans,
      emiPayments,
      budgets,
      transfers,
    ] = await Promise.all([
      db.appSettings.get('default'),
      db.categories.toArray(),
      db.familyMembers.toArray(),
      db.accounts.toArray(),
      db.income.toArray(),
      db.expenses.toArray(),
      db.savingsGoals.toArray(),
      db.savingsContributions.toArray(),
      db.loans.toArray(),
      db.emiPayments.toArray(),
      db.budgets.toArray(),
      db.transfers.toArray(),
    ]);

    return {
      settings,
      categories,
      familyMembers,
      accounts,
      income,
      expenses,
      savingsGoals,
      savingsContributions,
      loans,
      emiPayments,
      budgets,
      transfers,
    };
  }, [isReady]);

  const demoMode = Boolean(dbState?.settings?.demoMode);
  const theme = dbState?.settings?.theme ?? 'light';

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const demoData = useMemo(
    () => (demoMode ? getDemoDataset(selectedMonth) : null),
    [demoMode, selectedMonth]
  );

  // Strictly separate Demo records from Real User IndexedDB records
  const activeIncome = demoMode && demoData ? demoData.income : (dbState?.income ?? []);
  const activeExpenses =
    demoMode && demoData ? demoData.expenses : (dbState?.expenses ?? []);
  const activeGoals =
    demoMode && demoData ? demoData.savingsGoals : (dbState?.savingsGoals ?? []);
  const activeContributions =
    demoMode && demoData
      ? demoData.savingsContributions
      : (dbState?.savingsContributions ?? []);
  const activeLoans = demoMode && demoData ? demoData.loans : (dbState?.loans ?? []);
  const activeEmiPayments =
    demoMode && demoData ? demoData.emiPayments : (dbState?.emiPayments ?? []);
  const activeBudgets =
    demoMode && demoData ? demoData.budgets : (dbState?.budgets ?? []);
  const activeTransfers =
    demoMode && demoData ? demoData.transfers : (dbState?.transfers ?? []);
  const activeAccounts =
    demoMode && demoData ? demoData.accounts : (dbState?.accounts ?? []);
  const activeFamilyMembers =
    demoMode && demoData ? demoData.familyMembers : (dbState?.familyMembers ?? []);
  const activeCategories = dbState?.categories ?? [];

  const monthlySummary = useMemo(
    () =>
      calculateMonthlyFinancialSummary({
        month: selectedMonth,
        incomeRecords: activeIncome,
        expenseRecords: activeExpenses,
        contributionRecords: activeContributions,
        emiRecords: activeEmiPayments,
        transferRecords: activeTransfers,
        accounts: activeAccounts,
      }),
    [
      selectedMonth,
      activeIncome,
      activeExpenses,
      activeContributions,
      activeEmiPayments,
      activeTransfers,
      activeAccounts,
    ]
  );

  // Total Monthly EMI commitment across active loans
  const { totalMonthlyEmiCommitment, totalOutstandingLoanPrincipal } = useMemo(() => {
    const activeOnly = activeLoans.filter((l) => l.status === 'active');
    return {
      totalMonthlyEmiCommitment: activeOnly.reduce((sum, l) => sum + l.monthlyEmi, 0),
      totalOutstandingLoanPrincipal: activeOnly.reduce(
        (sum, l) => sum + l.outstandingPrincipal,
        0
      ),
    };
  }, [activeLoans]);

  const { categoryBreakdown, familyBreakdown } = useMemo(() => {
    const monthExpenses = activeExpenses.filter((e) => e.month === selectedMonth);
    return {
      categoryBreakdown: buildCategoryExpenseBreakdown(monthExpenses),
      familyBreakdown: buildFamilyExpenseBreakdown(monthExpenses),
    };
  }, [activeExpenses, selectedMonth]);

  const goalsSummary = useMemo(() => summarizeSavingsGoals(activeGoals), [activeGoals]);

  // Build unified transactions feed sorted newest first
  const unifiedTransactions: UnifiedTransactionItem[] = useMemo(
    () =>
      [
        ...activeIncome.map((inc): UnifiedTransactionItem => ({
          id: inc.id,
          date: inc.transactionDate,
          title: inc.description || `${inc.employer} (${inc.type})`,
          subtitle: inc.employer,
          category: inc.type === 'salary' ? 'Monthly Salary' : `Income • ${inc.type}`,
          accountName: inc.bankAccountName,
          amount: inc.amount,
          kind: 'income',
          status: inc.status,
        })),
        ...activeExpenses.map((exp): UnifiedTransactionItem => ({
          id: exp.id,
          date: exp.transactionDate,
          title: exp.description || exp.subcategory || exp.categoryName,
          subtitle: `${exp.categoryName} • ${exp.subcategory}`,
          category: exp.categoryName,
          familyMember: exp.familyMemberName,
          paymentMode: exp.paymentMode,
          accountName: exp.accountName,
          amount: exp.amount,
          kind: 'expense',
          status: 'completed',
        })),
        ...activeContributions.map((con): UnifiedTransactionItem => ({
          id: con.id,
          date: con.transactionDate,
          title: `Goal: ${con.goalName}`,
          subtitle: con.notes || `${con.contributionType.toUpperCase()} Contribution`,
          category: 'Savings & Investments',
          paymentMode: con.paymentMode,
          accountName: con.sourceAccountName,
          amount: con.amount,
          kind: 'savings',
          status: 'completed',
        })),
        ...activeEmiPayments.map((emi): UnifiedTransactionItem => ({
          id: emi.id,
          date: emi.transactionDate,
          title: `EMI: ${emi.loanName}`,
          subtitle: `Principal ₹${emi.principalComponent.toLocaleString('en-IN')} + Interest ₹${emi.interestComponent.toLocaleString('en-IN')}`,
          category: 'Loan EMI',
          paymentMode: emi.paymentMode,
          accountName: emi.accountName,
          amount: emi.totalAmount,
          kind: 'emi',
          status: 'completed',
        })),
        ...activeTransfers.map((trf): UnifiedTransactionItem => ({
          id: trf.id,
          date: trf.transactionDate,
          title: trf.description || 'Self Account Transfer',
          subtitle: `${trf.fromAccountName} → ${trf.toAccountName}`,
          category: 'Self Transfer',
          accountName: trf.fromAccountName,
          amount: trf.amount,
          kind: 'transfer',
          status: 'completed',
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [
      activeIncome,
      activeExpenses,
      activeContributions,
      activeEmiPayments,
      activeTransfers,
    ]
  );

  // Build 6-month trend for Income vs Expense chart
  const monthlyTrend: MonthlyTrendPoint[] = useMemo(
    () =>
      demoMode && demoData
        ? demoData.monthlyTrend
        : buildRealMonthlyTrend(
            selectedMonth,
            activeIncome,
            activeExpenses,
            activeContributions
          ),
    [
      demoMode,
      demoData,
      selectedMonth,
      activeIncome,
      activeExpenses,
      activeContributions,
    ]
  );

  const toggleDemoMode = async (enabled?: boolean) => {
    const nextValue = typeof enabled === 'boolean' ? enabled : !demoMode;
    await db.appSettings.update('default', {
      demoMode: nextValue,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    await db.appSettings.update('default', {
      theme: nextTheme,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    isReady,
    demoMode,
    theme,
    selectedMonth,
    expectedSalaryCreditDay: dbState?.settings?.expectedSalaryCreditDay ?? 1,
    pinEnabled: Boolean(dbState?.settings?.pinEnabled),
    autoLockMinutes: dbState?.settings?.autoLockMinutes ?? 5,
    lastBackupDate: dbState?.settings?.lastBackupDate,
    financialYear: getIndianFinancialYear(selectedMonth),
    toggleDemoMode,
    toggleTheme,
    monthlySummary,
    totalMonthlyEmiCommitment,
    totalOutstandingLoanPrincipal,
    categoryBreakdown,
    familyBreakdown,
    goalsSummary,
    unifiedTransactions,
    monthlyTrend,
    categories: activeCategories,
    familyMembers: activeFamilyMembers,
    accounts: activeAccounts,
    income: activeIncome,
    expenses: activeExpenses,
    savingsGoals: activeGoals,
    savingsContributions: activeContributions,
    loans: activeLoans,
    emiPayments: activeEmiPayments,
    budgets: activeBudgets,
    transfers: activeTransfers,
  };
}

function buildRealMonthlyTrend(
  currentMonth: string,
  income: { salaryMonth: string; status: string; amount: number }[],
  expenses: { month: string; amount: number }[],
  contributions: { month: string; amount: number }[]
): MonthlyTrendPoint[] {
  const [year, month] = currentMonth.split('-').map(Number);
  const points: MonthlyTrendPoint[] = [];

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(year, month - 1 - offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = formatMonthLabel(ym).split(' ')[0];

    const incTotal = income
      .filter((i) => i.salaryMonth === ym && i.status === 'credited')
      .reduce((s, i) => s + i.amount, 0);
    const expTotal = expenses
      .filter((e) => e.month === ym)
      .reduce((s, e) => s + e.amount, 0);
    const savTotal = contributions
      .filter((c) => c.month === ym)
      .reduce((s, c) => s + c.amount, 0);

    points.push({
      month: ym,
      label,
      income: incTotal,
      expenses: expTotal,
      surplus: incTotal - expTotal,
      savings: savTotal,
    });
  }

  return points;
}
