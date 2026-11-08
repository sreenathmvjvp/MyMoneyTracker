/**
 * Core Type Definitions for My Money Tracker
 * Storage: 100% Local IndexedDB via Dexie.js
 * Currency: INR (₹) | Date Format: DD-MMM-YYYY (stored as ISO YYYY-MM-DD for sorting/indexing)
 */

export interface BaseRecord {
  /** Unique identifier (UUID v4 or deterministic key) */
  id: string;
  /** ISO 8601 timestamp when record was created */
  createdAt: string;
  /** ISO 8601 timestamp when record was last updated */
  updatedAt: string;
  /** Relevant transaction or effective date in YYYY-MM-DD format (displayed as DD-MMM-YYYY) */
  transactionDate: string;
}

export type IncomeType = 'salary' | 'bonus' | 'interest' | 'freelance' | 'other';
export type IncomeStatus = 'credited' | 'pending';

/**
 * Table 1: income
 * Stores monthly salary credits and additional income (bonus, interest, freelance, other).
 * Business Rule: Expected/pending salary is stored with status='pending' and excluded from actual income totals.
 */
export interface IncomeRecord extends BaseRecord {
  type: IncomeType;
  /** YYYY-MM format representing the salary/income month */
  salaryMonth: string;
  /** Credit date (YYYY-MM-DD) when actually credited */
  transactionDate: string;
  /** Optional expected credit date (YYYY-MM-DD) for pending salaries */
  expectedCreditDate?: string;
  /** Only 'credited' records count toward Actual Income */
  status: IncomeStatus;
  /** Monetary amount in INR (₹) */
  amount: number;
  /** Employer name or income source */
  employer: string;
  /** Linked bank account ID */
  accountId: string;
  /** Display name of the bank account */
  bankAccountName: string;
  /** Short description */
  description: string;
  /** Additional remarks or notes */
  remarks?: string;
  /** Deterministic fingerprint to prevent accidental duplicate entries */
  fingerprint: string;
}

export type PaymentMode =
  | 'Cash'
  | 'UPI'
  | 'Google Pay'
  | 'PhonePe'
  | 'Debit Card'
  | 'Credit Card'
  | 'Bank Transfer';

export type CategoryGroup = 'Household' | 'Family' | 'Financial' | 'Personal' | 'Custom';

export type FamilyAssociation = 'Self' | 'Spouse' | 'Children' | 'Parents' | 'Entire Family' | string;

/**
 * Table 2: expenses
 * Stores daily personal and family consumption expenses.
 * Business Rule: Self-account transfers and savings/investment contributions are NOT stored as expenses.
 */
export interface ExpenseRecord extends BaseRecord {
  /** Expense date in YYYY-MM-DD format */
  transactionDate: string;
  /** YYYY-MM derived from transactionDate for indexed monthly queries */
  month: string;
  /** Reference to categories.id */
  categoryId: string;
  /** Category name (e.g., Groceries, Rent, Medical) */
  categoryName: string;
  /** High-level category group */
  categoryGroup: CategoryGroup;
  /** Subcategory name */
  subcategory: string;
  /** Expense description */
  description: string;
  /** Expense amount in INR (₹) */
  amount: number;
  /** Who paid for the expense (Family member name or Self) */
  paidBy: string;
  /** Associated family member ID */
  familyMemberId: string;
  /** Associated family member name or relationship (Self, Spouse, Children, Parents, Entire Family) */
  familyMemberName: string;
  /** Payment instrument used */
  paymentMode: PaymentMode;
  /** Source account ID */
  accountId: string;
  /** Source account name */
  accountName: string;
  /** Optional notes */
  notes?: string;
  /** Deterministic fingerprint for duplicate transaction detection */
  fingerprint: string;
}

/**
 * Table 3: categories
 * Stores default and user-defined categories and subcategories.
 */
export interface CategoryRecord extends BaseRecord {
  name: string;
  group: CategoryGroup;
  subcategories: string[];
  type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  /** ISO timestamp of last usage for Quick Entry (<15s mobile form) */
  lastUsedAt?: string;
}

export type FamilyRelationship =
  | 'Self'
  | 'Spouse'
  | 'Children'
  | 'Parents'
  | 'Entire Family'
  | 'Other';

/**
 * Table 4: familyMembers
 * Stores family member profiles for family-wise expense tracking.
 * Business Rule: Deactivating a member sets isActive=false without deleting historical transactions.
 */
export interface FamilyMemberRecord extends BaseRecord {
  name: string;
  relationship: FamilyRelationship;
  description?: string;
  isActive: boolean;
}

export type BudgetType = 'overall' | 'category' | 'family';

/**
 * Table 5: budgets
 * Stores monthly overall, category-wise, and family-member-wise budgets.
 */
export interface BudgetRecord extends BaseRecord {
  /** YYYY-MM format */
  month: string;
  budgetType: BudgetType;
  /** 'overall', categoryId, or familyMemberId */
  targetId: string;
  /** Display name of the budget target */
  targetName: string;
  /** Planned monthly budget in INR (₹) */
  plannedAmount: number;
  /** Alert threshold at 80% utilization */
  alert80Enabled: boolean;
  /** Alert threshold at 100% utilization */
  alert100Enabled: boolean;
  notes?: string;
}

