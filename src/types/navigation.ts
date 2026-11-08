export type PageRoute =
  | 'dashboard'
  | 'income'
  | 'expenses'
  | 'transactions'
  | 'family'
  | 'budgets'
  | 'goals'
  | 'loans'
  | 'reports'
  | 'settings';

export type ViewportWidthPreset = 'auto' | '360' | '390' | '430';

export interface UnifiedTransactionItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  subtitle: string;
  category: string;
  familyMember?: string;
  paymentMode?: string;
  accountName: string;
  amount: number;
  kind: 'income' | 'expense' | 'savings' | 'emi' | 'transfer';
  status?: 'credited' | 'pending' | 'completed';
}

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  surplus: number;
  savings: number;
}
