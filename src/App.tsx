import React, { useEffect, useRef, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { QuickTransactionModal } from './components/modals/QuickTransactionModal';
import { PinLockGate } from './components/security/PinLockGate';
import { useFinanceData } from './hooks/useFinanceData';
import { usePwaManager } from './hooks/usePwaManager';
import type { PageRoute, ViewportWidthPreset } from './types/navigation';
import { getCurrentMonthYYYYMM } from './utilities/formatters';
import { DashboardPage } from './pages/DashboardPage';
import { IncomePage } from './pages/IncomePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { FamilyMembersPage } from './pages/FamilyMembersPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { SavingsGoalsPage } from './pages/SavingsGoalsPage';
import { LoansEmiPage } from './pages/LoansEmiPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageRoute>('dashboard');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [viewportPreset, setViewportPreset] = useState<ViewportWidthPreset>('auto');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthYYYYMM());
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [initialEditTxId, setInitialEditTxId] = useState<string | null>(null);
  const initialLockCheckedRef = useRef(false);
  const pwaStatus = usePwaManager();

  const {
    isReady,
    demoMode,
    theme,
    expectedSalaryCreditDay,
    pinEnabled,
    autoLockMinutes,
    lastBackupDate,
    financialYear,
    toggleDemoMode,
    toggleTheme,
    monthlySummary,
    totalMonthlyEmiCommitment,
    totalOutstandingLoanPrincipal,
    categoryBreakdown,
    familyBreakdown,
    goalsSummary,
    unifiedTransactions,
    monthlyTrend,
    categories,
    familyMembers,
    accounts,
    income,
    expenses,
    savingsGoals,
    savingsContributions,
    loans,
    emiPayments,
    budgets,
    transfers,
  } = useFinanceData(selectedMonth);

  // Lock on initial startup if user has enabled PIN lock
  useEffect(() => {
    if (isReady && !initialLockCheckedRef.current) {
      initialLockCheckedRef.current = true;
      if (pinEnabled) {
        setIsAppLocked(true);
      }
    }
  }, [isReady, pinEnabled]);

  return (
    <PinLockGate
      pinEnabled={pinEnabled}
      autoLockMinutes={autoLockMinutes}
      isLocked={isAppLocked}
      onUnlock={() => setIsAppLocked(false)}
      onLockNow={() => setIsAppLocked(true)}
    >
      <AppShell
        activePage={activePage}
        onNavigate={setActivePage}
        onOpenQuickAdd={() => setQuickAddOpen(true)}
        demoMode={demoMode}
        onToggleDemoMode={() => toggleDemoMode()}
        theme={theme}
        onToggleTheme={toggleTheme}
        selectedMonth={selectedMonth}
        financialYear={financialYear}
        viewportPreset={viewportPreset}
        onChangeViewportPreset={setViewportPreset}
        pwaStatus={pwaStatus}
      >
        {activePage === 'dashboard' && (
          <DashboardPage
            summary={monthlySummary}
            totalMonthlyEmi={totalMonthlyEmiCommitment}
            totalOutstandingPrincipal={totalOutstandingLoanPrincipal}
            budgets={budgets}
            loans={loans}
            categoryBreakdown={categoryBreakdown}
            familyBreakdown={familyBreakdown}
            savingsGoals={savingsGoals}
            recentTransactions={unifiedTransactions}
            monthlyTrend={monthlyTrend}
            demoMode={demoMode}
            onEnableDemoMode={() => toggleDemoMode(true)}
            onOpenQuickAdd={() => setQuickAddOpen(true)}
            onNavigate={setActivePage}
            onEditTransaction={(txId) => {
              setInitialEditTxId(txId);
              setActivePage('transactions');
            }}
          />
        )}

        {activePage === 'income' && (
          <IncomePage
            incomeRecords={income}
            accounts={accounts}
            summary={monthlySummary}
            selectedMonth={selectedMonth}
            onChangeSelectedMonth={setSelectedMonth}
            expectedSalaryCreditDay={expectedSalaryCreditDay}
            demoMode={demoMode}
            onDisableDemoMode={() => toggleDemoMode(false)}
          />
        )}

        {activePage === 'expenses' && (
          <ExpensesPage
            expenses={expenses}
            categories={categories}
            familyMembers={familyMembers}
            accounts={accounts}
            selectedMonth={selectedMonth}
            onChangeSelectedMonth={setSelectedMonth}
            categoryBreakdown={categoryBreakdown}
            familyBreakdown={familyBreakdown}
            demoMode={demoMode}
            onDisableDemoMode={() => toggleDemoMode(false)}
          />
        )}

        {activePage === 'transactions' && (
          <TransactionsPage
            transactions={unifiedTransactions}
            onOpenQuickAdd={() => setQuickAddOpen(true)}
            income={income}
            expenses={expenses}
            savingsContributions={savingsContributions}
            emiPayments={emiPayments}
            transfers={transfers}
            categories={categories}
            familyMembers={familyMembers}
            accounts={accounts}
            savingsGoals={savingsGoals}
            loans={loans}
            demoMode={demoMode}
            onDisableDemoMode={() => toggleDemoMode(false)}
            initialEditTxId={initialEditTxId}
            onClearInitialEditTx={() => setInitialEditTxId(null)}
          />
        )}

        {activePage === 'family' && (
          <FamilyMembersPage
            familyMembers={familyMembers}
            expenses={expenses}
            selectedMonth={selectedMonth}
            familyBreakdown={familyBreakdown}
            demoMode={demoMode}
            onDisableDemoMode={() => toggleDemoMode(false)}
          />
        )}

        {activePage === 'budgets' && (
          <BudgetsPage
            budgets={budgets}
            summary={monthlySummary}
            selectedMonth={selectedMonth}
            onChangeSelectedMonth={setSelectedMonth}
            categories={categories}
            familyMembers={familyMembers}
            expenses={expenses}
            categoryBreakdown={categoryBreakdown}
            familyBreakdown={familyBreakdown}
            demoMode={demoMode}
            onDisableDemoMode={() => toggleDemoMode(false)}
          />
        )}

        {activePage === 'goals' && (
          <SavingsGoalsPage
            goals={savingsGoals}
            contributions={savingsContributions}
            accounts={accounts}
            summary={monthlySummary}
            selectedMonth={selectedMonth}
            onChangeSelectedMonth={setSelectedMonth}
            goalsSummary={goalsSummary}
            demoMode={demoMode}
            onDisableDemoMode={() => toggleDemoMode(false)}
          />
        )}

        {activePage === 'loans' && (
          <LoansEmiPage
            loans={loans}
            emiPayments={emiPayments}
            accounts={accounts}
            selectedMonth={selectedMonth}
            onChangeSelectedMonth={setSelectedMonth}
            totalMonthlyEmi={totalMonthlyEmiCommitment}
            totalOutstandingPrincipal={totalOutstandingLoanPrincipal}
            demoMode={demoMode}
            onDisableDemoMode={() => toggleDemoMode(false)}
          />
        )}

        {activePage === 'reports' && (
          <ReportsPage
            summary={monthlySummary}
            selectedMonth={selectedMonth}
            onChangeSelectedMonth={setSelectedMonth}
            income={income}
            expenses={expenses}
            savingsGoals={savingsGoals}
            savingsContributions={savingsContributions}
            budgets={budgets}
            loans={loans}
            emiPayments={emiPayments}
            categories={categories}
            familyMembers={familyMembers}
          />
        )}

        {activePage === 'settings' && (
          <SettingsPage
            demoMode={demoMode}
            onToggleDemoMode={() => toggleDemoMode()}
            theme={theme}
            onToggleTheme={toggleTheme}
            viewportPreset={viewportPreset}
            onChangeViewportPreset={setViewportPreset}
            pinEnabled={pinEnabled}
            autoLockMinutes={autoLockMinutes}
            lastBackupDate={lastBackupDate}
            onLockAppNow={() => setIsAppLocked(true)}
            pwaStatus={pwaStatus}
          />
        )}
      </AppShell>

      <QuickTransactionModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        categories={categories}
        familyMembers={familyMembers}
        accounts={accounts}
        savingsGoals={savingsGoals}
        demoMode={demoMode}
        onDisableDemoMode={() => toggleDemoMode(false)}
      />
    </PinLockGate>
  );
};

export default App;