export type GoalPriority = 'High' | 'Medium' | 'Low';
export type GoalStatus = 'active' | 'completed' | 'paused';

/**
 * Table 6: savingsGoals
 * Stores short-term and long-term savings and investment targets.
 */
export interface SavingsGoalRecord extends BaseRecord {
  name: string;
  targetAmount: number;
  /** Dynamically updated via Dexie transactions whenever savingsContributions change */
  currentContribution: number;
  startDate: string;
  targetDate: string;
  priority: GoalPriority;
  description?: string;
  status: GoalStatus;
  category: 'savings' | 'investment';
}

/**
 * Table 7: savingsContributions
 * Stores individual contributions allocated to savingsGoals.
 * Business Rule: Recorded separately from consumption expenses; deleting a contribution updates the goal.
 */
export interface SavingsContributionRecord extends BaseRecord {
  goalId: string;
  goalName: string;
  /** Contribution date in YYYY-MM-DD */
  transactionDate: string;
  /** YYYY-MM for monthly savings analysis */
  month: string;
  amount: number;
  contributionType: 'savings' | 'investment';
  sourceAccountId: string;
  sourceAccountName: string;
  paymentMode: PaymentMode;
  notes?: string;
  fingerprint: string;
}

export type LoanStatus = 'active' | 'closed' | 'paused';

/**
 * Table 8: loans
 * Stores loan profiles and EMI commitments.
 * Business Rule: Outstanding principal is NOT blindly reduced by the full EMI amount (interest vs principal separation).
 */
export interface LoanRecord extends BaseRecord {
  name: string;
  bank: string;
  originalAmount: number;
  outstandingPrincipal: number;
  /** Annual interest rate in percentage (e.g., 8.5) */
  interestRate: number;
  monthlyEmi: number;
  /** Day of month (1 to 31) when EMI is due */
  emiDueDay: number;
  startDate: string;
  expectedClosureDate: string;
  status: LoanStatus;
  notes?: string;
}

/**
 * Table 9: emiPayments
 * Stores individual monthly EMI payments with explicit principal and interest breakdown.
 */
export interface EmiPaymentRecord extends BaseRecord {
  loanId: string;
  loanName: string;
  /** Payment date in YYYY-MM-DD */
  transactionDate: string;
  /** YYYY-MM */
  month: string;
  /** Total EMI paid */
  totalAmount: number;
  /** Principal portion that reduces outstanding loan principal */
  principalComponent: number;
  /** Interest portion charged by the lender */
  interestComponent: number;
  /** Outstanding principal remaining after this payment */
  remainingPrincipalAfter: number;
  accountId: string;
  accountName: string;
  paymentMode: PaymentMode;
  notes?: string;
  fingerprint: string;
}

export type AccountType = 'bank' | 'cash' | 'wallet' | 'credit_card' | 'investment';

/**
 * Table 10: accounts
 * Stores user bank accounts, cash wallets, and cards.
 */
export interface AccountRecord extends BaseRecord {
  name: string;
  type: AccountType;
  bankName?: string;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  isActive: boolean;
}

/**
 * Table 11: transfers
 * Stores self-transfers between user's own accounts.
 * Business Rule: Moving money between own accounts is neither an expense nor counted twice as savings.
 */
export interface TransferRecord extends BaseRecord {
  transactionDate: string;
  month: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  description: string;
  notes?: string;
  fingerprint: string;
}

/**
 * Table 12: appSettings
 * Stores local application preferences and security configuration in IndexedDB.
 */
export interface AppSettingRecord extends BaseRecord {
  currency: 'INR';
  currencySymbol: '₹';
  language: 'en-IN';
  dateFormat: 'DD-MMM-YYYY';
  /** 4 represents April (Indian Financial Year: April to March) */
  financialYearStartMonth: number;
  theme: 'light' | 'dark' | 'system';
  /** Separate demo mode flag so demo data is never mixed with real records */
  demoMode: boolean;
  openingCashBalance: number;
  expectedSalaryCreditDay: number;
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes: number;
  lastBackupDate?: string;
  schemaVersion: number;
}

/**
 * Financial Summary Calculation Output
 */
export interface MonthlyFinancialSummary {
  month: string;
  financialYear: string;
  salaryCredited: number;
  additionalIncome: number;
  pendingSalary: number;
  totalIncome: number;
  totalExpenses: number;
  monthlySurplus: number;
  savingsContributions: number;
  investmentContributions: number;
  totalContributions: number;
  unallocatedSurplus: number;
  savingsRatePercent: number;
  totalEmiPaid: number;
  selfTransfersTotal: number;
  availableCashBalance: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TableSchemaInfo {
  tableName: string;
  primaryKey: string;
  indexes: string[];
  description: string;
  recordCount: number;
}
