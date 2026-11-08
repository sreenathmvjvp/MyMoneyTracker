import { db } from '../database/db';
import type {
  BudgetRecord,
  BudgetType,
  CategoryGroup,
  CategoryRecord,
  EmiPaymentRecord,
  ExpenseRecord,
  FamilyMemberRecord,
  FamilyRelationship,
  IncomeRecord,
  LoanRecord,
  SavingsContributionRecord,
  SavingsGoalRecord,
  TransferRecord,
} from '../types';
import {
  createFingerprint,
  generateId,
  getTodayISO,
  toMonthKey,
} from '../utilities/formatters';
import {
  validateBudgetRecord,
  validateCategoryRecord,
  validateEmiPaymentRecord,
  validateExpenseRecord,
  validateFamilyMemberRecord,
  validateIncomeRecord,
  validateLoanRecord,
  validateSavingsContributionRecord,
  validateSavingsGoalRecord,
  validateTransferRecord,
} from '../utilities/validators';

/**
 * Transactional Database Service Layer for My Money Tracker.
 *
 * Enforces:
 * - Atomic multi-table updates via db.transaction('rw', ...)
 * - Duplicate entry prevention (salary month+employer check & transaction fingerprints)
 * - Strict validation before any IndexedDB write
 */
export const databaseService = {
  /**
   * Adds an income record (Salary or Additional Income) with duplicate salary protection
   * and atomic account balance update when status === 'credited'.
   */
  async addIncome(
    input: Omit<IncomeRecord, 'id' | 'createdAt' | 'updatedAt' | 'fingerprint'>
  ): Promise<IncomeRecord> {
    const nowIso = new Date().toISOString();
    const fingerprint = createFingerprint(
      input.type,
      input.salaryMonth,
      input.employer,
      input.amount,
      input.transactionDate,
      input.description
    );

    const record: IncomeRecord = {
      ...input,
      id: generateId('inc'),
      fingerprint,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateIncomeRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.income, db.accounts], async () => {
      if (record.type === 'salary') {
        const existingForMonth = await db.income
          .where('salaryMonth')
          .equals(record.salaryMonth)
          .toArray();

        const normalizedEmployer = record.employer.trim().toLowerCase();
        const duplicateSalary = existingForMonth.find(
          (item) =>
            item.type === 'salary' &&
            item.employer.trim().toLowerCase() === normalizedEmployer
        );

        if (duplicateSalary) {
          throw new Error(
            `Duplicate salary prevented: Salary for ${record.salaryMonth} from "${record.employer}" already exists.`
          );
        }
      } else {
        const existingDuplicate = await db.income
          .where('fingerprint')
          .equals(record.fingerprint)
          .first();
        if (existingDuplicate) {
          throw new Error(
            'Duplicate income entry detected for the same date, source, and amount.'
          );
        }
      }

      await db.income.add(record);

      if (record.status === 'credited' && record.accountId) {
        const account = await db.accounts.get(record.accountId);
        if (account) {
          await db.accounts.update(account.id, {
            currentBalance: account.currentBalance + record.amount,
            updatedAt: nowIso,
          });
        }
      }
    });

    return record;
  },

  /**
   * Updates an existing salary or additional income record inside an atomic IndexedDB transaction.
   */
  async updateIncome(
    id: string,
    updates: Omit<IncomeRecord, 'id' | 'createdAt' | 'updatedAt' | 'fingerprint'>
  ): Promise<IncomeRecord> {
    const nowIso = new Date().toISOString();
    const existing = await db.income.get(id);
    if (!existing) {
      throw new Error('Income record not found in IndexedDB.');
    }

    const fingerprint = createFingerprint(
      updates.type,
      updates.salaryMonth,
      updates.employer,
      updates.amount,
      updates.transactionDate,
      updates.description
    );

    const updatedRecord: IncomeRecord = {
      ...existing,
      ...updates,
      id,
      fingerprint,
      updatedAt: nowIso,
    };

    const validation = validateIncomeRecord(updatedRecord);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.income, db.accounts], async () => {
      if (updatedRecord.type === 'salary') {
        const existingForMonth = await db.income
          .where('salaryMonth')
          .equals(updatedRecord.salaryMonth)
          .toArray();

        const normalizedEmployer = updatedRecord.employer.trim().toLowerCase();
        const duplicateSalary = existingForMonth.find(
          (item) =>
            item.id !== id &&
            item.type === 'salary' &&
            item.employer.trim().toLowerCase() === normalizedEmployer
        );

        if (duplicateSalary) {
          throw new Error(
            `Duplicate salary prevented: Another salary entry for ${updatedRecord.salaryMonth} from "${updatedRecord.employer}" already exists.`
          );
        }
      } else {
        const duplicate = await db.income.where('fingerprint').equals(fingerprint).first();
        if (duplicate && duplicate.id !== id) {
          throw new Error(
            'Duplicate income entry detected for the same date, source, and amount.'
          );
        }
      }

      if (existing.status === 'credited' && existing.accountId) {
        const prevAcc = await db.accounts.get(existing.accountId);
        if (prevAcc) {
          await db.accounts.update(prevAcc.id, {
            currentBalance: prevAcc.currentBalance - existing.amount,
            updatedAt: nowIso,
          });
        }
      }

      if (updatedRecord.status === 'credited' && updatedRecord.accountId) {
        const nextAcc = await db.accounts.get(updatedRecord.accountId);
        if (nextAcc) {
          await db.accounts.update(nextAcc.id, {
            currentBalance: nextAcc.currentBalance + updatedRecord.amount,
            updatedAt: nowIso,
          });
        }
      }

      await db.income.put(updatedRecord);
    });

    return updatedRecord;
  },

  /**
   * Transitions a 'pending' expected salary record into 'credited' status on the actual credit date.
   */
  async markSalaryAsCredited(
    id: string,
    actualCreditDate = getTodayISO()
  ): Promise<IncomeRecord> {
    const existing = await db.income.get(id);
    if (!existing) {
      throw new Error('Salary record not found.');
    }
    if (existing.status === 'credited') {
      return existing;
    }

    return this.updateIncome(id, {
      type: existing.type,
      salaryMonth: existing.salaryMonth,
      transactionDate: actualCreditDate,
      expectedCreditDate: existing.expectedCreditDate || existing.transactionDate,
      status: 'credited',
      amount: existing.amount,
      employer: existing.employer,
      accountId: existing.accountId,
      bankAccountName: existing.bankAccountName,
      description: existing.description,
      remarks: existing.remarks,
    });
  },

  /**
   * Deletes an income or salary record and reverses its bank account balance impact if credited.
   */
  async deleteIncome(id: string): Promise<void> {
    const nowIso = new Date().toISOString();

    await db.transaction('rw', [db.income, db.accounts], async () => {
      const existing = await db.income.get(id);
      if (!existing) return;

      if (existing.status === 'credited' && existing.accountId) {
        const account = await db.accounts.get(existing.accountId);
        if (account) {
          await db.accounts.update(account.id, {
            currentBalance: account.currentBalance - existing.amount,
            updatedAt: nowIso,
          });
        }
      }

      await db.income.delete(id);
    });
  },

  /**
   * Updates the user's configured expected monthly salary credit day (1 to 31) in IndexedDB.
   */
  async updateExpectedSalaryDay(dayOfMonth: number): Promise<void> {
    const clampedDay = Math.max(1, Math.min(31, Math.round(dayOfMonth)));
    await db.appSettings.update('default', {
      expectedSalaryCreditDay: clampedDay,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Adds an expense record with duplicate fingerprint prevention,
   * updates category lastUsedAt timestamp, and debits account balance atomically.
   */
  async addExpense(
    input: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt' | 'month' | 'fingerprint'>
  ): Promise<ExpenseRecord> {
    const nowIso = new Date().toISOString();
    const month = toMonthKey(input.transactionDate);
    const fingerprint = createFingerprint(
      input.transactionDate,
      input.amount,
      input.categoryId,
      input.subcategory,
      input.description,
      input.familyMemberId,
      input.paymentMode
    );

    const record: ExpenseRecord = {
      ...input,
      id: generateId('exp'),
      month,
      fingerprint,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateExpenseRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.expenses, db.categories, db.accounts], async () => {
      const existing = await db.expenses
        .where('fingerprint')
        .equals(record.fingerprint)
        .first();
      if (existing) {
        throw new Error(
          'Duplicate expense prevented: An identical expense (same date, category, amount, and description) already exists.'
        );
      }

      await db.expenses.add(record);

      if (record.categoryId) {
        await db.categories.update(record.categoryId, {
          lastUsedAt: nowIso,
          updatedAt: nowIso,
        });
      }

      if (record.accountId) {
        const account = await db.accounts.get(record.accountId);
        if (account) {
          await db.accounts.update(account.id, {
            currentBalance: account.currentBalance - record.amount,
            updatedAt: nowIso,
          });
        }
      }
    });

    return record;
  },

  /**
   * Updates an existing expense record atomically in IndexedDB.
   */
  async updateExpense(
    id: string,
    updates: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt' | 'month' | 'fingerprint'>
  ): Promise<ExpenseRecord> {
    const nowIso = new Date().toISOString();
    const existing = await db.expenses.get(id);
    if (!existing) {
      throw new Error('Expense record not found in IndexedDB.');
    }

    const month = toMonthKey(updates.transactionDate);
    const fingerprint = createFingerprint(
      updates.transactionDate,
      updates.amount,
      updates.categoryId,
      updates.subcategory,
      updates.description,
      updates.familyMemberId,
      updates.paymentMode
    );

    const updatedRecord: ExpenseRecord = {
      ...existing,
      ...updates,
      id,
      month,
      fingerprint,
      updatedAt: nowIso,
    };

    const validation = validateExpenseRecord(updatedRecord);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.expenses, db.categories, db.accounts], async () => {
      const duplicate = await db.expenses.where('fingerprint').equals(fingerprint).first();
      if (duplicate && duplicate.id !== id) {
        throw new Error(
          'Duplicate expense prevented: Another identical expense already exists for this date, category, and amount.'
        );
      }

      if (existing.accountId) {
        const oldAcc = await db.accounts.get(existing.accountId);
        if (oldAcc) {
          await db.accounts.update(oldAcc.id, {
            currentBalance: oldAcc.currentBalance + existing.amount,
            updatedAt: nowIso,
          });
        }
      }

      if (updatedRecord.accountId) {
        const newAcc = await db.accounts.get(updatedRecord.accountId);
        if (newAcc) {
          await db.accounts.update(newAcc.id, {
            currentBalance: newAcc.currentBalance - updatedRecord.amount,
            updatedAt: nowIso,
          });
        }
      }

      if (updatedRecord.categoryId) {
        await db.categories.update(updatedRecord.categoryId, {
          lastUsedAt: nowIso,
          updatedAt: nowIso,
        });
      }

      await db.expenses.put(updatedRecord);
    });

    return updatedRecord;
  },

  /**
   * Deletes an expense record from IndexedDB and restores the amount to the source account balance.
   */
  async deleteExpense(id: string): Promise<void> {
    const nowIso = new Date().toISOString();

    await db.transaction('rw', [db.expenses, db.accounts], async () => {
      const existing = await db.expenses.get(id);
      if (!existing) return;

      if (existing.accountId) {
        const account = await db.accounts.get(existing.accountId);
        if (account) {
          await db.accounts.update(account.id, {
            currentBalance: account.currentBalance + existing.amount,
            updatedAt: nowIso,
          });
        }
      }

      await db.expenses.delete(id);
    });
  },

  /**
   * Creates a user-defined custom category with subcategories in IndexedDB.
   */
  async addCustomCategory(input: {
    name: string;
    group: CategoryGroup;
    subcategories: string[];
    color?: string;
    icon?: string;
  }): Promise<CategoryRecord> {
    const nowIso = new Date().toISOString();
    const todayDate = getTodayISO();
    const cleanName = input.name.trim();

    if (!cleanName) {
      throw new Error('Category name is required.');
    }

    const existing = await db.categories
      .filter((c) => c.name.trim().toLowerCase() === cleanName.toLowerCase())
      .first();
    if (existing) {
      throw new Error(`Category "${cleanName}" already exists.`);
    }

    const cleanSubs = input.subcategories.map((s) => s.trim()).filter(Boolean);

    const record: CategoryRecord = {
      id: generateId('cat_custom'),
      name: cleanName,
      group: input.group || 'Custom',
      subcategories: cleanSubs.length > 0 ? cleanSubs : ['General'],
      type: 'expense',
      icon: input.icon || 'FolderPlus',
      color: input.color || '#059669',
      isDefault: false,
      isActive: true,
      lastUsedAt: nowIso,
      transactionDate: todayDate,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateCategoryRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.categories.add(record);
    return record;
  },

  /**
   * Appends a custom subcategory to an existing category in IndexedDB.
   */
  async addSubcategoryToCategory(
    categoryId: string,
    newSubcategory: string
  ): Promise<CategoryRecord> {
    const nowIso = new Date().toISOString();
    const cleanSub = newSubcategory.trim();
    if (!cleanSub) {
      throw new Error('Subcategory name cannot be empty.');
    }

    const cat = await db.categories.get(categoryId);
    if (!cat) {
      throw new Error('Category not found.');
    }

    const exists = cat.subcategories.some(
      (s) => s.trim().toLowerCase() === cleanSub.toLowerCase()
    );
    if (exists) {
      throw new Error(`Subcategory "${cleanSub}" already exists in ${cat.name}.`);
    }

    const updatedSubs = [...cat.subcategories, cleanSub];
    await db.categories.update(categoryId, {
      subcategories: updatedSubs,
      updatedAt: nowIso,
    });

    return {
      ...cat,
      subcategories: updatedSubs,
      updatedAt: nowIso,
    };
  },

  /**
   * Adds a new Family Member profile to IndexedDB.
   */
  async addFamilyMember(input: {
    name: string;
    relationship: FamilyRelationship;
    description?: string;
    isActive?: boolean;
  }): Promise<FamilyMemberRecord> {
    const nowIso = new Date().toISOString();
    const todayDate = getTodayISO();
    const cleanName = input.name.trim();

    if (!cleanName) {
      throw new Error('Family member name is required.');
    }

    const duplicate = await db.familyMembers
      .filter((m) => m.name.trim().toLowerCase() === cleanName.toLowerCase())
      .first();
    if (duplicate) {
      throw new Error(`Family member "${cleanName}" already exists.`);
    }

    const record: FamilyMemberRecord = {
      id: generateId('fam'),
      name: cleanName,
      relationship: input.relationship,
      description: input.description?.trim() || `${input.relationship} expense profile`,
      isActive: input.isActive ?? true,
      transactionDate: todayDate,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateFamilyMemberRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.familyMembers.add(record);
    return record;
  },

  /**
   * Updates an existing Family Member profile in IndexedDB.
   */
  async updateFamilyMember(
    id: string,
    updates: {
      name: string;
      relationship: FamilyRelationship;
      description?: string;
      isActive: boolean;
    }
  ): Promise<FamilyMemberRecord> {
    const nowIso = new Date().toISOString();
    const existing = await db.familyMembers.get(id);
    if (!existing) {
      throw new Error('Family member not found.');
    }

    const cleanName = updates.name.trim();
    if (!cleanName) {
      throw new Error('Family member name is required.');
    }

    const duplicate = await db.familyMembers
      .filter(
        (m) => m.id !== id && m.name.trim().toLowerCase() === cleanName.toLowerCase()
      )
      .first();
    if (duplicate) {
      throw new Error(`Family member "${cleanName}" already exists.`);
    }

    const updatedRecord: FamilyMemberRecord = {
      ...existing,
      name: cleanName,
      relationship: updates.relationship,
      description: updates.description?.trim(),
      isActive: updates.isActive,
      updatedAt: nowIso,
    };

    const validation = validateFamilyMemberRecord(updatedRecord);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.familyMembers, db.expenses], async () => {
      await db.familyMembers.put(updatedRecord);

      if (existing.name !== cleanName) {
        await db.expenses
          .where('familyMemberId')
          .equals(id)
          .modify((exp) => {
            exp.familyMemberName = cleanName;
            exp.updatedAt = nowIso;
          });
      }
    });

    return updatedRecord;
  },

  /**
   * Toggles a family member's Active / Inactive status without deleting historical transactions.
   */
  async toggleFamilyMemberStatus(id: string): Promise<FamilyMemberRecord> {
    const existing = await db.familyMembers.get(id);
    if (!existing) {
      throw new Error('Family member not found.');
    }
    return this.updateFamilyMember(id, {
      name: existing.name,
      relationship: existing.relationship,
      description: existing.description,
      isActive: !existing.isActive,
    });
  },

  /**
   * Creates a savings goal and validates target dates and amounts.
   */
  async addSavingsGoal(
    input: Omit<SavingsGoalRecord, 'id' | 'createdAt' | 'updatedAt' | 'transactionDate'>
  ): Promise<SavingsGoalRecord> {
    const nowIso = new Date().toISOString();
    const computedStatus =
      input.currentContribution >= input.targetAmount ? 'completed' : input.status;

    const record: SavingsGoalRecord = {
      ...input,
      status: computedStatus,
      id: generateId('goal'),
      transactionDate: input.startDate || getTodayISO(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateSavingsGoalRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.savingsGoals.add(record);
    return record;
  },

  /**
   * Updates an existing savings goal in IndexedDB and synchronizes goalName
   * across associated savingsContributions inside an atomic transaction.
   */
  async updateSavingsGoal(
    id: string,
    updates: Omit<SavingsGoalRecord, 'id' | 'createdAt' | 'updatedAt' | 'transactionDate'>
  ): Promise<SavingsGoalRecord> {
    const nowIso = new Date().toISOString();
    const existing = await db.savingsGoals.get(id);
    if (!existing) {
      throw new Error('Savings goal not found in IndexedDB.');
    }

    const computedStatus =
      updates.status === 'paused'
        ? 'paused'
        : updates.currentContribution >= updates.targetAmount
        ? 'completed'
        : 'active';

    const updatedRecord: SavingsGoalRecord = {
      ...existing,
      ...updates,
      status: computedStatus,
      id,
      transactionDate: updates.startDate || existing.transactionDate,
      updatedAt: nowIso,
    };

    const validation = validateSavingsGoalRecord(updatedRecord);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.savingsGoals, db.savingsContributions], async () => {
      await db.savingsGoals.put(updatedRecord);

      if (existing.name !== updatedRecord.name) {
        await db.savingsContributions
          .where('goalId')
          .equals(id)
          .modify((contrib) => {
            contrib.goalName = updatedRecord.name;
            contrib.updatedAt = nowIso;
          });
      }
    });

    return updatedRecord;
  },

  /**
   * Deletes a savings goal and its associated contribution records inside an atomic transaction.
   */
  async deleteSavingsGoal(id: string): Promise<void> {
    const nowIso = new Date().toISOString();

    await db.transaction(
      'rw',
      [db.savingsGoals, db.savingsContributions, db.accounts],
      async () => {
        const contributions = await db.savingsContributions
          .where('goalId')
          .equals(id)
          .toArray();

        for (const c of contributions) {
          if (c.sourceAccountId) {
            const acc = await db.accounts.get(c.sourceAccountId);
            if (acc) {
              await db.accounts.update(acc.id, {
                currentBalance: acc.currentBalance + c.amount,
                updatedAt: nowIso,
              });
            }
          }
        }

        await db.savingsContributions.where('goalId').equals(id).delete();
        await db.savingsGoals.delete(id);
      }
    );
  },

  /**
   * Adds a savings contribution and atomically increments the associated savingsGoal's
   * currentContribution and updates its completion status.
   */
  async addSavingsContribution(
    input: Omit<
      SavingsContributionRecord,
      'id' | 'createdAt' | 'updatedAt' | 'month' | 'fingerprint'
    >
  ): Promise<SavingsContributionRecord> {
    const nowIso = new Date().toISOString();
    const month = toMonthKey(input.transactionDate);
    const fingerprint = createFingerprint(
      input.goalId,
      input.transactionDate,
      input.amount,
      input.contributionType,
      input.notes
    );

    const record: SavingsContributionRecord = {
      ...input,
      id: generateId('contrib'),
      month,
      fingerprint,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateSavingsContributionRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction(
      'rw',
      [db.savingsContributions, db.savingsGoals, db.accounts],
      async () => {
        const duplicate = await db.savingsContributions
          .where('fingerprint')
          .equals(record.fingerprint)
          .first();
        if (duplicate) {
          throw new Error(
            'Duplicate savings contribution prevented for the same goal, date, and amount.'
          );
        }

        const goal = await db.savingsGoals.get(record.goalId);
        if (!goal) {
          throw new Error('Associated savings goal not found in IndexedDB.');
        }

        await db.savingsContributions.add(record);

        const updatedContribution = goal.currentContribution + record.amount;
        const updatedStatus =
          updatedContribution >= goal.targetAmount ? 'completed' : goal.status;

        await db.savingsGoals.update(goal.id, {
          currentContribution: updatedContribution,
          status: updatedStatus,
          updatedAt: nowIso,
        });

        if (record.sourceAccountId) {
          const account = await db.accounts.get(record.sourceAccountId);
          if (account) {
            await db.accounts.update(account.id, {
              currentBalance: account.currentBalance - record.amount,
              updatedAt: nowIso,
            });
          }
        }
      }
    );

    return record;
  },

  /**
   * Updates an existing savings contribution and atomically recalculates both old and new
   * savingsGoal currentContribution totals and source account balances.
   */
  async updateSavingsContribution(
    id: string,
    updates: Omit<
      SavingsContributionRecord,
      'id' | 'createdAt' | 'updatedAt' | 'month' | 'fingerprint'
    >
  ): Promise<SavingsContributionRecord> {
    const nowIso = new Date().toISOString();
    const existing = await db.savingsContributions.get(id);
    if (!existing) {
      throw new Error('Savings contribution record not found.');
    }

    const month = toMonthKey(updates.transactionDate);
    const fingerprint = createFingerprint(
      updates.goalId,
      updates.transactionDate,
      updates.amount,
      updates.contributionType,
      updates.notes
    );

    const updatedRecord: SavingsContributionRecord = {
      ...existing,
      ...updates,
      id,
      month,
      fingerprint,
      updatedAt: nowIso,
    };

    const validation = validateSavingsContributionRecord(updatedRecord);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction(
      'rw',
      [db.savingsContributions, db.savingsGoals, db.accounts],
      async () => {
        const duplicate = await db.savingsContributions
          .where('fingerprint')
          .equals(fingerprint)
          .first();
        if (duplicate && duplicate.id !== id) {
          throw new Error(
            'Duplicate savings contribution prevented for the same goal, date, and amount.'
          );
        }

        const oldGoal = await db.savingsGoals.get(existing.goalId);
        if (oldGoal) {
          const revertedAmt = Math.max(0, oldGoal.currentContribution - existing.amount);
          await db.savingsGoals.update(oldGoal.id, {
            currentContribution: revertedAmt,
            status:
              revertedAmt >= oldGoal.targetAmount
                ? 'completed'
                : oldGoal.status === 'paused'
                ? 'paused'
                : 'active',
            updatedAt: nowIso,
          });
        }

        if (existing.sourceAccountId) {
          const oldAcc = await db.accounts.get(existing.sourceAccountId);
          if (oldAcc) {
            await db.accounts.update(oldAcc.id, {
              currentBalance: oldAcc.currentBalance + existing.amount,
              updatedAt: nowIso,
            });
          }
        }

        const newGoal = await db.savingsGoals.get(updatedRecord.goalId);
        if (!newGoal) {
          throw new Error('Target savings goal not found.');
        }
        const nextGoalContrib = newGoal.currentContribution + updatedRecord.amount;
        await db.savingsGoals.update(newGoal.id, {
          currentContribution: nextGoalContrib,
          status:
            nextGoalContrib >= newGoal.targetAmount
              ? 'completed'
              : newGoal.status === 'paused'
              ? 'paused'
              : 'active',
          updatedAt: nowIso,
        });

        if (updatedRecord.sourceAccountId) {
          const newAcc = await db.accounts.get(updatedRecord.sourceAccountId);
          if (newAcc) {
            await db.accounts.update(newAcc.id, {
              currentBalance: newAcc.currentBalance - updatedRecord.amount,
              updatedAt: nowIso,
            });
          }
        }

        await db.savingsContributions.put(updatedRecord);
      }
    );

    return updatedRecord;
  },

  /**
   * Deletes a savings contribution and atomically decrements the associated savingsGoal's
   * currentContribution so goal progress stays 100% accurate.
   */
  async deleteSavingsContribution(contributionId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    await db.transaction(
      'rw',
      [db.savingsContributions, db.savingsGoals, db.accounts],
      async () => {
        const existing = await db.savingsContributions.get(contributionId);
        if (!existing) return;

        const goal = await db.savingsGoals.get(existing.goalId);
        if (goal) {
          const recalculated = Math.max(0, goal.currentContribution - existing.amount);
          await db.savingsGoals.update(goal.id, {
            currentContribution: recalculated,
            status:
              recalculated >= goal.targetAmount
                ? 'completed'
                : goal.status === 'paused'
                ? 'paused'
                : 'active',
            updatedAt: nowIso,
          });
        }

        if (existing.sourceAccountId) {
          const account = await db.accounts.get(existing.sourceAccountId);
          if (account) {
            await db.accounts.update(account.id, {
              currentBalance: account.currentBalance + existing.amount,
              updatedAt: nowIso,
            });
          }
        }

        await db.savingsContributions.delete(contributionId);
      }
    );
  },

  /**
   * Records a self-transfer between user's own accounts inside an atomic transaction.
   */
  async addSelfTransfer(
    input: Omit<TransferRecord, 'id' | 'createdAt' | 'updatedAt' | 'month' | 'fingerprint'>
  ): Promise<TransferRecord> {
    const nowIso = new Date().toISOString();
    const month = toMonthKey(input.transactionDate);
    const fingerprint = createFingerprint(
      input.transactionDate,
      input.fromAccountId,
      input.toAccountId,
      input.amount,
      input.description
    );

    const record: TransferRecord = {
      ...input,
      id: generateId('trf'),
      month,
      fingerprint,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateTransferRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.transfers, db.accounts], async () => {
      await db.transfers.add(record);

      const fromAcc = await db.accounts.get(record.fromAccountId);
      const toAcc = await db.accounts.get(record.toAccountId);

      if (fromAcc) {
        await db.accounts.update(fromAcc.id, {
          currentBalance: fromAcc.currentBalance - record.amount,
          updatedAt: nowIso,
        });
      }
      if (toAcc) {
        await db.accounts.update(toAcc.id, {
          currentBalance: toAcc.currentBalance + record.amount,
          updatedAt: nowIso,
        });
      }
    });

    return record;
  },

  /**
   * Creates or updates a monthly budget (overall, category, or family) in IndexedDB.
   * Ensures only one budget exists per (month, budgetType, targetId).
   */
  async upsertBudget(input: {
    month: string;
    budgetType: BudgetType;
    targetId: string;
    targetName: string;
    plannedAmount: number;
    alert80Enabled?: boolean;
    alert100Enabled?: boolean;
    notes?: string;
  }): Promise<BudgetRecord> {
    const nowIso = new Date().toISOString();
    const transactionDate = `${input.month}-01`;

    let savedRecord!: BudgetRecord;

    await db.transaction('rw', db.budgets, async () => {
      const existing = await db.budgets
        .where('[month+budgetType+targetId]')
        .equals([input.month, input.budgetType, input.targetId])
        .first();

      const record: BudgetRecord = {
        id: existing ? existing.id : generateId('bgt'),
        month: input.month,
        transactionDate,
        budgetType: input.budgetType,
        targetId: input.targetId,
        targetName: input.targetName,
        plannedAmount: input.plannedAmount,
        alert80Enabled: input.alert80Enabled ?? true,
        alert100Enabled: input.alert100Enabled ?? true,
        notes: input.notes?.trim() || undefined,
        createdAt: existing ? existing.createdAt : nowIso,
        updatedAt: nowIso,
      };

      const validation = validateBudgetRecord(record);
      if (!validation.valid) {
        throw new Error(validation.errors.join(' '));
      }

      await db.budgets.put(record);
      savedRecord = record;
    });

    return savedRecord;
  },

  /**
   * Deletes a budget record from IndexedDB.
   */
  async deleteBudget(id: string): Promise<void> {
    await db.budgets.delete(id);
  },

  /**
   * Copies all budgets (overall, category-wise, and family-wise) from sourceMonth to targetMonth
   * inside an atomic IndexedDB transaction.
   */
  async copyBudgetsFromMonth(sourceMonth: string, targetMonth: string): Promise<number> {
    if (sourceMonth === targetMonth) {
      throw new Error('Source month and target month must be different.');
    }

    const nowIso = new Date().toISOString();
    let copiedCount = 0;

    await db.transaction('rw', db.budgets, async () => {
      const sourceBudgets = await db.budgets
        .where('month')
        .equals(sourceMonth)
        .toArray();

      if (sourceBudgets.length === 0) {
        throw new Error(`No budgets found in ${sourceMonth} to copy.`);
      }

      for (const bgt of sourceBudgets) {
        const existingInTarget = await db.budgets
          .where('[month+budgetType+targetId]')
          .equals([targetMonth, bgt.budgetType, bgt.targetId])
          .first();

        const nextRecord: BudgetRecord = {
          id: existingInTarget ? existingInTarget.id : generateId('bgt'),
          month: targetMonth,
          transactionDate: `${targetMonth}-01`,
          budgetType: bgt.budgetType,
          targetId: bgt.targetId,
          targetName: bgt.targetName,
          plannedAmount: bgt.plannedAmount,
          alert80Enabled: bgt.alert80Enabled,
          alert100Enabled: bgt.alert100Enabled,
          notes: bgt.notes,
          createdAt: existingInTarget ? existingInTarget.createdAt : nowIso,
          updatedAt: nowIso,
        };

        await db.budgets.put(nextRecord);
        copiedCount += 1;
      }
    });

    return copiedCount;
  },

  /**
   * Creates a new loan profile in IndexedDB.
   */
  async addLoan(
    input: Omit<LoanRecord, 'id' | 'createdAt' | 'updatedAt' | 'transactionDate'>
  ): Promise<LoanRecord> {
    const nowIso = new Date().toISOString();
    const record: LoanRecord = {
      ...input,
      id: generateId('loan'),
      transactionDate: input.startDate || getTodayISO(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validation = validateLoanRecord(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.loans.add(record);
    return record;
  },

  /**
   * Updates an existing loan profile (including manual outstanding principal updates)
   * and synchronizes loanName across EMI payment history.
   */
  async updateLoan(
    id: string,
    updates: Omit<LoanRecord, 'id' | 'createdAt' | 'updatedAt' | 'transactionDate'>
  ): Promise<LoanRecord> {
    const nowIso = new Date().toISOString();
    const existing = await db.loans.get(id);
    if (!existing) {
      throw new Error('Loan record not found in IndexedDB.');
    }

    const computedStatus =
      updates.status === 'paused'
        ? 'paused'
        : updates.outstandingPrincipal <= 0
        ? 'closed'
        : updates.status;

    const updatedRecord: LoanRecord = {
      ...existing,
      ...updates,
      status: computedStatus,
      id,
      transactionDate: updates.startDate || existing.transactionDate,
      updatedAt: nowIso,
    };

    const validation = validateLoanRecord(updatedRecord);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    await db.transaction('rw', [db.loans, db.emiPayments], async () => {
      await db.loans.put(updatedRecord);

      if (existing.name !== updatedRecord.name) {
        await db.emiPayments
          .where('loanId')
          .equals(id)
          .modify((emi) => {
            emi.loanName = updatedRecord.name;
            emi.updatedAt = nowIso;
          });
      }
    });

    return updatedRecord;
  },

  /**
   * Deletes a loan and its EMI payment records atomically, restoring source account balances.
   */
  async deleteLoan(id: string): Promise<void> {
    const nowIso = new Date().toISOString();

    await db.transaction('rw', [db.loans, db.emiPayments, db.accounts], async () => {
      const payments = await db.emiPayments.where('loanId').equals(id).toArray();

      for (const p of payments) {
        if (p.accountId) {
          const acc = await db.accounts.get(p.accountId);
          if (acc) {
            await db.accounts.update(acc.id, {
              currentBalance: acc.currentBalance + p.totalAmount,
              updatedAt: nowIso,
            });
          }
        }
      }

      await db.emiPayments.where('loanId').equals(id).delete();
      await db.loans.delete(id);
    });
  },

  /**
   * Records a monthly EMI payment with explicit separation of Principal vs Interest.
   *
   * Business Rule:
   * - Outstanding principal is NEVER blindly reduced by the full EMI amount.
   * - Only principalComponent (or an explicit manual remainingPrincipalOverride) reduces outstandingPrincipal.
   */
  async recordEmiPayment(input: {
    loanId: string;
    transactionDate: string;
    totalAmount: number;
    principalComponent: number;
    interestComponent: number;
    remainingPrincipalOverride?: number;
    accountId: string;
    accountName: string;
    paymentMode: EmiPaymentRecord['paymentMode'];
    notes?: string;
  }): Promise<EmiPaymentRecord> {
    const nowIso = new Date().toISOString();
    const month = toMonthKey(input.transactionDate);
    const fingerprint = createFingerprint(
      input.loanId,
      month,
      input.transactionDate,
      input.totalAmount
    );

    let savedPayment!: EmiPaymentRecord;

    await db.transaction('rw', [db.emiPayments, db.loans, db.accounts], async () => {
      const loan = await db.loans.get(input.loanId);
      if (!loan) {
        throw new Error('Associated loan not found in IndexedDB.');
      }

      const duplicate = await db.emiPayments
        .where('fingerprint')
        .equals(fingerprint)
        .first();
      if (duplicate) {
        throw new Error(
          `Duplicate EMI payment prevented for "${loan.name}" on ${input.transactionDate}.`
        );
      }

      const nextPrincipal =
        typeof input.remainingPrincipalOverride === 'number'
          ? Math.max(0, input.remainingPrincipalOverride)
          : Math.max(0, loan.outstandingPrincipal - input.principalComponent);

      const record: EmiPaymentRecord = {
        id: generateId('emi'),
        loanId: loan.id,
        loanName: loan.name,
        transactionDate: input.transactionDate,
        month,
        totalAmount: input.totalAmount,
        principalComponent: input.principalComponent,
        interestComponent: input.interestComponent,
        remainingPrincipalAfter: nextPrincipal,
        accountId: input.accountId,
        accountName: input.accountName,
        paymentMode: input.paymentMode,
        notes: input.notes?.trim() || undefined,
        fingerprint,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const validation = validateEmiPaymentRecord(record);
      if (!validation.valid) {
        throw new Error(validation.errors.join(' '));
      }

      await db.emiPayments.add(record);

      await db.loans.update(loan.id, {
        outstandingPrincipal: nextPrincipal,
        status: nextPrincipal <= 0 ? 'closed' : loan.status,
        updatedAt: nowIso,
      });

      if (record.accountId) {
        const account = await db.accounts.get(record.accountId);
        if (account) {
          await db.accounts.update(account.id, {
            currentBalance: account.currentBalance - record.totalAmount,
            updatedAt: nowIso,
          });
        }
      }

      savedPayment = record;
    });

    return savedPayment;
  },

  /**
   * Deletes an EMI payment record and atomically restores the principalComponent
   * back to the loan's outstandingPrincipal and restores the bank account balance.
   */
  async deleteEmiPayment(emiId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    await db.transaction('rw', [db.emiPayments, db.loans, db.accounts], async () => {
      const existing = await db.emiPayments.get(emiId);
      if (!existing) return;

      const loan = await db.loans.get(existing.loanId);
      if (loan) {
        const restoredPrincipal = Math.min(
          loan.originalAmount,
          loan.outstandingPrincipal + existing.principalComponent
        );
        await db.loans.update(loan.id, {
          outstandingPrincipal: restoredPrincipal,
          status: restoredPrincipal > 0 ? 'active' : loan.status,
          updatedAt: nowIso,
        });
      }

      if (existing.accountId) {
        const account = await db.accounts.get(existing.accountId);
        if (account) {
          await db.accounts.update(account.id, {
            currentBalance: account.currentBalance + existing.totalAmount,
            updatedAt: nowIso,
          });
        }
      }

      await db.emiPayments.delete(emiId);
    });
  },

  /**
   * Runs an automated non-destructive self-test of IndexedDB transactions,
   * duplicate prevention rules, and goal synchronization, then cleans up temporary records.
   */
  async runFoundationSelfTest(): Promise<{
    passed: boolean;
    steps: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }>;
  }> {
    const steps: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }> = [];
    const testMonth = '2099-12';
    const testDate = '2099-12-15';

    let createdSalaryId = '';
    let createdGoalId = '';
    let createdContribId = '';

    try {
      const salary = await this.addIncome({
        type: 'salary',
        salaryMonth: testMonth,
        transactionDate: testDate,
        status: 'credited',
        amount: 120000,
        employer: 'SelfTest Corp',
        accountId: 'acc_salary_bank',
        bankAccountName: 'Primary Salary Bank Account',
        description: 'Self-test salary credit',
      });
      createdSalaryId = salary.id;
      steps.push({
        name: 'IndexedDB Salary Write & Validation',
        status: 'PASS',
        detail: `Inserted credited salary (${salary.id}) for ${testMonth} in IndexedDB.`,
      });

      let duplicateBlocked = false;
      try {
        await this.addIncome({
          type: 'salary',
          salaryMonth: testMonth,
          transactionDate: testDate,
          status: 'credited',
          amount: 120000,
          employer: 'selftest corp',
          accountId: 'acc_salary_bank',
          bankAccountName: 'Primary Salary Bank Account',
          description: 'Duplicate attempt',
        });
      } catch {
        duplicateBlocked = true;
      }

      steps.push({
        name: 'Duplicate Salary Prevention Rule',
        status: duplicateBlocked ? 'PASS' : 'FAIL',
        detail: duplicateBlocked
          ? 'Correctly rejected duplicate salary for the same month & employer.'
          : 'Failed to block duplicate salary.',
      });

      const goal = await this.addSavingsGoal({
        name: 'SelfTest Emergency Goal',
        targetAmount: 300000,
        currentContribution: 50000,
        startDate: testDate,
        targetDate: '2100-12-15',
        priority: 'High',
        status: 'active',
        category: 'savings',
      });
      createdGoalId = goal.id;

      const contrib = await this.addSavingsContribution({
        goalId: goal.id,
        goalName: goal.name,
        transactionDate: testDate,
        amount: 10000,
        contributionType: 'savings',
        sourceAccountId: 'acc_salary_bank',
        sourceAccountName: 'Primary Salary Bank Account',
        paymentMode: 'Bank Transfer',
        notes: 'Self-test contribution',
      });
      createdContribId = contrib.id;

      const updatedGoal = await db.savingsGoals.get(goal.id);
      const syncWorked = updatedGoal?.currentContribution === 60000;
      steps.push({
        name: 'Transactional Goal Contribution Sync',
        status: syncWorked ? 'PASS' : 'FAIL',
        detail: syncWorked
          ? 'Adding ₹10,000 contribution atomically updated goal from ₹50,000 to ₹60,000 (20.0%).'
          : 'Goal contribution did not synchronize.',
      });

      await this.deleteSavingsContribution(contrib.id);
      createdContribId = '';
      const goalAfterDelete = await db.savingsGoals.get(goal.id);
      const rollbackWorked = goalAfterDelete?.currentContribution === 50000;
      steps.push({
        name: 'Contribution Deletion Goal Recalculation',
        status: rollbackWorked ? 'PASS' : 'FAIL',
        detail: rollbackWorked
          ? 'Deleting ₹10,000 contribution atomically restored goal to ₹50,000.'
          : 'Goal contribution failed to recalculate on delete.',
      });

      const localStorageKeys = Object.keys(window.localStorage);
      const hasFinancialLeak = localStorageKeys.some((k) =>
        /income|expense|salary|loan|goal|budget/i.test(k)
      );
      steps.push({
        name: 'Zero Financial Data in localStorage Check',
        status: !hasFinancialLeak ? 'PASS' : 'FAIL',
        detail: !hasFinancialLeak
          ? 'Verified 0 financial records stored in window.localStorage.'
          : 'Detected unexpected keys in localStorage.',
      });
    } finally {
      await db.transaction(
        'rw',
        [db.income, db.savingsGoals, db.savingsContributions, db.accounts],
        async () => {
          if (createdContribId) {
            await db.savingsContributions.delete(createdContribId);
          }
          if (createdGoalId) {
            await db.savingsGoals.delete(createdGoalId);
          }
          if (createdSalaryId) {
            const sal = await db.income.get(createdSalaryId);
            if (sal && sal.accountId) {
              const acc = await db.accounts.get(sal.accountId);
              if (acc) {
                await db.accounts.update(acc.id, {
                  currentBalance: acc.currentBalance - sal.amount,
                });
              }
            }
            await db.income.delete(createdSalaryId);
          }
        }
      );
    }

    const passed = steps.every((s) => s.status === 'PASS');
    return { passed, steps };
  },
};
