import type {
  BudgetRecord,
  EmiPaymentRecord,
  ExpenseRecord,
  IncomeRecord,
  LoanRecord,
  SavingsContributionRecord,
  SavingsGoalRecord,
} from '../types';
import {
  formatDateDDMMMYYYY,
  formatMonthLabel,
  getIndianFinancialYear,
} from '../utilities/formatters';

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  group: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface FamilyBreakdownItem {
  familyMemberId: string;
  familyMemberName: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface DailyExpenseReportRow {
  date: string;
  formattedDate: string;
  totalAmount: number;
  transactionCount: number;
  topCategory: string;
}

export interface WeeklyExpenseReportRow {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  transactionCount: number;
  averagePerTransaction: number;
}

export interface MonthlyPerformanceReportRow {
  month: string;
  label: string;
  financialYear: string;
  salaryIncome: number;
  additionalIncome: number;
  totalIncome: number;
  totalExpenses: number;
  monthlySurplus: number;
  savingsContributions: number;
  emiPaid: number;
  savingsRatePercent: number;
  expenseCount: number;
}

export interface YearlyFinancialReportRow {
  periodKey: string;
  periodLabel: string;
  salaryIncome: number;
  additionalIncome: number;
  totalIncome: number;
  totalExpenses: number;
  totalSurplus: number;
  totalSavingsContributions: number;
  totalEmiPaid: number;
  savingsRatePercent: number;
  transactionCount: number;
}

export interface BudgetVsActualReportRow {
  id: string;
  budgetType: 'overall' | 'category' | 'family';
  targetName: string;
  plannedAmount: number;
  actualSpent: number;
  remainingBudget: number;
  utilizationPercent: number;
  statusLabel: 'Within Budget' | '80% Consumed' | '100% Consumed' | 'Budget Exceeded';
}

export interface LoanEmiReportRow {
  loanId: string;
  loanName: string;
  bank: string;
  status: string;
  interestRate: number;
  originalAmount: number;
  outstandingPrincipal: number;
  repaidPrincipal: number;
  repaidPercent: number;
  monthlyEmi: number;
  emiCount: number;
  totalEmiPaidInPeriod: number;
  principalPaidInPeriod: number;
  interestPaidInPeriod: number;
}

export type ReportPeriodPreset =
  | 'current_month'
  | 'previous_month'
  | 'financial_year'
  | 'calendar_year'
  | 'custom_range';

export interface ReportFilterCriteria {
  periodPreset: ReportPeriodPreset;
  selectedMonth: string; // YYYY-MM
  selectedFinancialYear: string; // e.g. "FY 2026-27"
  selectedCalendarYear: string; // e.g. "2026"
  customStartDate: string; // YYYY-MM-DD
  customEndDate: string; // YYYY-MM-DD
  familyMemberId: string; // 'all' or memberId/name
  categoryId: string; // 'all' or categoryId/name
}

/**
 * Returns [startDate, endDate] in YYYY-MM-DD for any ReportFilterCriteria.
 * Indian Financial Year runs from April 1 (YYYY-04-01) to March 31 ((YYYY+1)-03-31).
 */
export function resolveFilterDateRange(criteria: ReportFilterCriteria): {
  startDate: string;
  endDate: string;
  periodDescription: string;
} {
  if (criteria.periodPreset === 'current_month') {
    const [y, m] = criteria.selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      startDate: `${criteria.selectedMonth}-01`,
      endDate: `${criteria.selectedMonth}-${String(lastDay).padStart(2, '0')}`,
      periodDescription: `Current Month (${formatMonthLabel(criteria.selectedMonth)})`,
    };
  }

  if (criteria.periodPreset === 'previous_month') {
    const [y, m] = criteria.selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const lastDay = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate();
    return {
      startDate: `${prevYM}-01`,
      endDate: `${prevYM}-${String(lastDay).padStart(2, '0')}`,
      periodDescription: `Previous Month (${formatMonthLabel(prevYM)})`,
    };
  }

  if (criteria.periodPreset === 'financial_year') {
    // Parse "FY 2026-27" -> startYear = 2026, endYear = 2027
    const match = criteria.selectedFinancialYear.match(/(\d{4})/);
    const startYear = match ? Number(match[1]) : new Date().getFullYear();
    const endYear = startYear + 1;
    return {
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
      periodDescription: `Indian Financial Year ${criteria.selectedFinancialYear} (01-Apr-${startYear} to 31-Mar-${endYear})`,
    };
  }

  if (criteria.periodPreset === 'calendar_year') {
    const yr = Number(criteria.selectedCalendarYear) || new Date().getFullYear();
    return {
      startDate: `${yr}-01-01`,
      endDate: `${yr}-12-31`,
      periodDescription: `Calendar Year ${yr} (01-Jan-${yr} to 31-Dec-${yr})`,
    };
  }

  // custom_range
  const start = criteria.customStartDate || `${criteria.selectedMonth}-01`;
  const end = criteria.customEndDate || `${criteria.selectedMonth}-31`;
  return {
    startDate: start <= end ? start : end,
    endDate: start <= end ? end : start,
    periodDescription: `Custom Range (${formatDateDDMMMYYYY(start)} to ${formatDateDDMMMYYYY(end)})`,
  };
}

