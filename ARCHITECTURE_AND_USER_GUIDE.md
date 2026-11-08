# My Money Tracker — Final Architecture Review, Database Schema & User Guide

## 1. Principal Software Architect Verification Matrix

| # | Architectural / Financial Requirement | Implementation & Verification | Status |
| :---: | :--- | :--- | :---: |
| 1 | **100% IndexedDB Storage** | All 12 tables reside in `MyMoneyTrackerIndexedDB` (`Schema v2`) via Dexie.js (`src/database/db.ts`). Zero financial records in `localStorage` or `sessionStorage`. | **VERIFIED** |
| 2 | **Zero External Server Transmission** | 100% local execution; zero `fetch`/`XMLHttpRequest` calls to external servers. Service Worker (`public/sw.js`) caches only same-origin static assets. | **VERIFIED** |
| 3 | **Zero Cloud DB / Third-Party APIs** | No Firebase, Supabase, Plaid, or external banking SDKs exist in `package.json` or source code. | **VERIFIED** |
| 4 | **Dashboard Calculation Consistency** | `calculateMonthlyFinancialSummary` (`src/calculations/financialCalculations.ts`) powers both the Home Dashboard, Interactive Calculator, and Reports Engine. | **VERIFIED** |
| 5 | **No Double-Counting of Salary/Expenses** | Duplicate salary guard (`salaryMonth + employer`) and transaction SHA-style fingerprint deduplication prevent accidental double entries. Pending salary is excluded until marked `credited`. | **VERIFIED** |
| 6 | **Savings Contributions Separate from Expenses** | Stored in `db.savingsContributions` and excluded from `totalExpenses`. Monthly Surplus (`Income − Expenses`) and Savings Contributions are reported independently. | **VERIFIED** |
| 7 | **Family Expense Categorization** | Expenses link to `db.familyMembers` (`Self`, `Spouse`, `Children`, `Parents`, `Entire Family`). Deactivating a member (`isActive = false`) preserves all historical transactions. | **VERIFIED** |
| 8 | **Indian Financial Year (April–March)** | `getIndianFinancialYear` (`src/utilities/formatters.ts`) and `reportEngine.ts` compute `01-Apr-YYYY` to `31-Mar-(YYYY+1)` across `FY 2025-26`, `FY 2026-27`, and subsequent years. | **VERIFIED** |
| 9 | **Historical Record Preservation** | Category/member deactivation, Service Worker updates, and Merge restores preserve all historical records intact. | **VERIFIED** |
| 10 | **JSON Backup & Transactional Restore** | `backupSecurityService.ts` exports full 12-table JSON (plain or `AES-256-GCM` encrypted), previews record counts, and restores atomically in `Merge` or `Replace` mode. | **VERIFIED** |

---

## 2. Database Schema Documentation (`MyMoneyTrackerIndexedDB` — Schema `v2`)

Every record across all 12 tables implements `BaseRecord` (`id`, `transactionDate`, `createdAt`, `updatedAt`) and passes strict validation in `src/utilities/validators.ts` before any IndexedDB write.

| # | Table Name | Dexie Primary Key & Indexes | Purpose & Key Relationships |
| :---: | :--- | :--- | :--- |
| 1 | `income` | `id, salaryMonth, transactionDate, type, status, employer, accountId, [salaryMonth+employer], fingerprint` | Monthly salary & additional income (`bonus`, `interest`, `freelance`, `other`); enforces 1 salary per `salaryMonth + employer`. |
| 2 | `expenses` | `id, transactionDate, month, categoryId, categoryGroup, familyMemberId, paymentMode, accountId, fingerprint` | Daily & family consumption expenses; updates `categories.lastUsedAt` and `accounts.currentBalance` atomically. |
| 3 | `categories` | `id, name, group, type, isDefault, isActive, lastUsedAt` | 21 seeded default categories across `Household`, `Family`, `Financial`, `Personal` + user custom categories & subcategories. |
| 4 | `familyMembers` | `id, name, relationship, isActive` | Family profiles (`Self`, `Spouse`, `Children`, `Parents`, `Entire Family`) with non-destructive active/inactive toggle. |
| 5 | `budgets` | `id, month, budgetType, targetId, [month+budgetType+targetId]` | Monthly overall, category-wise, and family-member-wise budgets with `80%`, `100%`, and `Exceeded` alert flags. |
| 6 | `savingsGoals` | `id, name, priority, status, targetDate, category` | Short-term & long-term savings/investment goals; `currentContribution` and `status` synchronize atomically with `savingsContributions`. |
| 7 | `savingsContributions` | `id, goalId, transactionDate, month, contributionType, sourceAccountId, fingerprint` | Individual savings/investment allocations; adding, editing, or deleting a contribution atomically updates `savingsGoals`. |
| 8 | `loans` | `id, name, bank, status, emiDueDay` | Home, vehicle, personal, and education loan profiles with reducing-balance EMI calculator. |
| 9 | `emiPayments` | `id, loanId, transactionDate, month, accountId, fingerprint` | Monthly EMI payments splitting `principalComponent` and `interestComponent`; reduces `loans.outstandingPrincipal` **only** by `principalComponent`. |
| 10 | `accounts` | `id, name, type, isActive` | Bank accounts and cash wallets tracking `openingBalance` and live `currentBalance`. |
| 11 | `transfers` | `id, transactionDate, month, fromAccountId, toAccountId, fingerprint` | Self-transfers between own accounts; net to `₹0` in available cash and never counted as expenses or income. |
| 12 | `appSettings` | `id` (`'default'`) | App preferences (`INR`, `DD-MMM-YYYY`, `financialYearStartMonth: 4`, `theme`, `demoMode`, `pinHash`, `pinSalt`, `autoLockMinutes`, `lastBackupDate`). |

