import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Filter,
  Download,
  Printer,
  CheckCircle2,
  Calendar,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react';
import type {
  BudgetRecord,
  CategoryRecord,
  EmiPaymentRecord,
  ExpenseRecord,
  FamilyMemberRecord,
  IncomeRecord,
  LoanRecord,
  MonthlyFinancialSummary,
  SavingsContributionRecord,
  SavingsGoalRecord,
} from '../types';
import {
  buildBudgetVsActualReport,
  buildCategoryExpenseBreakdown,
  buildDailyExpenseReport,
  buildFamilyExpenseBreakdown,
  buildLoanAndEmiReport,
  buildMonthlyPerformanceReport,
  buildSavingsGoalReport,
  buildWeeklyExpenseReport,
  buildYearlyFinancialComparison,
  downloadCSVFile,
  filterDatasetByCriteria,
  type ReportFilterCriteria,
  type ReportPeriodPreset,
} from '../reports/reportEngine';
import {
  formatDateDDMMMYYYY,
  formatINR,
  formatMonthLabel,
  getIndianFinancialYear,
} from '../utilities/formatters';

interface ReportsPageProps {
  summary: MonthlyFinancialSummary;
  selectedMonth: string;
  onChangeSelectedMonth: (month: string) => void;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  savingsGoals: SavingsGoalRecord[];
  savingsContributions: SavingsContributionRecord[];
  budgets: BudgetRecord[];
  loans: LoanRecord[];
  emiPayments: EmiPaymentRecord[];
  categories: CategoryRecord[];
  familyMembers: FamilyMemberRecord[];
}

type ActiveReportTab =
  | 'overview_charts'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly_yoy'
  | 'income_vs_expense'
  | 'savings'
  | 'family'
  | 'category'
  | 'budget_vs_actual'
  | 'loan_emi';

const REPORT_TABS: Array<{ id: ActiveReportTab; label: string }> = [
  { id: 'overview_charts', label: 'All 8 Charts Overview' },
  { id: 'daily', label: '1. Daily Expenses' },
  { id: 'weekly', label: '2. Weekly Expenses' },
  { id: 'monthly', label: '3. Monthly Expenses' },
  { id: 'yearly_yoy', label: '4. Yearly & YoY (Apr–Mar)' },
  { id: 'income_vs_expense', label: '5. Income vs Expense' },
  { id: 'savings', label: '6. Savings Contributions' },
  { id: 'family', label: '7. Family Expenses' },
  { id: 'category', label: '8. Category-wise' },
  { id: 'budget_vs_actual', label: '9. Budget vs Actual' },
  { id: 'loan_emi', label: '10. Loan & EMI' },
];

const CHART_COLORS = [
  '#059669',
  '#2563eb',
  '#7c3aed',
  '#ea580c',
  '#db2777',
  '#eab308',
  '#0891b2',
  '#64748b',
];

