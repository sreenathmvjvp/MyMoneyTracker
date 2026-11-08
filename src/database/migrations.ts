import type Dexie from 'dexie';
import { createFingerprint, getTodayISO, toMonthKey } from '../utilities/formatters';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Configures safe, non-destructive IndexedDB schema migrations.
 * Ensures existing user transactions are preserved across version upgrades.
 */
export function applyDatabaseMigrations(dbInstance: Dexie): void {
  dbInstance
    .version(CURRENT_SCHEMA_VERSION)
    .stores({
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
    })
    .upgrade(async (tx) => {
      const nowIso = new Date().toISOString();
      const todayDate = getTodayISO();

      // Backfill month and fingerprint on any legacy expense records
      await tx
        .table('expenses')
        .toCollection()
        .modify((expense) => {
          if (!expense.month && expense.transactionDate) {
            expense.month = toMonthKey(expense.transactionDate);
          }
          if (!expense.fingerprint) {
            expense.fingerprint = createFingerprint(
              expense.transactionDate,
              expense.amount,
              expense.categoryId,
              expense.subcategory,
              expense.description,
              expense.familyMemberId
            );
          }
          if (!expense.updatedAt) {
            expense.updatedAt = nowIso;
          }
        });

      // Ensure appSettings schemaVersion matches CURRENT_SCHEMA_VERSION
      await tx
        .table('appSettings')
        .toCollection()
        .modify((setting) => {
          setting.schemaVersion = CURRENT_SCHEMA_VERSION;
          setting.transactionDate = setting.transactionDate || todayDate;
          setting.updatedAt = nowIso;
        });
    });
}
