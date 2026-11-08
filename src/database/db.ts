import Dexie, { type Table } from 'dexie';
import type {
  AccountRecord,
  AppSettingRecord,
  BudgetRecord,
  CategoryRecord,
  EmiPaymentRecord,
  ExpenseRecord,
  FamilyMemberRecord,
  IncomeRecord,
  LoanRecord,
  SavingsContributionRecord,
  SavingsGoalRecord,
  TableSchemaInfo,
  TransferRecord,
} from '../types';
import { applyDatabaseMigrations, CURRENT_SCHEMA_VERSION } from './migrations';

/**
 * MyMoneyTrackerDB - Local-only IndexedDB database powered by Dexie.js
 *
 * Architectural Guarantee:
 * - Zero cloud sync or external financial API connections.
 * - Zero financial records stored in window.localStorage or sessionStorage.
 * - All 12 core financial and configuration tables reside strictly inside IndexedDB.
 */
export class MyMoneyTrackerDB extends Dexie {
  income!: Table<IncomeRecord, string>;
  expenses!: Table<ExpenseRecord, string>;
  categories!: Table<CategoryRecord, string>;
  familyMembers!: Table<FamilyMemberRecord, string>;
  budgets!: Table<BudgetRecord, string>;
  savingsGoals!: Table<SavingsGoalRecord, string>;
  savingsContributions!: Table<SavingsContributionRecord, string>;
  loans!: Table<LoanRecord, string>;
  emiPayments!: Table<EmiPaymentRecord, string>;
  accounts!: Table<AccountRecord, string>;
  transfers!: Table<TransferRecord, string>;
  appSettings!: Table<AppSettingRecord, string>;

  constructor() {
    super('MyMoneyTrackerIndexedDB');

    // Schema Version 1: Complete 12-table foundation with single and compound indexes
    this.version(1).stores({
      income:
        'id, salaryMonth, transactionDate, type, status, employer, accountId, fingerprint, [salaryMonth+employer+type]',
      expenses:
        'id, transactionDate, month, categoryId, categoryName, categoryGroup, familyMemberId, familyMemberName, paymentMode, accountId, fingerprint, [month+categoryId], [month+familyMemberId]',
      categories:
        'id, &name, group, type, isDefault, isActive, lastUsedAt, transactionDate',
      familyMembers:
        'id, name, relationship, isActive, transactionDate',
      budgets:
        'id, month, budgetType, targetId, targetName, transactionDate, [month+budgetType+targetId]',
      savingsGoals:
        'id, name, status, priority, category, targetDate, transactionDate',
      savingsContributions:
        'id, goalId, transactionDate, month, contributionType, sourceAccountId, fingerprint, [goalId+month]',
      loans:
        'id, name, bank, status, emiDueDay, transactionDate',
      emiPayments:
        'id, loanId, transactionDate, month, accountId, fingerprint, [loanId+month]',
      accounts:
        'id, &name, type, isDefault, isActive, transactionDate',
      transfers:
        'id, transactionDate, month, fromAccountId, toAccountId, fingerprint',
      appSettings:
        'id, schemaVersion, transactionDate',
    });

    // Register safe forward-compatible schema migrations
    applyDatabaseMigrations(this);
  }
}

export const db = new MyMoneyTrackerDB();

export const TABLE_METADATA: Omit<TableSchemaInfo, 'recordCount'>[] = [
  {
    tableName: 'income',
    primaryKey: 'id',
    indexes: ['salaryMonth', 'transactionDate', 'type', 'status', 'employer', 'accountId', 'fingerprint', '[salaryMonth+employer+type]'],
    description: 'Salary credits, bonuses, interest, freelance, and other income records',
  },
  {
    tableName: 'expenses',
    primaryKey: 'id',
    indexes: ['transactionDate', 'month', 'categoryId', 'categoryName', 'categoryGroup', 'familyMemberId', 'familyMemberName', 'paymentMode', 'accountId', 'fingerprint'],
    description: 'Daily personal and family expense transactions',
  },
  {
    tableName: 'categories',
    primaryKey: 'id',
    indexes: ['&name', 'group', 'type', 'isDefault', 'isActive', 'lastUsedAt', 'transactionDate'],
    description: 'Default and custom categories & subcategories with quick-entry usage timestamps',
  },
  {
    tableName: 'familyMembers',
    primaryKey: 'id',
    indexes: ['name', 'relationship', 'isActive', 'transactionDate'],
    description: 'Family member profiles (Self, Spouse, Children, Parents, Entire Family)',
  },
  {
    tableName: 'budgets',
    primaryKey: 'id',
    indexes: ['month', 'budgetType', 'targetId', 'targetName', 'transactionDate', '[month+budgetType+targetId]'],
    description: 'Monthly overall, category-wise, and family-wise budget targets & alert rules',
  },
  {
    tableName: 'savingsGoals',
    primaryKey: 'id',
    indexes: ['name', 'status', 'priority', 'category', 'targetDate', 'transactionDate'],
    description: 'Short-term and long-term family savings & investment targets',
  },
  {
    tableName: 'savingsContributions',
    primaryKey: 'id',
    indexes: ['goalId', 'transactionDate', 'month', 'contributionType', 'sourceAccountId', 'fingerprint', '[goalId+month]'],
    description: 'Individual contributions allocated toward savings goals',
  },
  {
    tableName: 'loans',
    primaryKey: 'id',
    indexes: ['name', 'bank', 'status', 'emiDueDay', 'transactionDate'],
    description: 'Active and closed loans with principal, interest rate, and EMI schedule',
  },
  {
    tableName: 'emiPayments',
    primaryKey: 'id',
    indexes: ['loanId', 'transactionDate', 'month', 'accountId', 'fingerprint', '[loanId+month]'],
    description: 'Monthly EMI payment history with principal vs. interest separation',
  },
  {
    tableName: 'accounts',
    primaryKey: 'id',
    indexes: ['&name', 'type', 'isDefault', 'isActive', 'transactionDate'],
    description: 'Local bank accounts, cash wallet, and credit cards',
  },
  {
    tableName: 'transfers',
    primaryKey: 'id',
    indexes: ['transactionDate', 'month', 'fromAccountId', 'toAccountId', 'fingerprint'],
    description: 'Self-transfers between own accounts (excluded from expenses and double savings)',
  },
  {
    tableName: 'appSettings',
    primaryKey: 'id',
    indexes: ['schemaVersion', 'transactionDate'],
    description: 'Application configuration, INR currency settings, PIN lock hash, and schema state',
  },
];

export { CURRENT_SCHEMA_VERSION };
