import type {
  AccountRecord,
  EmiPaymentRecord,
  ExpenseRecord,
  IncomeRecord,
  MonthlyFinancialSummary,
  SavingsContributionRecord,
  SavingsGoalRecord,
  TransferRecord,
} from '../types';
import { getIndianFinancialYear } from '../utilities/formatters';

/**
 * Pure, deterministic financial calculation rules for My Money Tracker.
 *
 * Rules enforced:
 * 1. Total Income = Credited Salary + Credited Additional Income (Pending salary excluded).
 * 2. Total Expenses = Actual consumption expense records (Self-transfers & goal contributions excluded).
 * 3. Monthly Surplus = Total Income - Total Expenses.
 * 4. Savings Contributions = Explicit allocations to savings/investments (never auto-assumed from surplus).
 * 5. Unallocated Surplus = Monthly Surplus - Total Contributions.
 * 6. Available Cash Balance = Opening Balance + Total Credited Income - Cash Outflows.
 */
export function calculateMonthlyFinancialSummary(params: {
  month: string;
  incomeRecords: IncomeRecord[];
  expenseRecords: ExpenseRecord[];
  contributionRecords: SavingsContributionRecord[];
  emiRecords: EmiPaymentRecord[];
  transferRecords: TransferRecord[];
  accounts: AccountRecord[];
  openingCashBalanceOverride?: number;
}): MonthlyFinancialSummary {
  const {
    month,
    incomeRecords,
    expenseRecords,
    contributionRecords,
    emiRecords,
    transferRecords,
    accounts,
    openingCashBalanceOverride,
  } = params;

  const monthIncomes = incomeRecords.filter((rec) => rec.salaryMonth === month);

  const salaryCredited = monthIncomes
    .filter((rec) => rec.type === 'salary' && rec.status === 'credited')
    .reduce((sum, rec) => sum + rec.amount, 0);

  const additionalIncome = monthIncomes
    .filter((rec) => rec.type !== 'salary' && rec.status === 'credited')
    .reduce((sum, rec) => sum + rec.amount, 0);

  const pendingSalary = monthIncomes
    .filter((rec) => rec.status === 'pending')
    .reduce((sum, rec) => sum + rec.amount, 0);

  const totalIncome = salaryCredited + additionalIncome;

  const monthExpenses = expenseRecords.filter((rec) => rec.month === month);
  const totalExpenses = monthExpenses.reduce((sum, rec) => sum + rec.amount, 0);

  const monthlySurplus = totalIncome - totalExpenses;

  const monthContributions = contributionRecords.filter((rec) => rec.month === month);
  const savingsContributions = monthContributions
    .filter((rec) => rec.contributionType === 'savings')
    .reduce((sum, rec) => sum + rec.amount, 0);
  const investmentContributions = monthContributions
    .filter((rec) => rec.contributionType === 'investment')
    .reduce((sum, rec) => sum + rec.amount, 0);
  const totalContributions = savingsContributions + investmentContributions;

  const unallocatedSurplus = monthlySurplus - totalContributions;

  const savingsRatePercent =
    totalIncome > 0 ? Number(((monthlySurplus / totalIncome) * 100).toFixed(1)) : 0;

  const totalEmiPaid = emiRecords
    .filter((rec) => rec.month === month)
    .reduce((sum, rec) => sum + rec.totalAmount, 0);

  const selfTransfersTotal = transferRecords
    .filter((rec) => rec.month === month)
    .reduce((sum, rec) => sum + rec.amount, 0);

  const accountsOpeningTotal =
    typeof openingCashBalanceOverride === 'number'
      ? openingCashBalanceOverride
      : accounts
          .filter((acc) => acc.isActive)
          .reduce((sum, acc) => sum + acc.openingBalance, 0);

  // Available cash balance: Opening balance + Income - Cash Outflows
  // Note: Self-transfers between own accounts net to ₹0 across total available cash.
  const cashOutflows = totalExpenses + totalContributions;
  const availableCashBalance = accountsOpeningTotal + totalIncome - cashOutflows;

  return {
    month,
    financialYear: getIndianFinancialYear(month),
    salaryCredited,
    additionalIncome,
    pendingSalary,
    totalIncome,
    totalExpenses,
    monthlySurplus,
    savingsContributions,
    investmentContributions,
    totalContributions,
    unallocatedSurplus,
    savingsRatePercent,
    totalEmiPaid,
    selfTransfersTotal,
    availableCashBalance,
  };
}

/**
 * Computes progress metrics for a single savings goal or aggregate goals.
 */
export function calculateSavingsGoalMetrics(
  targetAmount: number,
  alreadyContributed: number,
  targetDate?: string
): {
  completionPercent: number;
  remainingAmount: number;
  monthsRemaining: number;
  requiredMonthlyContribution: number;
} {
  const safeTarget = Math.max(0, targetAmount);
  const safeContributed = Math.max(0, alreadyContributed);
  const remainingAmount = Math.max(0, safeTarget - safeContributed);
  const completionPercent =
    safeTarget > 0
      ? Number(Math.min(100, (safeContributed / safeTarget) * 100).toFixed(1))
      : 0;

  let monthsRemaining = 1;
  if (targetDate) {
    const now = new Date();
    const end = new Date(targetDate);
    if (!Number.isNaN(end.getTime())) {
      const diffMonths =
        (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
      monthsRemaining = Math.max(1, diffMonths);
    }
  }

  const requiredMonthlyContribution = Math.ceil(remainingAmount / monthsRemaining);

  return {
    completionPercent,
    remainingAmount,
    monthsRemaining,
    requiredMonthlyContribution,
  };
}

/**
 * Aggregates multiple SavingsGoalRecords for dashboard summary.
 */
export function summarizeSavingsGoals(goals: SavingsGoalRecord[]) {
  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');
  const totalTargetAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalContributed = goals.reduce((sum, g) => sum + g.currentContribution, 0);
  const remainingTargetAmount = Math.max(0, totalTargetAmount - totalContributed);
  const overallCompletionPercent =
    totalTargetAmount > 0
      ? Number(Math.min(100, (totalContributed / totalTargetAmount) * 100).toFixed(1))
      : 0;

  return {
    totalActiveGoals: activeGoals.length,
    totalCompletedGoals: completedGoals.length,
    totalTargetAmount,
    totalContributed,
    remainingTargetAmount,
    overallCompletionPercent,
  };
}
