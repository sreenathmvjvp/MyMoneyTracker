import type {
  AccountRecord,
  BaseRecord,
  BudgetRecord,
  CategoryRecord,
  EmiPaymentRecord,
  ExpenseRecord,
  FamilyMemberRecord,
  IncomeRecord,
  LoanRecord,
  SavingsContributionRecord,
  SavingsGoalRecord,
  TransferRecord,
  ValidationResult,
} from '../types';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;

/**
 * Validates common base fields required on every database record:
 * - Unique ID
 * - Created date
 * - Updated date
 * - Relevant transaction date
 */
export function validateBaseRecord(record: Partial<BaseRecord>): string[] {
  const errors: string[] = [];

  if (!record.id || typeof record.id !== 'string' || !record.id.trim()) {
    errors.push('Record must have a valid unique ID.');
  }
  if (!record.createdAt || Number.isNaN(Date.parse(record.createdAt))) {
    errors.push('Record must have a valid createdAt timestamp.');
  }
  if (!record.updatedAt || Number.isNaN(Date.parse(record.updatedAt))) {
    errors.push('Record must have a valid updatedAt timestamp.');
  }
  if (!record.transactionDate || !ISO_DATE_REGEX.test(record.transactionDate)) {
    errors.push('Record must have a valid transactionDate in YYYY-MM-DD format.');
  }

  return errors;
}

export function validatePositiveAmount(amount: unknown, fieldLabel = 'Amount'): string[] {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return [`${fieldLabel} must be a valid number greater than ₹0.`];
  }
  if (amount > 1_000_000_000) {
    return [`${fieldLabel} exceeds the maximum allowed limit.`];
  }
  return [];
}