---

## 3. Security Architecture & Passphrase Recovery Limitations

### 3.1 Application PIN Lock vs. Database Encryption
- **PIN Lock (`PinLockGate.tsx`)**: Protects the user interface on shared phones/computers with a 4–6 digit PIN hashed via **Web Crypto API `PBKDF2-HMAC-SHA256`** (`100,000` iterations + 16-byte random salt) and a configurable inactivity auto-lock timer (`1`, `5`, `15`, `30`, or `60` minutes).
- **Important Distinction**: A UI PIN lock prevents unauthorized screen access, but **is not full-disk/database encryption** of the underlying browser IndexedDB files on an unlocked OS profile.

### 3.2 Optional Encrypted Local Backups (`AES-256-GCM`)
- When exporting a Full JSON Backup in **Settings & Backup**, enabling **Encrypt JSON backup with passphrase** derives a 256-bit key using `PBKDF2-HMAC-SHA256` (`100,000` iterations, random 16-byte salt) and encrypts the entire 12-table payload using **`AES-256-GCM`** with a random 12-byte IV.
- **Passphrase Recovery Limitation**: Because My Money Tracker has no cloud server or account recovery service, **there is no "Forgot Passphrase" reset mechanism**. If you encrypt a backup file and forget its passphrase, that backup file cannot be decrypted by anyone. Always store your backup passphrase safely.

---

## 4. Complete User Guide

1. **Dashboard (Home)**: View all 8 key monthly metrics (`Monthly Income`, `Monthly Expenses`, `Monthly Surplus`, `Savings Contributions`, `Available Balance`, `Total EMI`, `Monthly Budget`, `Budget Utilized %`), interactive charts, and the built-in **Interactive Financial & Savings Goal Calculator**.
2. **Income & Salary**: Record monthly salary once credited (`Credited` vs `Pending` expected status), add bonus/interest/freelance income, and configure your expected salary credit day.
3. **Daily Expenses & Quick Entry**: Tap the floating **`+` Quick Add** button on mobile to log an expense in under 15 seconds using recent category chips, or use the full Expenses page to filter by date, category, family member, and payment mode (`Cash`, `UPI`, `Google Pay`, `PhonePe`, `Debit Card`, `Credit Card`, `Bank Transfer`).
4. **Family Members**: Manage profiles for `Self`, `Spouse`, `Children`, `Parents`, and `Entire Family`. Toggle members inactive without losing historical expense records.
5. **Savings Goals**: Create goals (`Emergency Fund`, `Children's Education`, etc.), record contributions separately from expenses, and track completion `%` and required monthly savings.
6. **Monthly Budgets**: Set overall, category-wise, and family-wise monthly limits, copy budgets from previous months, and monitor `80%`, `100%`, and `Exceeded` visual alerts.
7. **Loans & EMI**: Track loans, calculate reducing-balance EMIs, and record monthly EMI payments with automatic `Principal` vs `Interest` amortization split.
8. **Reports & Analysis**: Analyze 8 interactive charts and 10 tabular reports with 7 filters (including **Indian Financial Year April–March YoY comparison** across `FY 2025-26` and `FY 2026-27`), CSV exports, and printable reports.
9. **Settings, Backup & PWA**: Export/restore JSON backups, export 5 specialized CSVs, configure PIN lock, install the Android PWA, and run the automated **Scenarios A–J QA Suite**.

---

## 5. Known Limitations

1. **Device-Bound Local Storage**: Financial records are stored inside the browser's IndexedDB on the specific device where they were entered. They do not sync automatically across multiple phones or laptops; use **Export Full JSON Backup** and **Restore (Merge Mode)** to transfer records between devices.
2. **Browser Data Clearing**: Clearing browser site data / storage in Android Settings or Chrome Settings will erase local IndexedDB data unless backed up to a `.json` file.
3. **No Automatic SMS / Bank Scraping**: By design for privacy and security, all transactions are entered manually or imported via JSON backup.
