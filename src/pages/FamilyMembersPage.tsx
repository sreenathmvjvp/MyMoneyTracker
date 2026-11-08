import React, { useMemo, useState } from 'react';
import {
  Users,
  CheckCircle2,
  UserCheck,
  Plus,
  Pencil,
  Power,
  X,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import type {
  ExpenseRecord,
  FamilyMemberRecord,
  FamilyRelationship,
} from '../types';
import type { FamilyBreakdownItem } from '../reports/reportEngine';
import { databaseService } from '../services/databaseService';
import {
  formatDateDDMMMYYYY,
  formatINR,
  formatMonthLabel,
} from '../utilities/formatters';

interface FamilyMembersPageProps {
  familyMembers: FamilyMemberRecord[];
  expenses: ExpenseRecord[];
  selectedMonth: string;
  familyBreakdown: FamilyBreakdownItem[];
  demoMode: boolean;
  onDisableDemoMode: () => Promise<void>;
}

const RELATIONSHIPS: FamilyRelationship[] = [
  'Self',
  'Spouse',
  'Children',
  'Parents',
  'Entire Family',
  'Other',
];

export const FamilyMembersPage: React.FC<FamilyMembersPageProps> = ({
  familyMembers,
  expenses,
  selectedMonth,
  familyBreakdown,
  demoMode,
  onDisableDemoMode,
}) => {
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMemberRecord | null>(null);
  const [memberName, setMemberName] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('Children');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // All-time and monthly spend per member
  const memberAnalytics = useMemo(() => {
    return familyMembers.map((member) => {
      const monthStats = familyBreakdown.find(
        (b) => b.familyMemberId === member.id || b.familyMemberName === member.name
      );
      const allTimeTxns = expenses.filter(
        (e) => e.familyMemberId === member.id || e.familyMemberName === member.name
      );
      const allTimeTotal = allTimeTxns.reduce((s, e) => s + e.amount, 0);

      return {
        member,
        monthlySpent: monthStats?.totalAmount ?? 0,
        monthlySharePct: monthStats?.percentage ?? 0,
        monthlyTxnCount: monthStats?.transactionCount ?? 0,
        allTimeTotal,
        allTimeTxnCount: allTimeTxns.length,
      };
    });
  }, [familyMembers, familyBreakdown, expenses]);

  const filteredMemberExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        const matchMonth = e.month === selectedMonth;
        const matchMember =
          selectedMemberFilter === 'ALL' ||
          e.familyMemberName === selectedMemberFilter ||
          e.familyMemberId === selectedMemberFilter;
        return matchMonth && matchMember;
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [expenses, selectedMonth, selectedMemberFilter]);

  const openAddMemberModal = () => {
    setEditingMember(null);
    setMemberName('');
    setRelationship('Children');
    setDescription('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditMemberModal = (member: FamilyMemberRecord) => {
    setEditingMember(member);
    setMemberName(member.name);
    setRelationship(member.relationship);
    setDescription(member.description ?? '');
    setIsActive(member.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!memberName.trim()) {
      setFormError('Member Name is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (demoMode) {
        await onDisableDemoMode();
      }

      if (editingMember) {
        await databaseService.updateFamilyMember(editingMember.id, {
          name: memberName.trim(),
          relationship,
          description: description.trim() || undefined,
          isActive,
        });
        showToast(`Updated family member "${memberName.trim()}" in IndexedDB.`);
      } else {
        await databaseService.addFamilyMember({
          name: memberName.trim(),
          relationship,
          description: description.trim() || undefined,
          isActive,
        });
        showToast(`Added family member "${memberName.trim()}" to IndexedDB!`);
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActiveStatus = async (member: FamilyMemberRecord) => {
    try {
      if (demoMode) {
        await onDisableDemoMode();
      }
      const updated = await databaseService.toggleFamilyMemberStatus(member.id);
      showToast(
        `${updated.name} is now ${
          updated.isActive ? 'Active' : 'Inactive (historical expenses preserved)'
        }.`
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      {toastMsg && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/70 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-emerald-600 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
            Family Members & Expense Allocation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage family member profiles (Self, Spouse, Children, Parents, Entire Family) & track member-wise totals
          </p>
        </div>
        <button
          type="button"
          onClick={openAddMemberModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Family Member</span>
        </button>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {memberAnalytics.map(
          ({
            member,
            monthlySpent,
            monthlySharePct,
            monthlyTxnCount,
            allTimeTotal,
            allTimeTxnCount,
          }) => (
            <div
              key={member.id}
              className={`rounded-2xl border p-4 shadow-xs transition ${
                member.isActive
                  ? 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
                  : 'border-slate-200/50 dark:border-slate-800/50 bg-slate-100/70 dark:bg-slate-900/50 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {member.name}
                    </h3>
                    <span className="text-xs text-slate-500">
                      Relationship: <strong>{member.relationship}</strong>
                    </span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    member.isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {member.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 min-h-[2rem]">
                {member.description || 'Family expense tracking profile'}
              </p>

              {/* Progress bar for monthly share */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${monthlySharePct}%` }}
                />
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400">
                    {formatMonthLabel(selectedMonth)} Spend
                  </span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatINR(monthlySpent)}
                  </p>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                    {monthlySharePct}% share ({monthlyTxnCount} txns)
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Cumulative Total</span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {formatINR(allTimeTotal)}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {allTimeTxnCount} total records
                  </span>
                </div>
              </div>

              {/* Actions: Filter Transactions, Edit, Activate/Deactivate */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberFilter(member.name)}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  View Transactions →
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditMemberModal(member)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-emerald-500 cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActiveStatus(member)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-amber-500 cursor-pointer"
                    title="Deactivating a member preserves all historical transactions"
                  >
                    <Power className="h-3 w-3" />
                    {member.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Member-wise Filtered Expense Transactions */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Family Expense Transactions ({formatMonthLabel(selectedMonth)})
            </h2>
            <p className="text-xs text-slate-500">
              Click any member pill below to inspect their allocated expenses
            </p>
          </div>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            Selected Member Total:{' '}
            {formatINR(filteredMemberExpenses.reduce((s, e) => s + e.amount, 0))}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {['ALL', ...familyMembers.map((m) => m.name)].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedMemberFilter(name)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                selectedMemberFilter === name
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {name === 'ALL' ? 'All Family Members' : name}
            </button>
          ))}
        </div>

        {filteredMemberExpenses.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">
            No expenses allocated to {selectedMemberFilter} in {formatMonthLabel(selectedMonth)}.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredMemberExpenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Receipt className="h-4 w-4 text-rose-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-white">
                      {exp.description}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatDateDDMMMYYYY(exp.transactionDate)} • {exp.categoryName} (
                      {exp.subcategory}) • Paid by {exp.paidBy} ({exp.paymentMode})
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-rose-600">-{formatINR(exp.amount)}</p>
                  <span className="text-[10px] text-blue-600 font-semibold">
                    {exp.familyMemberName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
        <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        <span>
          <strong>Data Integrity Rule:</strong> Deactivating a family member hides them from quick
          entry dropdowns while keeping all historical expenses intact for accurate past reports.
        </span>
      </div>

      {/* ADD / EDIT FAMILY MEMBER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingMember ? 'Edit Family Member' : 'Add Family Member'}
                </h3>
                <p className="text-xs text-slate-500">
                  Track individual and shared family expenses in IndexedDB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="mt-4 space-y-3.5">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Member Name *
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav (Son), Mother, Spouse"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Relationship *
                  </span>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as FamilyRelationship)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Profile Status
                  </span>
                  <select
                    value={isActive ? 'active' : 'inactive'}
                    onChange={(e) => setIsActive(e.target.value === 'active')}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Description (Optional)
                </span>
                <input
                  type="text"
                  placeholder="e.g. School fees, books & sports coaching"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving...'
                    : editingMember
                    ? 'Update Member'
                    : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