/**
 * Filters expenses, income, savings contributions, and EMI payments according to the 7 Prompt 7 filters.
 */
export function filterDatasetByCriteria(params: {
  criteria: ReportFilterCriteria;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  contributions: SavingsContributionRecord[];
  emiPayments: EmiPaymentRecord[];
}) {
  const { startDate, endDate, periodDescription } = resolveFilterDateRange(params.criteria);
  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);

  const filteredIncome = params.income.filter((inc) => {
    if (inc.status !== 'credited') return false;
    const txDate = inc.transactionDate || `${inc.salaryMonth}-01`;
    return (
      (txDate >= startDate && txDate <= endDate) ||
      (inc.salaryMonth >= startMonth && inc.salaryMonth <= endMonth)
    );
  });

  const filteredExpenses = params.expenses.filter((exp) => {
    const inDate = exp.transactionDate >= startDate && exp.transactionDate <= endDate;
    if (!inDate) return false;

    if (params.criteria.familyMemberId !== 'all') {
      const target = params.criteria.familyMemberId.toLowerCase();
      const matchFamily =
        exp.familyMemberId.toLowerCase() === target ||
        exp.familyMemberName.toLowerCase() === target ||
        exp.paidBy.toLowerCase() === target;
      if (!matchFamily) return false;
    }

    if (params.criteria.categoryId !== 'all') {
      const targetCat = params.criteria.categoryId.toLowerCase();
      const matchCat =
        exp.categoryId.toLowerCase() === targetCat ||
        exp.categoryName.toLowerCase() === targetCat;
      if (!matchCat) return false;
    }

    return true;
  });

  const filteredContributions = params.contributions.filter(
    (con) => con.transactionDate >= startDate && con.transactionDate <= endDate
  );

  const filteredEmiPayments = params.emiPayments.filter(
    (emi) => emi.transactionDate >= startDate && emi.transactionDate <= endDate
  );

  return {
    startDate,
    endDate,
    periodDescription,
    filteredIncome,
    filteredExpenses,
    filteredContributions,
    filteredEmiPayments,
  };
}

/**
 * Aggregates expenses by category with percentage breakdown.
 */
