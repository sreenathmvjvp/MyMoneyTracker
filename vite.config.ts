import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('node_modules')) {
            if (
              normalized.includes('/recharts/') ||
              normalized.includes('/d3-') ||
              normalized.includes('/victory-vendor/')
            ) {
              return 'charts';
            }
            if (normalized.includes('/dexie')) {
              return 'database';
            }
            if (normalized.includes('/lucide-react/')) {
              return 'icons';
            }
            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            return 'vendor';
          }
          if (normalized.includes('/src/pages/ReportsPage')) {
            return 'module-reports';
          }
          if (normalized.includes('/src/pages/SettingsPage')) {
            return 'module-settings';
          }
          if (
            normalized.includes('/src/pages/LoansEmiPage') ||
            normalized.includes('/src/pages/BudgetsPage') ||
            normalized.includes('/src/pages/SavingsGoalsPage')
          ) {
            return 'module-planning';
          }
          if (
            normalized.includes('/src/pages/ExpensesPage') ||
            normalized.includes('/src/pages/IncomePage') ||
            normalized.includes('/src/pages/FamilyMembersPage') ||
            normalized.includes('/src/pages/TransactionsPage')
          ) {
            return 'module-transactions';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