export function validateIncomeRecord(record: Partial<IncomeRecord>): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.amount, 'Income amount'),
  ];

  if (!record.salaryMonth || !MONTH_KEY_REGEX.test(record.salaryMonth)) {
    errors.push('Salary/Income month must be in YYYY-MM format.');
  }
  if (!record.employer || !record.employer.trim()) {
    errors.push('Employer or income source is required.');
  }
  if (!record.accountId || !record.accountId.trim()) {
    errors.push('Destination bank account is required.');
  }
  if (!record.type || !['salary', 'bonus', 'interest', 'freelance', 'other'].includes(record.type)) {
    errors.push('Valid income type is required.');
  }
  if (!record.status || !['credited', 'pending'].includes(record.status)) {
    errors.push('Income status must be either credited or pending.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateExpenseRecord(record: Partial<ExpenseRecord>): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.amount, 'Expense amount'),
  ];

  if (!record.categoryId || !record.categoryId.trim()) {
    errors.push('Expense category is required.');
  }
  if (!record.categoryName || !record.categoryName.trim()) {
    errors.push('Expense category name is required.');
  }
  if (!record.familyMemberName || !record.familyMemberName.trim()) {
    errors.push('Family member association is required.');
  }
  if (!record.paymentMode) {
    errors.push('Payment mode is required.');
  }
  if (
    record.categoryName &&
    ['self transfer', 'account transfer'].includes(record.categoryName.trim().toLowerCase())
  ) {
    errors.push('Self-transfers between accounts must not be recorded as expenses.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateCategoryRecord(record: Partial<CategoryRecord>): ValidationResult {
  const errors = validateBaseRecord(record);
  if (!record.name || !record.name.trim()) {
    errors.push('Category name is required.');
  }
  if (!record.group) {
    errors.push('Category group is required.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateFamilyMemberRecord(record: Partial<FamilyMemberRecord>): ValidationResult {
  const errors = validateBaseRecord(record);
  if (!record.name || !record.name.trim()) {
    errors.push('Family member name is required.');
  }
  if (!record.relationship) {
    errors.push('Family member relationship is required.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateBudgetRecord(record: Partial<BudgetRecord>): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.plannedAmount, 'Planned budget amount'),
  ];
  if (!record.month || !MONTH_KEY_REGEX.test(record.month)) {
    errors.push('Budget month must be in YYYY-MM format.');
  }
  if (!record.targetId || !record.targetName) {
    errors.push('Budget target is required.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateSavingsGoalRecord(record: Partial<SavingsGoalRecord>): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.targetAmount, 'Goal target amount'),
  ];
  if (!record.name || !record.name.trim()) {
    errors.push('Savings goal name is required.');
  }
  if (
    typeof record.currentContribution !== 'number' ||
    !Number.isFinite(record.currentContribution) ||
    record.currentContribution < 0
  ) {
    errors.push('Current contribution cannot be negative.');
  }
  if (!record.startDate || !ISO_DATE_REGEX.test(record.startDate)) {
    errors.push('Valid target start date is required.');
  }
  if (!record.targetDate || !ISO_DATE_REGEX.test(record.targetDate)) {
    errors.push('Valid target completion date is required.');
  }
  if (
    record.startDate &&
    record.targetDate &&
    ISO_DATE_REGEX.test(record.startDate) &&
    ISO_DATE_REGEX.test(record.targetDate) &&
    record.targetDate < record.startDate
  ) {
    errors.push('Target completion date must be on or after the start date.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateSavingsContributionRecord(
  record: Partial<SavingsContributionRecord>
): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.amount, 'Contribution amount'),
  ];
  if (!record.goalId || !record.goalId.trim()) {
    errors.push('Target savings goal is required.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateLoanRecord(record: Partial<LoanRecord>): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.originalAmount, 'Original loan amount'),
    ...validatePositiveAmount(record.monthlyEmi, 'Monthly EMI amount'),
  ];
  if (!record.name || !record.name.trim()) {
    errors.push('Loan name is required.');
  }
  if (!record.bank || !record.bank.trim()) {
    errors.push('Lender / Bank name is required.');
  }
  if (
    typeof record.outstandingPrincipal !== 'number' ||
    !Number.isFinite(record.outstandingPrincipal) ||
    record.outstandingPrincipal < 0
  ) {
    errors.push('Outstanding principal must be 0 or greater.');
  }
  if (
    typeof record.interestRate !== 'number' ||
    !Number.isFinite(record.interestRate) ||
    record.interestRate < 0 ||
    record.interestRate > 100
  ) {
    errors.push('Interest rate must be between 0% and 100%.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateEmiPaymentRecord(record: Partial<EmiPaymentRecord>): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.totalAmount, 'Total EMI amount'),
  ];
  if (!record.loanId || !record.loanId.trim()) {
    errors.push('Associated loan ID is required.');
  }
  if (
    typeof record.principalComponent !== 'number' ||
    !Number.isFinite(record.principalComponent) ||
    record.principalComponent < 0
  ) {
    errors.push('Principal component must be 0 or greater.');
  }
  if (
    typeof record.interestComponent !== 'number' ||
    !Number.isFinite(record.interestComponent) ||
    record.interestComponent < 0
  ) {
    errors.push('Interest component must be 0 or greater.');
  }
  if (
    typeof record.totalAmount === 'number' &&
    Number.isFinite(record.totalAmount) &&
    typeof record.principalComponent === 'number' &&
    Number.isFinite(record.principalComponent) &&
    record.principalComponent > record.totalAmount
  ) {
    errors.push('Principal component cannot exceed total EMI amount.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateAccountRecord(record: Partial<AccountRecord>): ValidationResult {
  const errors = validateBaseRecord(record);
  if (!record.name || !record.name.trim()) {
    errors.push('Account name is required.');
  }
  if (typeof record.openingBalance !== 'number' || !Number.isFinite(record.openingBalance)) {
    errors.push('Opening balance must be a valid number.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateTransferRecord(record: Partial<TransferRecord>): ValidationResult {
  const errors = [
    ...validateBaseRecord(record),
    ...validatePositiveAmount(record.amount, 'Transfer amount'),
  ];
  if (!record.fromAccountId || !record.toAccountId) {
    errors.push('Both source and destination accounts are required.');
  }
  if (record.fromAccountId && record.fromAccountId === record.toAccountId) {
    errors.push('Source and destination accounts cannot be identical.');
  }
  return { valid: errors.length === 0, errors };
}
