import React, { useState } from 'react';
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
} from 'lucide-react';
import type { UnifiedTransactionItem } from '../types/navigation';
import { formatDateDDMMMYYYY, formatINR } from '../utilities/formatters';

interface TransactionsPageProps {
  transactions: UnifiedTransactionItem[];
  onOpenQuickAdd: () => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  onOpenQuickAdd,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState<'all' | 'income' | 'expense' | 'savings' | 'emi' | 'transfer'>('all');

  const filtered = transactions.filter((tx) => {
    const matchKind = filterKind === 'all' || tx.kind === filterKind;
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      tx.title.toLowerCase().includes(q) ||
      tx.subtitle.toLowerCase().includes(q) ||
      tx.category.toLowerCase().includes(q) ||
      (tx.familyMember && tx.familyMember.toLowerCase().includes(q)) ||
      (tx.paymentMode && tx.paymentMode.toLowerCase().includes(q));
    return matchKind && matchQuery;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            All Transactions Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unified view of Income, Expenses, Goal Contributions, EMIs & Self-Transfers
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Transaction</span>
        </button>
      </div>

      {/* Search & Kind Filter */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by description, category, family member, or payment mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'All Types' },
            { id: 'expense', label: 'Expenses' },
            { id: 'income', label: 'Income' },
            { id: 'savings', label: 'Savings Contrib.' },
            { id: 'emi', label: 'Loan EMIs' },
            { id: 'transfer', label: 'Self Transfers' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id as typeof filterKind)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                filterKind === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Feed */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Matching Transactions ({filtered.length})
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No transactions match your search or filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((tx) => {
              const isPositive = tx.kind === 'income';
              const isNeutral = tx.kind === 'transfer' || tx.kind === 'savings';

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        tx.kind === 'income'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                          : tx.kind === 'savings'
                          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                          : tx.kind === 'transfer'
                          ? 'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400'
                          : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.kind === 'income' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : tx.kind === 'transfer' ? (
                        <ArrowLeftRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold sm:text-sm text-slate-900 dark:text-white">
                        {tx.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{formatDateDDMMMYYYY(tx.date)}</span>
                        <span>•</span>
                        <span>{tx.subtitle}</span>
                        {tx.familyMember && (
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium">
                            {tx.familyMember}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-xs font-bold sm:text-sm ${
                        isPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isNeutral
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </p>
                    <p className="text-[10px] text-slate-400">{tx.accountName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
