# My Money Tracker — Personal & Family Finance PWA

**My Money Tracker** is a private, offline-first, Android-mobile-first Personal & Family Finance Progressive Web Application (PWA) built with **React 19**, **TypeScript**, **Vite 6**, **Tailwind CSS 4**, **Dexie.js + IndexedDB**, **Recharts**, and **Lucide Icons**.

---

## 1. Core Privacy & Architecture Philosophy

- **100% Local On-Device Storage**: All financial transactions are stored exclusively in your device/browser's **IndexedDB** (`MyMoneyTrackerIndexedDB`, Schema `v2`, 12 normalized tables).
- **Zero Cloud Database & Zero Bank Connections**: There is no backend server, no mandatory login, no third-party financial APIs, and zero telemetry.
- **Zero `localStorage` Leaks**: Financial records are never written to `window.localStorage` or `window.sessionStorage`, and never logged to the browser console.
- **GitHub Stores Code Only**: GitHub hosts only the open-source/personal application code. Your personal financial records remain strictly inside your mobile or desktop browser's IndexedDB.

---

## 2. Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React 19 + TypeScript 5 |
| **Build Tool** | Vite 6 (`base: './'` for universal GitHub Pages path resolution) |
| **UI & Styling** | Tailwind CSS v4 (Banking Light & OLED Dark Themes) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Database** | IndexedDB + Dexie.js (`MyMoneyTrackerIndexedDB`, Schema `v2`) |
| **Offline Support** | Custom Service Worker (`sw.js`) + `manifest.webmanifest` |
| **Security** | Web Crypto API (`PBKDF2-SHA256` PIN Lock + `AES-256-GCM` Encrypted Backups) |
| **Deployment** | GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`) |

---

## 3. Financial Calculation & Accounting Rules

| Metric | Deterministic Formula | Accounting Rule |
| :--- | :--- | :--- |
| **Total Income** | $\text{Credited Salary} + \text{Credited Additional Income}$ | Expected/pending salary is **never** included until marked Credited |
| **Total Expenses** | $\sum \text{Consumption Expenses}$ | Self-transfers and savings/investment contributions are **strictly excluded** |
| **Monthly Surplus** | $\text{Total Income} - \text{Total Expenses}$ | Displayed separately from actual savings contributions |
| **Savings Contributions** | $\sum \text{Savings \& Investment Allocations}$ | Recorded as explicit goal transactions; never auto-assumed from surplus |
| **Unallocated Surplus** | $\text{Monthly Surplus} - \text{Total Contributions}$ | Surplus remaining after explicit goal contributions |
| **Available Cash Balance** | $\text{Opening Balance} + \text{Total Income} - (\text{Expenses} + \text{Contributions})$ | Self-transfers between own accounts net to `₹0` |
| **Loan Principal Reduction** | $\text{Prior Principal} - \text{EMI Principal Component}$ | Outstanding loan principal is reduced **only** by the principal component of an EMI |

---

## 4. Local Development Instructions

### Prerequisites
- **Node.js** `v20+` and **npm** `v10+`

### Install & Run Locally
```bash
cd MyMoneyTracker
npm install
npm run dev
```
Open `http://localhost:5173/` in Chrome or Edge.

### Production Build & Type Verification
```bash
cd MyMoneyTracker
npm run build
npm run preview
```

---

## 5. Android Mobile & Desktop PWA Installation Guide

1. **Open the HTTPS URL**: Open `https://sreenathmvjvp.github.io/MyMoneyTracker/` in **Google Chrome** on your Android phone (or Chrome/Edge on Desktop).
2. **Trigger Installation**:
   - Tap the **Install App** button in the top header bar (or inside **Settings → PWA & Android Installation Guide**), **OR**
   - Tap the Chrome menu (**⋮**) in the top-right corner and select **Install app** / **Add to Home screen**.
3. **Launch in Standalone Mode**: Open **Money Tracker** from your Android home screen. It runs full-screen in standalone mode without browser toolbars.
4. **Offline Operation**: Turn off Wi-Fi and mobile data. You can view dashboards, add daily expenses, record salary credits, and analyze reports 100% offline.