export function buildCategoryExpenseBreakdown(
  expenses: ExpenseRecord[]
): CategoryBreakdownItem[] {
  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const map = new Map<string, CategoryBreakdownItem>();

  for (const exp of expenses) {
    const existing = map.get(exp.categoryId);
    if (existing) {
      existing.totalAmount += exp.amount;
      existing.transactionCount += 1;
    } else {
      map.set(exp.categoryId, {
        categoryId: exp.categoryId,
        categoryName: exp.categoryName,
        group: exp.categoryGroup,
        totalAmount: exp.amount,
        transactionCount: 1,
        percentage: 0,
      });
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      percentage:
        grandTotal > 0 ? Number(((item.totalAmount / grandTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Aggregates expenses by family member (Self, Spouse, Children, Parents, Entire Family).
 */
export function buildFamilyExpenseBreakdown(
  expenses: ExpenseRecord[]
): FamilyBreakdownItem[] {
  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const map = new Map<string, FamilyBreakdownItem>();

  for (const exp of expenses) {
    const key = exp.familyMemberId || exp.familyMemberName;
    const existing = map.get(key);
    if (existing) {
      existing.totalAmount += exp.amount;
      existing.transactionCount += 1;
    } else {
      map.set(key, {
        familyMemberId: exp.familyMemberId,
        familyMemberName: exp.familyMemberName,
        totalAmount: exp.amount,
        transactionCount: 1,
        percentage: 0,
      });
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      percentage:
        grandTotal > 0 ? Number(((item.totalAmount / grandTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * 1. Daily Expense Report
 */
export function buildDailyExpenseReport(
  expenses: ExpenseRecord[]
): DailyExpenseReportRow[] {
  const byDate = new Map<
    string,
    { total: number; count: number; catTotals: Map<string, number> }
  >();

  for (const exp of expenses) {
    const entry = byDate.get(exp.transactionDate) ?? {
      total: 0,
      count: 0,
      catTotals: new Map<string, number>(),
    };
    entry.total += exp.amount;
    entry.count += 1;
    entry.catTotals.set(
      exp.categoryName,
      (entry.catTotals.get(exp.categoryName) ?? 0) + exp.amount
    );
    byDate.set(exp.transactionDate, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, data]) => {
      let topCategory = 'General';
      let maxCatAmt = -1;
      data.catTotals.forEach((amt, cat) => {
        if (amt > maxCatAmt) {
          maxCatAmt = amt;
          topCategory = cat;
        }
      });

      return {
        date,
        formattedDate: formatDateDDMMMYYYY(date),
        totalAmount: data.total,
        transactionCount: data.count,
        topCategory,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 2. Weekly Expense Report
 */
export function buildWeeklyExpenseReport(
  expenses: ExpenseRecord[]
): WeeklyExpenseReportRow[] {
  const byWeek = new Map<
    string,
    {
      weekLabel: string;
      startDate: string;
      endDate: string;
      totalAmount: number;
      transactionCount: number;
    }
  >();

  for (const exp of expenses) {
    const [y, m, d] = exp.transactionDate.split('-').map(Number);
    const weekOfMonth = Math.min(5, Math.floor((d - 1) / 7) + 1);
    const startDay = (weekOfMonth - 1) * 7 + 1;
    const maxMonthDay = new Date(y, m, 0).getDate();
    const endDay = weekOfMonth === 5 ? maxMonthDay : Math.min(maxMonthDay, startDay + 6);

    const ym = exp.transactionDate.slice(0, 7);
    const startDate = `${ym}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${ym}-${String(endDay).padStart(2, '0')}`;
    const weekKey = `${ym}-W${weekOfMonth}`;
    const monthShort = formatMonthLabel(ym).split(' ')[0];
    const weekLabel = `${monthShort} W${weekOfMonth} (${String(startDay).padStart(2, '0')}–${String(
      endDay
    ).padStart(2, '0')})`;

    const existing = byWeek.get(weekKey);
    if (existing) {
      existing.totalAmount += exp.amount;
      existing.transactionCount += 1;
    } else {
      byWeek.set(weekKey, {
        weekLabel,
        startDate,
        endDate,
        totalAmount: exp.amount,
        transactionCount: 1,
      });
    }
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, item]) => ({
      weekKey,
      weekLabel: item.weekLabel,
      startDate: item.startDate,
      endDate: item.endDate,
      totalAmount: item.totalAmount,
      transactionCount: item.transactionCount,
      averagePerTransaction:
        item.transactionCount > 0
          ? Math.round(item.totalAmount / item.transactionCount)
          : 0,
    }));
}

/**
 * 3 & 5. Monthly Expense & Income vs Expense Report
 */
export function buildMonthlyPerformanceReport(params: {
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  contributions: SavingsContributionRecord[];
  emiPayments: EmiPaymentRecord[];
  fallbackMonth?: string;
}): MonthlyPerformanceReportRow[] {
  const monthsSet = new Set<string>();
  params.income
    .filter((i) => i.status === 'credited')
    .forEach((i) => monthsSet.add(i.salaryMonth));
  params.expenses.forEach((e) => monthsSet.add(e.month));
  params.contributions.forEach((c) => monthsSet.add(c.month));
  params.emiPayments.forEach((p) => monthsSet.add(p.month));

  if (monthsSet.size === 0 && params.fallbackMonth) {
    monthsSet.add(params.fallbackMonth);
  }

  return Array.from(monthsSet)
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      const mInc = params.income.filter(
        (i) => i.salaryMonth === month && i.status === 'credited'
      );
      const salaryIncome = mInc
        .filter((i) => i.type === 'salary')
        .reduce((s, i) => s + i.amount, 0);
      const additionalIncome = mInc
        .filter((i) => i.type !== 'salary')
        .reduce((s, i) => s + i.amount, 0);
      const totalIncome = salaryIncome + additionalIncome;

      const mExp = params.expenses.filter((e) => e.month === month);
      const directExpenses = mExp.reduce((s, e) => s + e.amount, 0);

      const emiPaid = params.emiPayments
        .filter((p) => p.month === month)
        .reduce((s, p) => s + p.totalAmount, 0);

      const totalExpenses = directExpenses + emiPaid;
      const monthlySurplus = totalIncome - totalExpenses;

      const savingsContributions = params.contributions
        .filter((c) => c.month === month)
        .reduce((s, c) => s + c.amount, 0);

      const savingsRatePercent =
        totalIncome > 0
          ? Number(((monthlySurplus / totalIncome) * 100).toFixed(1))
          : 0;

      return {
        month,
        label: formatMonthLabel(month),
        financialYear: getIndianFinancialYear(month),
        salaryIncome,
        additionalIncome,
        totalIncome,
        totalExpenses,
        monthlySurplus,
        savingsContributions,
        emiPaid,
        savingsRatePercent,
        expenseCount: mExp.length,
      };
    });
}

/**
 * 4. Yearly Financial Report & Year-on-Year (YoY) Comparison (Indian FY April–March)
 * Always includes FY 2025-26 and FY 2026-27 (plus any subsequent financial years in the database)
 * so YoY comparison is always available.
 */
export function buildYearlyFinancialComparison(params: {
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  contributions: SavingsContributionRecord[];
  emiPayments: EmiPaymentRecord[];
  mode: 'financial_year' | 'calendar_year';
}): YearlyFinancialReportRow[] {
  const keysSet = new Set<string>();

  if (params.mode === 'financial_year') {
    keysSet.add('FY 2025-26');
    keysSet.add('FY 2026-27');
  } else {
    keysSet.add('2025');
    keysSet.add('2026');
  }

  const getKey = (monthYYYYMM: string) =>
    params.mode === 'financial_year'
      ? getIndianFinancialYear(monthYYYYMM)
      : monthYYYYMM.slice(0, 4);

  params.income
    .filter((i) => i.status === 'credited')
    .forEach((i) => keysSet.add(getKey(i.salaryMonth)));
  params.expenses.forEach((e) => keysSet.add(getKey(e.month)));
  params.contributions.forEach((c) => keysSet.add(getKey(c.month)));
  params.emiPayments.forEach((p) => keysSet.add(getKey(p.month)));

  return Array.from(keysSet)
    .sort((a, b) => a.localeCompare(b))
    .map((periodKey) => {
      const incList = params.income.filter(
        (i) => i.status === 'credited' && getKey(i.salaryMonth) === periodKey
      );
      const expList = params.expenses.filter((e) => getKey(e.month) === periodKey);
      const conList = params.contributions.filter((c) => getKey(c.month) === periodKey);
      const emiList = params.emiPayments.filter((p) => getKey(p.month) === periodKey);

      const salaryIncome = incList
        .filter((i) => i.type === 'salary')
        .reduce((s, i) => s + i.amount, 0);
      const additionalIncome = incList
        .filter((i) => i.type !== 'salary')
        .reduce((s, i) => s + i.amount, 0);
      const totalIncome = salaryIncome + additionalIncome;
      const directExpenses = expList.reduce((s, e) => s + e.amount, 0);
      const totalEmiPaid = emiList.reduce((s, p) => s + p.totalAmount, 0);
      const totalExpenses = directExpenses + totalEmiPaid;
      const totalSurplus = totalIncome - totalExpenses;
      const totalSavingsContributions = conList.reduce((s, c) => s + c.amount, 0);
      const savingsRatePercent =
        totalIncome > 0
          ? Number(((totalSurplus / totalIncome) * 100).toFixed(1))
          : 0;

      return {
        periodKey,
        periodLabel:
          params.mode === 'financial_year' ? `${periodKey} (Apr–Mar)` : `CY ${periodKey}`,
        salaryIncome,
        additionalIncome,
        totalIncome,
        totalExpenses,
        totalSurplus,
        totalSavingsContributions,
        totalEmiPaid,
        savingsRatePercent,
        transactionCount:
          incList.length + expList.length + conList.length + emiList.length,
      };
    });
}

/**
 * 9. Budget vs Actual Report
 */
export function buildBudgetVsActualReport(params: {
  budgets: BudgetRecord[];
  expenses: ExpenseRecord[];
  month: string;
}): BudgetVsActualReportRow[] {
  const monthBudgets = params.budgets.filter((b) => b.month === params.month);
  const monthExpenses = params.expenses.filter((e) => e.month === params.month);
  const totalMonthSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);

  return monthBudgets.map((bgt) => {
    let actualSpent = 0;
    if (bgt.budgetType === 'overall') {
      actualSpent = totalMonthSpent;
    } else if (bgt.budgetType === 'category') {
      const targetLower = bgt.targetName.toLowerCase();
      actualSpent = monthExpenses
        .filter((e) => {
          if (
            e.categoryId === bgt.targetId ||
            e.categoryName.toLowerCase() === targetLower
          ) {
            return true;
          }
          if (
            targetLower === 'groceries' &&
            (e.categoryId === 'cat_groceries' || e.categoryId === 'cat_vegetables')
          ) {
            return true;
          }
          if (
            targetLower === 'school fees' &&
            (e.categoryId === 'cat_school_fees' || e.categoryId === 'cat_children_edu')
          ) {
            return true;
          }
          if (
            targetLower === 'transportation' &&
            (e.categoryId === 'cat_transport' || e.categoryId === 'cat_fuel')
          ) {
            return true;
          }
          if (
            targetLower === 'shopping' &&
            (e.categoryId === 'cat_family_shopping' ||
              e.categoryId === 'cat_personal_shopping' ||
              e.categoryId === 'cat_clothing')
          ) {
            return true;
          }
          if (
            targetLower === 'entertainment' &&
            (e.categoryId === 'cat_entertainment' || e.categoryId === 'cat_restaurants')
          ) {
            return true;
          }
          if (targetLower === 'other expenses' && e.categoryId === 'cat_misc') {
            return true;
          }
          return false;
        })
        .reduce((s, e) => s + e.amount, 0);
    } else {
      actualSpent = monthExpenses
        .filter(
          (e) =>
            e.familyMemberId === bgt.targetId ||
            e.familyMemberName.toLowerCase() === bgt.targetName.toLowerCase() ||
            e.paidBy.toLowerCase() === bgt.targetName.toLowerCase()
        )
        .reduce((s, e) => s + e.amount, 0);
    }

    const remainingBudget = bgt.plannedAmount - actualSpent;
    const utilizationPercent =
      bgt.plannedAmount > 0
        ? Number(((actualSpent / bgt.plannedAmount) * 100).toFixed(1))
        : 0;

    let statusLabel: BudgetVsActualReportRow['statusLabel'] = 'Within Budget';
    if (utilizationPercent > 100) statusLabel = 'Budget Exceeded';
    else if (utilizationPercent === 100) statusLabel = '100% Consumed';
    else if (utilizationPercent >= 80) statusLabel = '80% Consumed';

    return {
      id: bgt.id,
      budgetType: bgt.budgetType,
      targetName: bgt.targetName,
      plannedAmount: bgt.plannedAmount,
      actualSpent,
      remainingBudget,
      utilizationPercent,
      statusLabel,
    };
  });
}

/**
 * 10. Loan and EMI Report
 */
export function buildLoanAndEmiReport(params: {
  loans: LoanRecord[];
  emiPayments: EmiPaymentRecord[];
}): LoanEmiReportRow[] {
  return params.loans.map((loan) => {
    const loanEmis = params.emiPayments.filter((p) => p.loanId === loan.id);
    const totalEmiPaidInPeriod = loanEmis.reduce((s, p) => s + p.totalAmount, 0);
    const principalPaidInPeriod = loanEmis.reduce((s, p) => s + p.principalComponent, 0);
    const interestPaidInPeriod = loanEmis.reduce((s, p) => s + p.interestComponent, 0);
    const repaidPrincipal = Math.max(0, loan.originalAmount - loan.outstandingPrincipal);
    const repaidPercent =
      loan.originalAmount > 0
        ? Number(((repaidPrincipal / loan.originalAmount) * 100).toFixed(1))
        : 0;

    return {
      loanId: loan.id,
      loanName: loan.name,
      bank: loan.bank,
      status: loan.status,
      interestRate: loan.interestRate,
      originalAmount: loan.originalAmount,
      outstandingPrincipal: loan.outstandingPrincipal,
      repaidPrincipal,
      repaidPercent,
      monthlyEmi: loan.monthlyEmi,
      emiCount: loanEmis.length,
      totalEmiPaidInPeriod,
      principalPaidInPeriod,
      interestPaidInPeriod,
    };
  });
}

/**
 * 6. Savings Contribution Report helper
 */
export function buildSavingsGoalReport(params: {
  goals: SavingsGoalRecord[];
  contributions: SavingsContributionRecord[];
}) {
  return params.goals.map((goal) => {
    const periodContribs = params.contributions.filter((c) => c.goalId === goal.id);
    const periodAmount = periodContribs.reduce((s, c) => s + c.amount, 0);
    const remaining = Math.max(0, goal.targetAmount - goal.currentContribution);
    const completionPct =
      goal.targetAmount > 0
        ? Number(
            Math.min(100, (goal.currentContribution / goal.targetAmount) * 100).toFixed(1)
          )
        : 0;

    return {
      goalId: goal.id,
      goalName: goal.name,
      priority: goal.priority,
      status: goal.status,
      targetDate: goal.targetDate,
      targetAmount: goal.targetAmount,
      currentContribution: goal.currentContribution,
      remainingAmount: remaining,
      completionPct,
      periodContributionAmount: periodAmount,
      periodContributionCount: periodContribs.length,
    };
  });
}

/**
 * Downloads a CSV file directly on the user's device (100% client-side).
 */
export function downloadCSVFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