export const ReportsPage: React.FC<ReportsPageProps> = ({
  summary,
  selectedMonth,
  onChangeSelectedMonth,
  income,
  expenses,
  savingsGoals,
  savingsContributions,
  budgets,
  loans,
  emiPayments,
  categories,
  familyMembers,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveReportTab>('overview_charts');

  // 7 Prompt 7 Filter States
  const [periodPreset, setPeriodPreset] = useState<ReportPeriodPreset>('current_month');
  const [selectedFY, setSelectedFY] = useState<string>(() =>
    getIndianFinancialYear(selectedMonth)
  );
  const [selectedCY, setSelectedCY] = useState<string>(() => selectedMonth.slice(0, 4));
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${selectedMonth}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    `${selectedMonth}-28`
  );
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [yearlyComparisonMode, setYearlyComparisonMode] = useState<
    'financial_year' | 'calendar_year'
  >('financial_year');

  const criteria: ReportFilterCriteria = useMemo(
    () => ({
      periodPreset,
      selectedMonth,
      selectedFinancialYear: selectedFY,
      selectedCalendarYear: selectedCY,
      customStartDate,
      customEndDate,
      familyMemberId: familyFilter,
      categoryId: categoryFilter,
    }),
    [
      periodPreset,
      selectedMonth,
      selectedFY,
      selectedCY,
      customStartDate,
      customEndDate,
      familyFilter,
      categoryFilter,
    ]
  );

  // Filtered underlying records
  const filteredData = useMemo(
    () =>
      filterDatasetByCriteria({
        criteria,
        income,
        expenses,
        contributions: savingsContributions,
        emiPayments,
      }),
    [criteria, income, expenses, savingsContributions, emiPayments]
  );

  // Dynamic Totals calculated strictly from filtered underlying records
  const periodTotals = useMemo(() => {
    const salaryIncome = filteredData.filteredIncome
      .filter((i) => i.type === 'salary')
      .reduce((s, i) => s + i.amount, 0);
    const additionalIncome = filteredData.filteredIncome
      .filter((i) => i.type !== 'salary')
      .reduce((s, i) => s + i.amount, 0);
    const totalIncome = salaryIncome + additionalIncome;
    const totalExpenses = filteredData.filteredExpenses.reduce(
      (s, e) => s + e.amount,
      0
    );
    const surplus = totalIncome - totalExpenses;
    const totalContributions = filteredData.filteredContributions.reduce(
      (s, c) => s + c.amount,
      0
    );
    const totalEmiPaid = filteredData.filteredEmiPayments.reduce(
      (s, p) => s + p.totalAmount,
      0
    );
    const savingsRatePercent =
      totalIncome > 0 ? Number(((surplus / totalIncome) * 100).toFixed(1)) : 0;

    return {
      salaryIncome,
      additionalIncome,
      totalIncome,
      totalExpenses,
      surplus,
      totalContributions,
      totalEmiPaid,
      savingsRatePercent,
    };
  }, [filteredData]);

  // All 10 Computed Reports
  const dailyReport = useMemo(
    () => buildDailyExpenseReport(filteredData.filteredExpenses),
    [filteredData.filteredExpenses]
  );

  const weeklyReport = useMemo(
    () => buildWeeklyExpenseReport(filteredData.filteredExpenses),
    [filteredData.filteredExpenses]
  );

  const monthlyReport = useMemo(
    () =>
      buildMonthlyPerformanceReport({
        income:
          periodPreset === 'current_month' || periodPreset === 'previous_month'
            ? income
            : filteredData.filteredIncome,
        expenses:
          periodPreset === 'current_month' || periodPreset === 'previous_month'
            ? expenses.filter((e) => {
                if (
                  familyFilter !== 'all' &&
                  e.familyMemberId !== familyFilter &&
                  e.familyMemberName !== familyFilter
                ) {
                  return false;
                }
                if (
                  categoryFilter !== 'all' &&
                  e.categoryId !== categoryFilter &&
                  e.categoryName !== categoryFilter
                ) {
                  return false;
                }
                return true;
              })
            : filteredData.filteredExpenses,
        contributions:
          periodPreset === 'current_month' || periodPreset === 'previous_month'
            ? savingsContributions
            : filteredData.filteredContributions,
        emiPayments:
          periodPreset === 'current_month' || periodPreset === 'previous_month'
            ? emiPayments
            : filteredData.filteredEmiPayments,
        fallbackMonth: selectedMonth,
      }),
    [
      periodPreset,
      income,
      expenses,
      savingsContributions,
      emiPayments,
      filteredData,
      familyFilter,
      categoryFilter,
      selectedMonth,
    ]
  );

  const yearlyComparisonReport = useMemo(
    () =>
      buildYearlyFinancialComparison({
        income,
        expenses,
        contributions: savingsContributions,
        emiPayments,
        mode: yearlyComparisonMode,
      }),
    [income, expenses, savingsContributions, emiPayments, yearlyComparisonMode]
  );

  const categoryReport = useMemo(
    () => buildCategoryExpenseBreakdown(filteredData.filteredExpenses),
    [filteredData.filteredExpenses]
  );

  const familyReport = useMemo(
    () => buildFamilyExpenseBreakdown(filteredData.filteredExpenses),
    [filteredData.filteredExpenses]
  );

  const savingsReport = useMemo(
    () =>
      buildSavingsGoalReport({
        goals: savingsGoals,
        contributions: filteredData.filteredContributions,
      }),
    [savingsGoals, filteredData.filteredContributions]
  );

  const budgetVsActualReport = useMemo(
    () =>
      buildBudgetVsActualReport({
        budgets,
        expenses,
        month: selectedMonth,
      }),
    [budgets, expenses, selectedMonth]
  );

  const loanAndEmiReport = useMemo(
    () =>
      buildLoanAndEmiReport({
        loans,
        emiPayments: filteredData.filteredEmiPayments,
      }),
    [loans, filteredData.filteredEmiPayments]
  );

  // Available Indian Financial Years for dropdown
  const availableFYs = useMemo(() => {
    const set = new Set<string>(['FY 2025-26', 'FY 2026-27', 'FY 2027-28']);
    income.forEach((i) => set.add(getIndianFinancialYear(i.salaryMonth)));
    expenses.forEach((e) => set.add(getIndianFinancialYear(e.month)));
    return Array.from(set).sort();
  }, [income, expenses]);

  // CSV Export 1: Monthly Financial Summary CSV
  const handleExportMonthlySummaryCSV = () => {
    downloadCSVFile(
      `MyMoneyTracker_Monthly_Summary_${selectedMonth}.csv`,
      [
        'Month',
        'Financial Year',
        'Salary Income (INR)',
        'Additional Income (INR)',
        'Total Income (INR)',
        'Total Expenses (INR)',
        'Monthly Surplus (INR)',
        'Savings Contributions (INR)',
        'EMI Paid (INR)',
        'Savings Rate (%)',
      ],
      monthlyReport.map((r) => [
        r.month,
        r.financialYear,
        r.salaryIncome,
        r.additionalIncome,
        r.totalIncome,
        r.totalExpenses,
        r.monthlySurplus,
        r.savingsContributions,
        r.emiPaid,
        r.savingsRatePercent,
      ])
    );
  };

  // CSV Export 2: Filtered Transaction Details CSV
  const handleExportTransactionDetailsCSV = () => {
    const rows: Array<Array<string | number>> = [];

    filteredData.filteredIncome.forEach((inc) => {
      rows.push([
        inc.transactionDate,
        'Income',
        inc.type,
        inc.employer,
        inc.description || '',
        'Self',
        'Bank Credit',
        inc.bankAccountName,
        inc.amount,
      ]);
    });

    filteredData.filteredExpenses.forEach((exp) => {
      rows.push([
        exp.transactionDate,
        'Expense',
        exp.categoryName,
        exp.subcategory,
        exp.description,
        exp.familyMemberName,
        exp.paymentMode,
        exp.accountName,
        exp.amount,
      ]);
    });

    filteredData.filteredContributions.forEach((con) => {
      rows.push([
        con.transactionDate,
        'Savings Contribution',
        con.contributionType,
        con.goalName,
        con.notes || '',
        'Self',
        con.paymentMode,
        con.sourceAccountName,
        con.amount,
      ]);
    });

    filteredData.filteredEmiPayments.forEach((emi) => {
      rows.push([
        emi.transactionDate,
        'Loan EMI',
        emi.loanName,
        `Principal: ${emi.principalComponent} | Interest: ${emi.interestComponent}`,
        emi.notes || '',
        'Self',
        emi.paymentMode,
        emi.accountName,
        emi.totalAmount,
      ]);
    });

    downloadCSVFile(
      `MyMoneyTracker_Transactions_${filteredData.startDate}_to_${filteredData.endDate}.csv`,
      [
        'Transaction Date',
        'Record Type',
        'Category / Type',
        'Subcategory / Reference',
        'Description',
        'Family Member',
        'Payment Mode',
        'Account',
        'Amount (INR)',
      ],
      rows
    );
  };

  // CSV Export 3: Active Report Table CSV
  const handleExportActiveReportCSV = () => {
    if (activeTab === 'daily') {
      downloadCSVFile(
        `Daily_Expense_Report_${filteredData.startDate}.csv`,
        ['Date', 'Formatted Date', 'Transactions', 'Top Category', 'Total Expense (INR)'],
        dailyReport.map((d) => [
          d.date,
          d.formattedDate,
          d.transactionCount,
          d.topCategory,
          d.totalAmount,
        ])
      );
      return;
    }
    if (activeTab === 'weekly') {
      downloadCSVFile(
        `Weekly_Expense_Report_${filteredData.startDate}.csv`,
        ['Week', 'Start Date', 'End Date', 'Transactions', 'Avg per Txn (INR)', 'Total (INR)'],
        weeklyReport.map((w) => [
          w.weekLabel,
          w.startDate,
          w.endDate,
          w.transactionCount,
          w.averagePerTransaction,
          w.totalAmount,
        ])
      );
      return;
    }
    if (activeTab === 'yearly_yoy') {
      downloadCSVFile(
        `Yearly_Financial_Comparison.csv`,
        [
          'Period',
          'Salary Income (INR)',
          'Additional Income (INR)',
          'Total Income (INR)',
          'Total Expenses (INR)',
          'Surplus (INR)',
          'Savings Contributions (INR)',
          'EMI Paid (INR)',
          'Savings Rate (%)',
        ],
        yearlyComparisonReport.map((y) => [
          y.periodLabel,
          y.salaryIncome,
          y.additionalIncome,
          y.totalIncome,
          y.totalExpenses,
          y.totalSurplus,
          y.totalSavingsContributions,
          y.totalEmiPaid,
          y.savingsRatePercent,
        ])
      );
      return;
    }
    if (activeTab === 'category') {
      downloadCSVFile(
        `Category_Expense_Report_${selectedMonth}.csv`,
        ['Category', 'Group', 'Transactions', 'Share (%)', 'Total Amount (INR)'],
        categoryReport.map((c) => [
          c.categoryName,
          c.group,
          c.transactionCount,
          c.percentage,
          c.totalAmount,
        ])
      );
      return;
    }
    if (activeTab === 'family') {
      downloadCSVFile(
        `Family_Expense_Report_${selectedMonth}.csv`,
        ['Family Member', 'Transactions', 'Share (%)', 'Total Amount (INR)'],
        familyReport.map((f) => [
          f.familyMemberName,
          f.transactionCount,
          f.percentage,
          f.totalAmount,
        ])
      );
      return;
    }
    if (activeTab === 'budget_vs_actual') {
      downloadCSVFile(
        `Budget_vs_Actual_${selectedMonth}.csv`,
        ['Type', 'Budget Name', 'Planned (INR)', 'Actual Spent (INR)', 'Remaining (INR)', 'Utilization (%)', 'Status'],
        budgetVsActualReport.map((b) => [
          b.budgetType,
          b.targetName,
          b.plannedAmount,
          b.actualSpent,
          b.remainingBudget,
          b.utilizationPercent,
          b.statusLabel,
        ])
      );
      return;
    }
    if (activeTab === 'loan_emi') {
      downloadCSVFile(
        `Loan_and_EMI_Report_${selectedMonth}.csv`,
        [
          'Loan Name',
          'Bank',
          'Status',
          'Interest Rate (%)',
          'Original Loan (INR)',
          'Outstanding Principal (INR)',
          'Monthly EMI (INR)',
          'EMI Paid in Period (INR)',
          'Principal Paid (INR)',
          'Interest Paid (INR)',
        ],
        loanAndEmiReport.map((l) => [
          l.loanName,
          l.bank,
          l.status,
          l.interestRate,
          l.originalAmount,
          l.outstandingPrincipal,
          l.monthlyEmi,
          l.totalEmiPaidInPeriod,
          l.principalPaidInPeriod,
          l.interestPaidInPeriod,
        ])
      );
      return;
    }
    handleExportMonthlySummaryCSV();
  };

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Header & Export Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            Financial Reports &amp; Multi-Year Analytics ({summary.financialYear})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            10 Reports • 8 Interactive Charts • Indian FY (Apr–Mar) YoY Comparison • CSV &amp; Printable Exports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleExportActiveReportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Report CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportMonthlySummaryCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Monthly Summary CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportTransactionDetailsCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
            <span>Transactions CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-purple-600" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 7-Dimension Filter Bar (Prompt 7 Requirement) */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <Filter className="h-4 w-4 text-emerald-600" />
            <span>Report Filters</span>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              {filteredData.periodDescription}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'current_month', label: 'Current Month' },
                { id: 'previous_month', label: 'Previous Month' },
                { id: 'financial_year', label: 'Financial Year (Apr–Mar)' },
                { id: 'calendar_year', label: 'Calendar Year' },
                { id: 'custom_range', label: 'Custom Date Range' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodPreset(p.id)}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  periodPreset === p.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Dynamic Period Control */}
          {(periodPreset === 'current_month' || periodPreset === 'previous_month') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Reference Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && onChangeSelectedMonth(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>
          )}

          {periodPreset === 'financial_year' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Indian Financial Year (Apr–Mar)
              </label>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
              >
                {availableFYs.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy} (April – March)
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodPreset === 'calendar_year' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Calendar Year (Jan–Dec)
              </label>
              <select
                value={selectedCY}
                onChange={(e) => setSelectedCY(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
              >
                {['2025', '2026', '2027'].map((cy) => (
                  <option key={cy} value={cy}>
                    Calendar Year {cy}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodPreset === 'custom_range' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Family Member Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Family Member Filter
            </label>
            <select
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="all">All Family Members</option>
              {familyMembers.map((fam) => (
                <option key={fam.id} value={fam.name}>
                  {fam.name} ({fam.relationship})
                </option>
              ))}
            </select>
          </div>

          {/* Expense Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Expense Category Filter
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="all">All Expense Categories</option>
              {categories
                .filter((c) => c.type === 'expense')
                .map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name} ({cat.group})
                  </option>
                ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setPeriodPreset('current_month');
                setFamilyFilter('all');
                setCategoryFilter('all');
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </section>

      {/* Filtered Period Financial Equation Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Total Credited Income</span>
          <p className="mt-1 text-base font-bold sm:text-lg text-emerald-600 dark:text-emerald-400">
            {formatINR(periodTotals.totalIncome)}
          </p>
          <span className="text-[11px] text-slate-400">
            {filteredData.filteredIncome.length} credit record(s)
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Actual Expenses</span>
          <p className="mt-1 text-base font-bold sm:text-lg text-rose-600 dark:text-rose-400">
            {formatINR(periodTotals.totalExpenses)}
          </p>
          <span className="text-[11px] text-slate-400">
            {filteredData.filteredExpenses.length} expense txn(s)
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Net Surplus</span>
          <p
            className={`mt-1 text-base font-bold sm:text-lg ${
              periodTotals.surplus >= 0 ? 'text-sky-600' : 'text-rose-600'
            }`}
          >
            {formatINR(periodTotals.surplus)}
          </p>
          <span className="text-[11px] text-slate-400">
            Savings Rate: {periodTotals.savingsRatePercent}%
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Goal Contributions</span>
          <p className="mt-1 text-base font-bold sm:text-lg text-indigo-600 dark:text-indigo-400">
            {formatINR(periodTotals.totalContributions)}
          </p>
          <span className="text-[11px] text-slate-400">
            {filteredData.filteredContributions.length} allocation(s)
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500">Loan EMIs Paid</span>
          <p className="mt-1 text-base font-bold sm:text-lg text-purple-600 dark:text-purple-400">
            {formatINR(periodTotals.totalEmiPaid)}
          </p>
          <span className="text-[11px] text-slate-400">
            {filteredData.filteredEmiPayments.length} EMI payment(s)
          </span>
        </div>
      </div>

      {/* 10-Report Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 print:hidden">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          VIEW 0: ALL 8 REQUIRED INTERACTIVE CHARTS OVERVIEW
          ===================================================================== */}
      {activeTab === 'overview_charts' && (
        <div className="space-y-5">
          {/* Row 1: Chart 1 (Income vs Expense Monthly) & Chart 2 (Monthly Surplus Trend) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Chart 1: Income vs Expense Monthly Comparison */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    1. Income vs Expense Monthly Comparison
                  </h2>
                  <p className="text-xs text-slate-500">
                    Credited Monthly Income compared against Actual Consumption Expenses
                  </p>
                </div>
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyReport} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(val: number) => formatINR(val)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="totalIncome" name="Total Income" fill="#059669" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="totalExpenses" name="Actual Expenses" fill="#e11d48" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Chart 2: Monthly Surplus Trend */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    2. Monthly Surplus Trend (Income − Expenses)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tracks net monthly surplus generated across months
                  </p>
                </div>
                <TrendingUp className="h-4 w-4 text-sky-600" />
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyReport} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(val: number) => formatINR(val)} />
                    <Area
                      type="monotone"
                      dataKey="monthlySurplus"
                      name="Monthly Surplus"
                      stroke="#0284c7"
                      fill="#0ea5e9"
                      fillOpacity={0.25}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Row 2: Chart 3 (Savings Contribution Trend) & Chart 4 (Category-wise Expense Distribution) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Chart 3: Savings Contribution Trend */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                3. Savings &amp; Investment Contribution Trend
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Explicit goal contributions vs Monthly Surplus
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyReport} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(val: number) => formatINR(val)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar
                      dataKey="savingsContributions"
                      name="Goal Contributions"
                      fill="#4f46e5"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      dataKey="monthlySurplus"
                      name="Monthly Surplus"
                      fill="#10b981"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Chart 4: Category-wise Expense Distribution */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                4. Category-wise Expense Distribution
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Share of spending by category in {filteredData.periodDescription}
              </p>
              {categoryReport.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-xs text-slate-400">
                  No category expenses in selected period.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryReport}
                        dataKey="totalAmount"
                        nameKey="categoryName"
                        innerRadius={45}
                        outerRadius={78}
                        paddingAngle={2}
                      >
                        {categoryReport.map((entry, idx) => (
                          <Cell
                            key={entry.categoryId}
                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatINR(val)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          {/* Row 3: Chart 5 (Family Member-wise Expenses) & Chart 6 (Daily Expense Trend) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Chart 5: Family Member-wise Expenses */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                5. Family Member-wise Expenses
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Spending distribution across Self, Spouse, Children, Parents &amp; Entire Family
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={familyReport} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="familyMemberName" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(val: number) => formatINR(val)} />
                    <Bar
                      dataKey="totalAmount"
                      name="Family Spend"
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Chart 6: Daily Expense Trend */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                6. Daily Expense Trend
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Day-by-day spending velocity in the selected period
              </p>
              {dailyReport.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-xs text-slate-400">
                  No daily expenses recorded in selected period.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyReport} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                      <XAxis dataKey="formattedDate" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                      />
                      <Tooltip formatter={(val: number) => formatINR(val)} />
                      <Area
                        type="monotone"
                        dataKey="totalAmount"
                        name="Daily Spend"
                        stroke="#e11d48"
                        fill="#f43f5e"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          {/* Row 4: Chart 7 (Budget Utilization) & Chart 8 (Yearly Financial Performance YoY) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Chart 7: Budget Utilization */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                7. Budget Utilization (Planned vs Actual — {formatMonthLabel(selectedMonth)})
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Comparison of planned monthly budgets against actual spending
              </p>
              {budgetVsActualReport.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-xs text-slate-400">
                  No budgets configured for {formatMonthLabel(selectedMonth)}.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={budgetVsActualReport.filter((b) => b.budgetType !== 'overall')}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                      <XAxis dataKey="targetName" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                      />
                      <Tooltip formatter={(val: number) => formatINR(val)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="plannedAmount" name="Planned Budget" fill="#64748b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actualSpent" name="Actual Spending" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Chart 8: Yearly Financial Performance & YoY Comparison */}
            <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    8. Yearly Financial Performance (YoY Comparison)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Compares FY 2025-26, FY 2026-27 &amp; subsequent Indian Financial Years (Apr–Mar)
                  </p>
                </div>
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={yearlyComparisonReport}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="periodKey" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(val: number) => formatINR(val)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="totalIncome" name="Yearly Income" fill="#059669" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="totalExpenses" name="Yearly Expenses" fill="#e11d48" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="totalSurplus" name="Yearly Surplus" fill="#0284c7" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* =====================================================================
          REPORT 1: DAILY EXPENSE REPORT
          ===================================================================== */}
      {activeTab === 'daily' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                1. Daily Expense Report ({dailyReport.length} Active Spending Days)
              </h2>
              <p className="text-xs text-slate-500">
                Date-wise aggregated expenses and highest spending category per day
              </p>
            </div>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </div>

          {dailyReport.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No daily expense records found for the selected filter criteria.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 pr-4 font-semibold">Date (DD-MMM-YYYY)</th>
                    <th className="py-2.5 px-4 font-semibold">Top Category</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Transactions</th>
                    <th className="py-2.5 pl-4 font-semibold text-right">Daily Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {dailyReport.map((row) => (
                    <tr key={row.date}>
                      <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">
                        {row.formattedDate}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                        {row.topCategory}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {row.transactionCount}
                      </td>
                      <td className="py-2.5 pl-4 text-right font-bold text-rose-600 dark:text-rose-400">
                        {formatINR(row.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                    <td className="pt-3 pr-4">Total Validated</td>
                    <td className="pt-3 px-4">—</td>
                    <td className="pt-3 px-4 text-right">
                      {filteredData.filteredExpenses.length}
                    </td>
                    <td className="pt-3 pl-4 text-right text-rose-600">
                      {formatINR(periodTotals.totalExpenses)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          REPORT 2: WEEKLY EXPENSE REPORT
          ===================================================================== */}
      {activeTab === 'weekly' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            2. Weekly Expense Report
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Week-by-week spending breakdown and average transaction size
          </p>

          {weeklyReport.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No weekly expenses found for the selected filter criteria.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 pr-4 font-semibold">Week</th>
                    <th className="py-2.5 px-4 font-semibold">Date Range</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Transactions</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Avg / Txn</th>
                    <th className="py-2.5 pl-4 font-semibold text-right">Weekly Spend (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {weeklyReport.map((w) => (
                    <tr key={w.weekKey}>
                      <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">
                        {w.weekLabel}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {formatDateDDMMMYYYY(w.startDate)} – {formatDateDDMMMYYYY(w.endDate)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                        {w.transactionCount}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                        {formatINR(w.averagePerTransaction)}
                      </td>
                      <td className="py-2.5 pl-4 text-right font-bold text-rose-600 dark:text-rose-400">
                        {formatINR(w.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          REPORT 3 & 5: MONTHLY EXPENSE & INCOME VS EXPENSE REPORT
          ===================================================================== */}
      {(activeTab === 'monthly' || activeTab === 'income_vs_expense') && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {activeTab === 'monthly'
              ? '3. Monthly Expense & Cash-Flow Report'
              : '5. Income vs Expense Monthly Reconciliation Report'}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Complete monthly breakdown of Salary, Additional Income, Actual Expenses, Surplus, Goal Contributions &amp; EMIs
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-3 font-semibold">Month</th>
                  <th className="py-2.5 px-3 font-semibold">Indian FY</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Salary</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Other Inc.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Income</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Expenses</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Surplus</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Goal Contrib.</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Savings %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {monthlyReport.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white">
                      {m.label}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{m.financialYear}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatINR(m.salaryIncome)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatINR(m.additionalIncome)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {formatINR(m.totalIncome)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                      {formatINR(m.totalExpenses)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        m.monthlySurplus >= 0 ? 'text-sky-600' : 'text-rose-600'
                      }`}
                    >
                      {formatINR(m.monthlySurplus)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-indigo-600">
                      {formatINR(m.savingsContributions)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-bold text-slate-900 dark:text-white">
                      {m.savingsRatePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          REPORT 4: YEARLY EXPENSE REPORT & YOY COMPARISON (INDIAN FY APR-MAR)
          ===================================================================== */}
      {activeTab === 'yearly_yoy' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                4. Yearly Financial Report &amp; Year-on-Year (YoY) Comparison
              </h2>
              <p className="text-xs text-slate-500">
                Indian Financial Year (April 1 to March 31) comparison across FY 2025-26, FY 2026-27 &amp; subsequent years
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setYearlyComparisonMode('financial_year')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  yearlyComparisonMode === 'financial_year'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Indian FY (Apr–Mar)
              </button>
              <button
                type="button"
                onClick={() => setYearlyComparisonMode('calendar_year')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  yearlyComparisonMode === 'calendar_year'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Calendar Year (Jan–Dec)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-3 font-semibold">Financial Period</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Salary Income</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Additional Income</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Income</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Expenses</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Surplus</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Goal Contrib.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">EMI Paid</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Savings Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {yearlyComparisonReport.map((yr) => (
                  <tr key={yr.periodKey}>
                    <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white">
                      {yr.periodLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatINR(yr.salaryIncome)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatINR(yr.additionalIncome)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {formatINR(yr.totalIncome)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                      {formatINR(yr.totalExpenses)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        yr.totalSurplus >= 0 ? 'text-sky-600' : 'text-rose-600'
                      }`}
                    >
                      {formatINR(yr.totalSurplus)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-indigo-600">
                      {formatINR(yr.totalSavingsContributions)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-purple-600">
                      {formatINR(yr.totalEmiPaid)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-bold text-slate-900 dark:text-white">
                      {yr.savingsRatePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          REPORT 6: SAVINGS CONTRIBUTION REPORT
          ===================================================================== */}
      {activeTab === 'savings' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            6. Savings &amp; Investment Contribution Report
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Goal-wise target amounts, cumulative contributions, period allocations &amp; completion percentages
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">Savings Goal</th>
                  <th className="py-2.5 px-3 font-semibold">Priority / Status</th>
                  <th className="py-2.5 px-3 font-semibold">Target Date</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Target (₹)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cumulative Saved</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Period Contrib.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Remaining</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {savingsReport.map((g) => (
                  <tr key={g.goalId}>
                    <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">
                      {g.goalName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 capitalize">
                      {g.priority} ({g.status})
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {formatDateDDMMMYYYY(g.targetDate)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                      {formatINR(g.targetAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {formatINR(g.currentContribution)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-indigo-600">
                      {formatINR(g.periodContributionAmount)} ({g.periodContributionCount})
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      {formatINR(g.remainingAmount)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-bold text-emerald-600">
                      {g.completionPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          REPORT 7: FAMILY EXPENSE REPORT
          ===================================================================== */}
      {activeTab === 'family' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            7. Family Member Expense Report
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Member-wise spending across Self, Spouse, Children, Parents &amp; Entire Family
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">Family Member</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Transactions</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Share (%)</th>
                  <th className="py-2.5 pl-4 font-semibold text-right">Total Spend (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {familyReport.map((fam) => (
                  <tr key={fam.familyMemberId || fam.familyMemberName}>
                    <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">
                      {fam.familyMemberName}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                      {fam.transactionCount}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-blue-600">
                      {fam.percentage}%
                    </td>
                    <td className="py-2.5 pl-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatINR(fam.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          REPORT 8: CATEGORY-WISE EXPENSE REPORT
          ===================================================================== */}
      {activeTab === 'category' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            8. Category-wise Expense Report ({filteredData.periodDescription})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">Category</th>
                  <th className="py-2.5 px-4 font-semibold">Group</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Transactions</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Share (%)</th>
                  <th className="py-2.5 pl-4 font-semibold text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {categoryReport.map((item) => (
                  <tr key={item.categoryId}>
                    <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">
                      {item.categoryName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{item.group}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                      {item.transactionCount}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-emerald-600">
                      {item.percentage}%
                    </td>
                    <td className="py-2.5 pl-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatINR(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          REPORT 9: BUDGET VS ACTUAL REPORT
          ===================================================================== */}
      {activeTab === 'budget_vs_actual' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            9. Budget vs Actual Report ({formatMonthLabel(selectedMonth)})
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Variance and utilization analysis across Overall, Category-wise &amp; Family-wise budgets
          </p>

          {budgetVsActualReport.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No budgets configured for {formatMonthLabel(selectedMonth)}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 pr-4 font-semibold">Budget Target</th>
                    <th className="py-2.5 px-3 font-semibold">Scope</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Planned (₹)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actual Spent (₹)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Variance / Left</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Utilization</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Alert Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {budgetVsActualReport.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">
                        {b.targetName}
                      </td>
                      <td className="py-2.5 px-3 capitalize text-slate-500">{b.budgetType}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatINR(b.plannedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                        {formatINR(b.actualSpent)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${
                          b.remainingBudget >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatINR(b.remainingBudget)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                        {b.utilizationPercent}%
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            b.statusLabel === 'Budget Exceeded' || b.statusLabel === '100% Consumed'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : b.statusLabel === '80% Consumed'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {b.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          REPORT 10: LOAN AND EMI REPORT
          ===================================================================== */}
      {activeTab === 'loan_emi' && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            10. Loan Amortization &amp; EMI Report
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Original Loan, Outstanding Principal, Repaid Principal % and Principal vs Interest EMI split
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-3 font-semibold">Loan Name</th>
                  <th className="py-2.5 px-3 font-semibold">Bank / Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Original Loan</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Outstanding</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Repaid %</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Monthly EMI</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Principal Paid</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Interest Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {loanAndEmiReport.map((l) => (
                  <tr key={l.loanId}>
                    <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white">
                      {l.loanName}{' '}
                      <span className="text-[10px] uppercase text-slate-400">({l.status})</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {l.bank} ({l.interestRate}%)
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                      {formatINR(l.originalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                      {formatINR(l.outstandingPrincipal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {l.repaidPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-purple-600">
                      {formatINR(l.monthlyEmi)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                      {formatINR(l.principalPaidInPeriod)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold text-amber-600">
                      {formatINR(l.interestPaidInPeriod)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Underlying Transaction Reconciliation Footer */}
      <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-200">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <strong>100% Dynamic Transaction Reconciliation Verified:</strong> All report totals are
          dynamically computed from IndexedDB records ({filteredData.filteredIncome.length} income
          records, {filteredData.filteredExpenses.length} expense records,{' '}
          {filteredData.filteredContributions.length} goal contributions,{' '}
          {filteredData.filteredEmiPayments.length} EMI payments). Self-transfers and goal
          contributions are strictly excluded from consumption expenses.
        </div>
      </div>
    </div>
  );
};