---

## 6. Backup, Restore & Local Security Instructions

Because all records live locally in your browser's IndexedDB:
- **Clearing browser site data or uninstalling the browser will erase local financial records** unless you export a backup.
- Installing the PWA on a second device does not automatically copy records from your first device.

### How to Back Up Your Data
1. Navigate to **More → Settings & Backup**.
2. Under **Local Database Backup & CSV Exports**, optionally enable **Encrypt JSON backup with passphrase (AES-256-GCM)**.
3. Tap **Export Full JSON Backup** to save a complete snapshot of all 12 IndexedDB tables to your device.
4. You can also export **Expenses CSV**, **Income CSV**, **Savings Contributions CSV**, **Family Transactions CSV**, and **Monthly Financial Report CSV**.

### How to Restore Your Data
1. Navigate to **Settings & Backup → Restore Database from JSON Backup**.
2. Select your `.json` backup file (and enter your decryption passphrase if encrypted).
3. Review the **Backup Preview** (Schema version, export date, and exact record counts for Income, Expenses, Savings Contributions, Family Members, Goals, Budgets, and Loans).
4. Choose **Merge Mode** (preserves existing data and skips duplicates via transaction fingerprints) or **Replace Mode** (replaces all tables inside an atomic transaction).
5. Check the confirmation box and tap **Confirm & Restore Database**.

---

## 7. GitHub Repository & Automatic GitHub Pages Deployment Guide

### Step 1: Create a GitHub Repository
1. Sign in to [https://github.com](https://github.com) (or create a free account).
2. Click **New repository** (`+` icon in the top-right).
3. Set **Repository name** to: `MyMoneyTracker`
4. Choose **Public** (or **Private** if you have GitHub Pro/Enterprise with Pages support).
   - *Privacy Note*: Your repository contains **only** application source code. `.gitignore` and the GitHub Actions workflow strictly block `.csv` exports and `*Backup*.json` files.
5. Click **Create repository**.

### Step 2: Initialize Git & Push Source Code
Open a terminal inside the `MyMoneyTracker` directory and run:
```bash
git init
git branch -M main
git add .
git status
# Verify that NO personal .csv or *Backup*.json files are staged
git commit -m "Initial production release of My Money Tracker PWA"
git remote add origin https://github.com/sreenathmvjvp/MyMoneyTracker.git
git push -u origin main
```

### Step 3: Enable GitHub Pages via GitHub Actions
1. Open your repository on GitHub: `https://github.com/sreenathmvjvp/MyMoneyTracker`
2. Go to **Settings → Pages** (left sidebar).
3. Under **Build and deployment → Source**, select **GitHub Actions** (or **Deploy from a branch → `gh-pages`**).
4. Go to the **Actions** tab at the top of your repository. You will see the **Deploy My Money Tracker PWA to GitHub Pages** workflow running automatically.
5. Once the workflow turns green, your live HTTPS URL will be displayed:
   `https://sreenathmvjvp.github.io/MyMoneyTracker/`

---

## 8. Post-Deployment Verification Checklist

After deploying to GitHub Pages, verify the live URL on your Android phone and desktop browser:
- [ ] Open `https://sreenathmvjvp.github.io/MyMoneyTracker/` and confirm the Dashboard loads cleanly.
- [ ] Navigate through **Home**, **Income**, **Expenses**, **Transactions**, **Family**, **Budgets**, **Goals**, **Loans & EMI**, **Reports**, and **Settings**.
- [ ] Install the PWA on Android Chrome (**Install App**) and launch it from the home screen in standalone mode.
- [ ] Turn on Airplane Mode / turn off internet, add a test expense, close and reopen the app, and confirm the transaction persists in IndexedDB.
- [ ] Run **Settings → Run Full QA Suite (Scenarios A–J)** and verify `14/14 PASS`.
- [ ] Export a Full JSON Backup and test restoring it.
