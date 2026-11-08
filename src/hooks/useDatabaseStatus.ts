import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CURRENT_SCHEMA_VERSION, db, TABLE_METADATA } from '../database/db';
import { initializeDatabaseFoundation } from '../database/seed';
import type { TableSchemaInfo } from '../types';

export function useDatabaseStatus() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    initializeDatabaseFoundation()
      .then(() => {
        if (mounted) {
          setIsInitialized(true);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const liveSnapshot = useLiveQuery(async () => {
    const [
      incomeCount,
      expensesCount,
      categoriesCount,
      familyMembersCount,
      budgetsCount,
      savingsGoalsCount,
      savingsContributionsCount,
      loansCount,
      emiPaymentsCount,
      accountsCount,
      transfersCount,
      appSettingsCount,
      settings,
      categories,
      familyMembers,
      accounts,
    ] = await Promise.all([
      db.income.count(),
      db.expenses.count(),
      db.categories.count(),
      db.familyMembers.count(),
      db.budgets.count(),
      db.savingsGoals.count(),
      db.savingsContributions.count(),
      db.loans.count(),
      db.emiPayments.count(),
      db.accounts.count(),
      db.transfers.count(),
      db.appSettings.count(),
      db.appSettings.get('default'),
      db.categories.toArray(),
      db.familyMembers.toArray(),
      db.accounts.toArray(),
    ]);

    const countsMap: Record<string, number> = {
      income: incomeCount,
      expenses: expensesCount,
      categories: categoriesCount,
      familyMembers: familyMembersCount,
      budgets: budgetsCount,
      savingsGoals: savingsGoalsCount,
      savingsContributions: savingsContributionsCount,
      loans: loansCount,
      emiPayments: emiPaymentsCount,
      accounts: accountsCount,
      transfers: transfersCount,
      appSettings: appSettingsCount,
    };

    const tables: TableSchemaInfo[] = TABLE_METADATA.map((meta) => ({
      ...meta,
      recordCount: countsMap[meta.tableName] ?? 0,
    }));

    return {
      tables,
      settings,
      categories,
      familyMembers,
      accounts,
      totalRecords: Object.values(countsMap).reduce((a, b) => a + b, 0),
    };
  }, [isInitialized]);

  return {
    isInitialized,
    initError,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    databaseName: db.name,
    tables: liveSnapshot?.tables ?? [],
    settings: liveSnapshot?.settings,
    categories: liveSnapshot?.categories ?? [],
    familyMembers: liveSnapshot?.familyMembers ?? [],
    accounts: liveSnapshot?.accounts ?? [],
    totalRecords: liveSnapshot?.totalRecords ?? 0,
  };
}
