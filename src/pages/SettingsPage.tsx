import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Sparkles,
  ShieldCheck,
  Database,
  Play,
  Smartphone,
  Download,
  Upload,
  Lock,
  KeyRound,
  FileSpreadsheet,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useDatabaseStatus } from '../hooks/useDatabaseStatus';
import { FoundationStatusCard } from '../components/FoundationStatusCard';
import { databaseService } from '../services/databaseService';
import {
  backupSecurityService,
  type BackupPreviewResult,
} from '../services/backupSecurityService';
import {
  runCompleteQaValidationSuite,
  type QaSuiteReport,
} from '../services/qaAutomationSuite';
import type { PwaStatusInfo } from '../hooks/usePwaManager';
import type { ViewportWidthPreset } from '../types/navigation';
import { formatDateDDMMMYYYY } from '../utilities/formatters';

interface SettingsPageProps {
  demoMode: boolean;
  onToggleDemoMode: () => void;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
  viewportPreset: ViewportWidthPreset;
  onChangeViewportPreset: (preset: ViewportWidthPreset) => void;
  pinEnabled: boolean;
  autoLockMinutes: number;
  lastBackupDate?: string;
  onLockAppNow: () => void;
  pwaStatus?: PwaStatusInfo;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  demoMode,
  onToggleDemoMode,
  theme,
  onToggleTheme,
  viewportPreset,
  onChangeViewportPreset,
  pinEnabled,
  autoLockMinutes,
  lastBackupDate,
  onLockAppNow,
  pwaStatus,
}) => {
  const { isInitialized, schemaVersion, databaseName, tables, totalRecords } =
    useDatabaseStatus();

  // Status Banners
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Encrypted JSON Backup options
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Restore JSON Backup state
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rawBackupContent, setRawBackupContent] = useState<string>('');
  const [decryptPassphrase, setDecryptPassphrase] = useState<string>('');
  const [backupPreview, setBackupPreview] = useState<BackupPreviewResult | null>(
    null
  );
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [confirmRestoreChecked, setConfirmRestoreChecked] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // PIN Security state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [disableCurrentPin, setDisableCurrentPin] = useState('');
  const [selectedAutoLock, setSelectedAutoLock] = useState<number>(
    autoLockMinutes || 5
  );

  // Self-Test states
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [selfTestResult, setSelfTestResult] = useState<{
    passed: boolean;
    steps: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }>;
  } | null>(null);

  const [backupTestRunning, setBackupTestRunning] = useState(false);
  const [backupTestResult, setBackupTestResult] = useState<{
    passed: boolean;
    steps: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }>;
  } | null>(null);

  const [qaSuiteRunning, setQaSuiteRunning] = useState(false);
  const [qaSuiteReport, setQaSuiteReport] = useState<QaSuiteReport | null>(null);

  const clearMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  // 1. Export Full JSON Backup
  const handleExportFullJSON = async () => {
    clearMessages();
    if (encryptBackup && backupPassphrase.trim().length < 4) {
      setErrorMessage(
        'Please enter a passphrase of at least 4 characters to encrypt your JSON backup.'
      );
      return;
    }

    setIsExporting(true);
    try {
      await backupSecurityService.exportFullDatabaseJSON(
        encryptBackup ? backupPassphrase.trim() : undefined
      );
      setStatusMessage(
        encryptBackup
          ? 'Exported AES-256-GCM Encrypted JSON Database Backup successfully.'
          : 'Exported complete IndexedDB JSON Database Backup successfully.'
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to export JSON backup.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Handle JSON File Upload for Restore Preview
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    clearMessages();
    setConfirmRestoreChecked(false);
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const text = await file.text();
    setRawBackupContent(text);
    const preview = await backupSecurityService.validateAndPreviewBackupJSON(
      text,
      decryptPassphrase || undefined
    );
    setBackupPreview(preview);
  };

  const handleUnlockEncryptedPreview = async () => {
    if (!rawBackupContent) return;
    clearMessages();
    const preview = await backupSecurityService.validateAndPreviewBackupJSON(
      rawBackupContent,
      decryptPassphrase
    );
    setBackupPreview(preview);
  };

  // Helper to preview current live database as a backup snapshot without needing external file
  const handlePreviewLiveDatabaseSnapshot = async () => {
    clearMessages();
    setConfirmRestoreChecked(false);
    const envelope = await backupSecurityService.buildDatabaseBackupEnvelope();
    const text = JSON.stringify(envelope, null, 2);
    setSelectedFileName('Current_IndexedDB_Live_Snapshot.json');
    setRawBackupContent(text);
    const preview = await backupSecurityService.validateAndPreviewBackupJSON(text);
    setBackupPreview(preview);
  };

  // 3. Execute Atomic Restore
  const handleExecuteRestore = async () => {
    clearMessages();
    if (!backupPreview?.valid || !backupPreview.parsedEnvelope) {
      setErrorMessage('Please validate a valid JSON backup before restoring.');
      return;
    }
    if (!confirmRestoreChecked) {
      setErrorMessage('Please check the confirmation box before restoring.');
      return;
    }

    setIsRestoring(true);
    try {
      const res = await backupSecurityService.restoreFromValidatedBackup(
        backupPreview.parsedEnvelope,
        restoreMode
      );
      setStatusMessage(
        `Database restore (${res.mode.toUpperCase()} mode) completed atomically: Restored ${
          res.restoredCounts.income
        } income records, ${res.restoredCounts.expenses} expenses, ${
          res.restoredCounts.savingsContributions
        } savings contributions, and ${
          res.restoredCounts.familyMembers
        } family members (${res.skippedDuplicates} duplicate records skipped).`
      );
      setConfirmRestoreChecked(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Database restoration failed.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  // 4. Configure or Update PIN Lock
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!/^\d{4,6}$/.test(newPin.trim())) {
      setErrorMessage('PIN must be 4 to 6 numeric digits.');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      setErrorMessage('New PIN and Confirm PIN do not match.');
      return;
    }

    try {
      await backupSecurityService.enableOrUpdatePinLock(
        newPin.trim(),
        selectedAutoLock
      );
      setNewPin('');
      setConfirmPin('');
      setStatusMessage(
        `Application PIN lock enabled (PBKDF2-SHA256 hashed) with ${selectedAutoLock}-minute inactivity auto-lock.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to enable PIN lock.'
      );
    }
  };

  const handleDisablePin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      await backupSecurityService.disablePinLock(disableCurrentPin);
      setDisableCurrentPin('');
      setStatusMessage('Application PIN lock has been disabled.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not disable PIN lock.'
      );
    }
  };

  const handleChangeAutoLock = async (mins: number) => {
    setSelectedAutoLock(mins);
    await backupSecurityService.updateAutoLockMinutes(mins);
    setStatusMessage(`Updated inactivity auto-lock timer to ${mins} minutes.`);
  };

  const handleRunSelfTest = async () => {
    setSelfTestRunning(true);
    try {
      const res = await databaseService.runFoundationSelfTest();
      setSelfTestResult(res);
    } finally {
      setSelfTestRunning(false);
    }
  };

  const handleRunBackupTest = async () => {
    setBackupTestRunning(true);
    try {
      const res = await backupSecurityService.runBackupRestoreVerificationTest();
      setBackupTestResult(res);
    } finally {
      setBackupTestRunning(false);
    }
  };

  const handleRunCompleteQaSuite = async () => {
    setQaSuiteRunning(true);
    try {
      const report = await runCompleteQaValidationSuite();
      setQaSuiteReport(report);
    } finally {
      setQaSuiteRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
          Settings, Backup &amp; Local Security
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Full JSON Backup &amp; Restore, CSV Exports, Application PIN Lock, and IndexedDB Diagnostics
        </p>
      </div>

      {/* Feedback & Error Alerts */}
      {statusMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/90 dark:bg-emerald-950/40 px-4 py-3 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: BACKUP & EXPORT CENTER (JSON + 5 CSV EXPORTS)
          ===================================================================== */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Local Database Backup &amp; CSV Exports
              </h2>
              <p className="text-xs text-slate-500">
                {lastBackupDate
                  ? `Last JSON Backup: ${formatDateDDMMMYYYY(lastBackupDate.slice(0, 10))}`
                  : 'No JSON backup exported yet — export regularly to protect your device records'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportFullJSON}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <FileJson className="h-4 w-4" />
            <span>
              {isExporting
                ? 'Exporting...'
                : encryptBackup
                ? 'Export Encrypted JSON Backup'
                : 'Export Complete Database (JSON)'}
            </span>
          </button>
        </div>

        {/* Optional Web Crypto AES-256-GCM Backup Encryption */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={encryptBackup}
              onChange={(e) => setEncryptBackup(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Encrypt JSON Backup with Passphrase (Web Crypto AES-256-GCM)</span>
          </label>

          {encryptBackup && (
            <div className="space-y-1.5">
              <input
                type="password"
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
                placeholder="Enter backup encryption passphrase (min 4 chars)"
                className="w-full sm:max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Important: Because there is no cloud server, a forgotten backup passphrase cannot
                be recovered. Store your passphrase safely.
              </p>
            </div>
          )}
        </div>

        {/* 5 Required CSV Exports */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Individual Module CSV Exports
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <button
              type="button"
              onClick={() => backupSecurityService.exportExpensesCSV()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-rose-600" />
              <span>Export Expenses CSV</span>
            </button>

            <button
              type="button"
              onClick={() => backupSecurityService.exportIncomeCSV()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Income CSV</span>
            </button>

            <button
              type="button"
              onClick={() => backupSecurityService.exportSavingsContributionsCSV()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
              <span>Export Savings CSV</span>
            </button>

            <button
              type="button"
              onClick={() => backupSecurityService.exportFamilyTransactionsCSV()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
              <span>Export Family CSV</span>
            </button>

            <button
              type="button"
              onClick={() => backupSecurityService.exportMonthlyFinancialReportsCSV()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600" />
              <span>Monthly Report CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: RESTORE DATABASE FROM JSON BACKUP (WITH PREVIEW & MERGE/REPLACE)
          ===================================================================== */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Restore Database from JSON Backup
              </h2>
              <p className="text-xs text-slate-500">
                Validates format &amp; schema version, previews record counts, and restores atomically via Merge or Replace
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>Select .JSON Backup File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handlePreviewLiveDatabaseSnapshot}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Preview Current DB Snapshot
            </button>
          </div>
        </div>

        {/* Backup Preview & Validation Card */}
        {backupPreview && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  File: {selectedFileName || 'Backup Payload'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Schema Version: <strong>v{backupPreview.schemaVersion}</strong> • Exported:{' '}
                  {backupPreview.exportedAt
                    ? formatDateDDMMMYYYY(backupPreview.exportedAt.slice(0, 10))
                    : 'N/A'}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  backupPreview.valid
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {backupPreview.valid ? 'Format & Schema Validated' : 'Validation Required'}
              </span>
            </div>

            {/* Passphrase Unlock Box for Encrypted Backups */}
            {backupPreview.encrypted && !backupPreview.valid && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-800">
                <input
                  type="password"
                  value={decryptPassphrase}
                  onChange={(e) => setDecryptPassphrase(e.target.value)}
                  placeholder="Enter passphrase to unlock encrypted backup"
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleUnlockEncryptedPreview}
                  className="rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                >
                  Unlock &amp; Preview
                </button>
              </div>
            )}

            {backupPreview.errors.length > 0 && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                {backupPreview.errors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}

            {/* Record Counts Preview Grid (Prompt 8 Required Fields) */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 text-xs">
              <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Income Records</span>
                <strong className="text-sm font-bold text-emerald-600">
                  {backupPreview.counts.income}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Expense Records</span>
                <strong className="text-sm font-bold text-rose-600">
                  {backupPreview.counts.expenses}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Savings Contrib.</span>
                <strong className="text-sm font-bold text-indigo-600">
                  {backupPreview.counts.savingsContributions}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Family Members</span>
                <strong className="text-sm font-bold text-blue-600">
                  {backupPreview.counts.familyMembers}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Savings Goals</span>
                <strong className="text-sm font-bold text-slate-900 dark:text-white">
                  {backupPreview.counts.savingsGoals}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Loans &amp; EMIs</span>
                <strong className="text-sm font-bold text-purple-600">
                  {backupPreview.counts.loans} / {backupPreview.counts.emiPayments}
                </strong>
              </div>
            </div>

            {/* Merge vs Replace Mode + Explicit Confirmation */}
            {backupPreview.valid && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`text-left rounded-xl p-3 border transition cursor-pointer ${
                      restoreMode === 'merge'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Merge with Existing Data (Recommended)
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Preserves all current records and automatically skips duplicate transactions.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('replace')}
                    className={`text-left rounded-xl p-3 border transition cursor-pointer ${
                      restoreMode === 'replace'
                        ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/40'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Replace Existing Database
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Clears current tables and restores the exact state from this backup file.
                    </p>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmRestoreChecked}
                      onChange={(e) => setConfirmRestoreChecked(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      I have reviewed the record counts above and confirm restoring in{' '}
                      <strong className="uppercase">{restoreMode}</strong> mode
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={!confirmRestoreChecked || isRestoring}
                    onClick={handleExecuteRestore}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    {isRestoring ? 'Restoring Atomically...' : 'Confirm & Restore Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          SECTION 3: LOCAL SECURITY & APPLICATION PIN LOCK
          ===================================================================== */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Application PIN Lock &amp; Inactivity Auto-Lock
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    pinEnabled
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {pinEnabled ? 'PIN Active' : 'PIN Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                PBKDF2-SHA256 salted PIN protection with configurable inactivity lock
              </p>
            </div>
          </div>

          {pinEnabled && (
            <button
              type="button"
              onClick={onLockAppNow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-amber-500 px-3.5 py-2 text-xs font-bold text-white dark:text-slate-950 cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Lock App Now</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Set / Change PIN Form */}
          <form
            onSubmit={handleSavePin}
            className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200/60 dark:border-slate-800 space-y-3"
          >
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
              <span>{pinEnabled ? 'Update Application PIN' : 'Enable Application PIN Lock'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  New PIN (4–6 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold tracking-widest text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold tracking-widest text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              {pinEnabled ? 'Update PIN' : 'Enable PIN Lock'}
            </button>
          </form>

          {/* Auto-Lock Timer & Disable PIN */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200/60 dark:border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                Auto-Lock After Inactivity
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[1, 5, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleChangeAutoLock(mins)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                      selectedAutoLock === mins
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {pinEnabled && (
              <form
                onSubmit={handleDisablePin}
                className="pt-2 border-t border-slate-200/70 dark:border-slate-700 flex flex-wrap items-center gap-2"
              >
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={disableCurrentPin}
                  onChange={(e) => setDisableCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter current PIN to disable"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                >
                  Disable PIN Lock
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: PROGRESSIVE WEB APP (PWA), OFFLINE STATUS & ANDROID INSTALL GUIDE
          ===================================================================== */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Progressive Web App (PWA) &amp; Android Installation Guide
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    pwaStatus?.isOnline !== false
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {pwaStatus?.isOnline !== false ? (
                    <>
                      <Wifi className="h-3 w-3" /> Online &amp; Cached
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" /> Offline Mode Active
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Service Worker: <strong>{pwaStatus?.swStatus ?? 'active'}</strong> • Display Mode:{' '}
                <strong>{pwaStatus?.isStandalone ? 'Standalone App' : 'Browser Tab'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pwaStatus && !pwaStatus.isStandalone && (
              <button
                type="button"
                onClick={() => pwaStatus.triggerInstallPrompt()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install App on Device</span>
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                if (!pwaStatus) return;
                const found = await pwaStatus.checkForServiceWorkerUpdate();
                setStatusMessage(
                  found
                    ? 'A new application update was found! Use the banner at the top to apply it.'
                    : 'My Money Tracker is up to date (Service Worker cache v2 verified).'
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
              <span>Check for Updates</span>
            </button>

            <button
              type="button"
              onClick={() => pwaStatus?.triggerTestUpdateNotification()}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Preview Update Banner
            </button>
          </div>
        </div>

        {pwaStatus?.installOutcomeMessage && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-200">
            {pwaStatus.installOutcomeMessage}
          </div>
        )}

        {/* Step-by-Step Android Chrome & Desktop Installation Guide */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
              1
            </span>
            <h3 className="font-bold text-slate-900 dark:text-white pt-1">
              Open in Android Chrome
            </h3>
            <p className="text-[11px] text-slate-500">
              Open your deployed GitHub Pages HTTPS URL (or local network URL) in Google Chrome on
              your Android phone.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
              2
            </span>
            <h3 className="font-bold text-slate-900 dark:text-white pt-1">
              Select &ldquo;Install App&rdquo;
            </h3>
            <p className="text-[11px] text-slate-500">
              Tap the <strong>Install App</strong> button above, or tap the Chrome <strong>⋮</strong>{' '}
              menu (top-right) and choose <strong>Install app</strong> /{' '}
              <strong>Add to Home screen</strong>.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
              3
            </span>
            <h3 className="font-bold text-slate-900 dark:text-white pt-1">
              Launch Standalone Mode
            </h3>
            <p className="text-[11px] text-slate-500">
              Tap the <strong>Money Tracker</strong> icon on your Android home screen. It launches
              full-screen like a native banking app without browser address bars.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
              4
            </span>
            <h3 className="font-bold text-slate-900 dark:text-white pt-1">
              100% Offline Operation
            </h3>
            <p className="text-[11px] text-slate-500">
              Turn off Wi-Fi &amp; mobile data. Add expenses, budgets, or salary entries offline.
              Service worker updates never clear your IndexedDB database.
            </p>
          </div>
        </div>
      </section>

      {/* Appearance & Demo Mode Controls */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Application Theme
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Switch between clean Banking Light and OLED Dark themes
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-slate-700" />
                <span>Light Mode</span>
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Sample Demo Mode
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Preview realistic Indian household data without mixing with real IndexedDB records
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleDemoMode}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer shrink-0 ${
              demoMode
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>{demoMode ? 'Enabled' : 'Disabled'}</span>
          </button>
        </div>
      </div>

      {/* Android Mobile Viewport Width Verifier */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Responsive Screen Width Verifier
              </h2>
              <p className="text-xs text-slate-500">
                Test mobile-first responsiveness at 360px, 390px, 430px, or Full Desktop width
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'auto', label: 'Full / Desktop' },
                { id: '360', label: '360px (Compact Android)' },
                { id: '390', label: '390px (Standard Android)' },
                { id: '430', label: '430px (Large Android)' },
              ] as { id: ViewportWidthPreset; label: string }[]
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChangeViewportPreset(preset.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  viewportPreset === preset.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Local Data Protection & Non-Cloud Advisory */}
      <section className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p className="font-bold text-slate-900 dark:text-white">
            Important Local Storage &amp; Privacy Advisory ({databaseName} • Schema v{schemaVersion})
          </p>
          <p>
            • <strong>Local Browser Data Is Not a Cloud Backup:</strong> All financial records ({totalRecords}{' '}
            records across {tables.length} IndexedDB tables) remain 100% on this device/browser.
            Clearing browser site data or uninstalling the browser will erase local records unless
            you export a JSON backup.
          </p>
          <p>
            • <strong>Zero Plaintext Passwords &amp; Zero Telemetry:</strong> PINs are salted and
            hashed with PBKDF2-SHA256, financial records are never logged to the browser console,
            and personal transaction data is excluded from Git commits.
          </p>
        </div>
      </section>

      {/* Automated Verification Suite: Foundation Self-Test + Backup & Restore Self-Test */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Automated Database, Backup &amp; Security Verification Suite
              </h2>
              <p className="text-xs text-slate-500">
                Test transactional integrity, JSON backup validation, AES-256-GCM encryption, and Merge deduplication
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRunCompleteQaSuite}
              disabled={qaSuiteRunning || !isInitialized}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white hover:opacity-90 px-3.5 py-2 text-xs font-bold text-white dark:text-slate-900 cursor-pointer disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {qaSuiteRunning
                  ? 'Running E2E QA Suite...'
                  : 'Run Full QA Suite (Scenarios A–J)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleRunBackupTest}
              disabled={backupTestRunning || !isInitialized}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {backupTestRunning ? 'Testing Backup...' : 'Test Backup & Restore Engine'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleRunSelfTest}
              disabled={selfTestRunning || !isInitialized}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{selfTestRunning ? 'Testing DB...' : 'Run Database Self-Test'}</span>
            </button>
          </div>
        </div>

        {qaSuiteReport && (
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                End-to-End QA Automation Suite Results ({qaSuiteReport.passedTests}/
                {qaSuiteReport.totalTests} Passed):
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  qaSuiteReport.allPassed
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {qaSuiteReport.allPassed ? 'ALL SCENARIOS PASSED' : 'FAILURES DETECTED'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {qaSuiteReport.results.map((tc) => (
                <div
                  key={tc.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs border border-slate-200/60 dark:border-slate-800"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        {tc.id}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {tc.scenario}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {tc.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      <strong>Actual:</strong> {tc.actual}
                    </p>
                  </div>
                  <span
                    className={`self-start sm:self-center shrink-0 rounded-full px-2.5 py-0.5 font-bold ${
                      tc.status === 'PASS'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {tc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {backupTestResult && (
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Backup, Encryption &amp; Restore Verification Results:
            </p>
            {backupTestResult.steps.map((step) => (
              <div
                key={step.name}
                className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{step.name}</p>
                  <p className="text-slate-500">{step.detail}</p>
                </div>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {selfTestResult && (
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              IndexedDB Foundation Self-Test Results:
            </p>
            {selfTestResult.steps.map((step) => (
              <div
                key={step.name}
                className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{step.name}</p>
                  <p className="text-slate-500">{step.detail}</p>
                </div>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 12 Tables Schema Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <FoundationStatusCard key={t.tableName} table={t} />
        ))}
      </div>
    </div>
  );
};
