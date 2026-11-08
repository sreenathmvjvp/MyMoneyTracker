import type {
  AccountRecord,
  AppSettingRecord,
  CategoryGroup,
  CategoryRecord,
  FamilyMemberRecord,
} from '../types';
import { getTodayISO } from '../utilities/formatters';
import { CURRENT_SCHEMA_VERSION, db } from './db';

interface DefaultCategoryTemplate {
  id: string;
  name: string;
  group: CategoryGroup;
  subcategories: string[];
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES_SEED: DefaultCategoryTemplate[] = [
  // Household
  {
    id: 'cat_rent',
    name: 'Rent',
    group: 'Household',
    subcategories: ['House Rent', 'Maintenance Charges', 'Society Fee'],
    icon: 'Home',
    color: '#059669',
  },
  {
    id: 'cat_groceries',
    name: 'Groceries',
    group: 'Household',
    subcategories: ['Monthly Provisions', 'Milk & Dairy', 'Staples & Grains', 'Household Supplies'],
    icon: 'ShoppingBasket',
    color: '#10b981',
  },
  {
    id: 'cat_vegetables',
    name: 'Vegetables',
    group: 'Household',
    subcategories: ['Fresh Vegetables', 'Fruits', 'Greens'],
    icon: 'Salad',
    color: '#16a34a',
  },
  {
    id: 'cat_electricity',
    name: 'Electricity',
    group: 'Household',
    subcategories: ['Monthly EB Bill', 'Inverter / Generator'],
    icon: 'Zap',
    color: '#eab308',
  },
  {
    id: 'cat_water',
    name: 'Water',
    group: 'Household',
    subcategories: ['Municipal Water Bill', 'Drinking Water Cans', 'RO Maintenance'],
    icon: 'Droplets',
    color: '#0284c7',
  },
  {
    id: 'cat_internet',
    name: 'Internet',
    group: 'Household',
    subcategories: ['Fiber Broadband', 'OTT & DTH'],
    icon: 'Wifi',
    color: '#2563eb',
  },
  {
    id: 'cat_mobile_recharge',
    name: 'Mobile Recharge',
    group: 'Household',
    subcategories: ['Prepaid Recharge', 'Postpaid Bill', 'Family Data Plan'],
    icon: 'Smartphone',
    color: '#4f46e5',
  },

  // Family
  {
    id: 'cat_school_fees',
    name: "Children's School Fees",
    group: 'Family',
    subcategories: ['Term Tuition Fee', 'School Bus / Van', 'Books & Uniforms'],
    icon: 'GraduationCap',
    color: '#7c3aed',
  },
  {
    id: 'cat_children_education',
    name: "Children's Education",
    group: 'Family',
    subcategories: ['Coaching & Tuition', 'Stationery', 'Extracurricular Classes'],
    icon: 'BookOpen',
    color: '#8b5cf6',
  },
  {
    id: 'cat_medical',
    name: 'Medical',
    group: 'Family',
    subcategories: ['Doctor Consultation', 'Medicines & Pharmacy', 'Lab Tests & Diagnostics'],
    icon: 'HeartPulse',
    color: '#ef4444',
  },
  {
    id: 'cat_clothing',
    name: 'Clothing',
    group: 'Family',
    subcategories: ['Kids Wear', 'Ethnic & Festival Wear', 'Daily Apparel', 'Footwear'],
    icon: 'Shirt',
    color: '#ec4899',
  },
  {
    id: 'cat_family_shopping',
    name: 'Family Shopping',
    group: 'Family',
    subcategories: ['Appliances & Utensils', 'Gifts & Festivals', 'Home Decor'],
    icon: 'ShoppingBag',
    color: '#db2777',
  },
  {
    id: 'cat_family_travel',
    name: 'Family Travel',
    group: 'Family',
    subcategories: ['Train / Flight Tickets', 'Hotel & Stay', 'Hometown Visit', 'Pilgrimage'],
    icon: 'Plane',
    color: '#0d9488',
  },

  // Financial
  {
    id: 'cat_loan_emi',
    name: 'Loan EMI',
    group: 'Financial',
    subcategories: ['Home Loan EMI', 'Car / Two-Wheeler EMI', 'Personal Loan EMI'],
    icon: 'Landmark',
    color: '#dc2626',
  },
  {
    id: 'cat_insurance',
    name: 'Insurance',
    group: 'Financial',
    subcategories: ['Health Insurance', 'Term Life Insurance', 'Vehicle Insurance'],
    icon: 'ShieldCheck',
    color: '#0891b2',
  },
  {
    id: 'cat_investments',
    name: 'Investments',
    group: 'Financial',
    subcategories: ['Mutual Fund SIP', 'PPF / SSY', 'NPS', 'Gold / RD'],
    icon: 'TrendingUp',
    color: '#059669',
  },
  {
    id: 'cat_savings_transfers',
    name: 'Savings Transfers',
    group: 'Financial',
    subcategories: ['Emergency Fund Transfer', 'Goal Allocation', 'Fixed Deposit'],
    icon: 'PiggyBank',
    color: '#047857',
  },

  // Personal
  {
    id: 'cat_fuel',
    name: 'Fuel',
    group: 'Personal',
    subcategories: ['Petrol', 'Diesel', 'CNG / EV Charging'],
    icon: 'Fuel',
    color: '#ea580c',
  },
  {
    id: 'cat_transportation',
    name: 'Transportation',
    group: 'Personal',
    subcategories: ['Auto / Cab', 'Metro / Bus Pass', 'Vehicle Servicing', 'Toll & Parking'],
    icon: 'Car',
    color: '#d97706',
  },
  {
    id: 'cat_restaurants',
    name: 'Restaurants',
    group: 'Personal',
    subcategories: ['Dining Out', 'Food Delivery', 'Tea / Snacks'],
    icon: 'Utensils',
    color: '#f97316',
  },
  {
    id: 'cat_entertainment',
    name: 'Entertainment',
    group: 'Personal',
    subcategories: ['Movies & Outings', 'Subscriptions', 'Sports & Hobbies'],
    icon: 'Film',
    color: '#9333ea',
  },
  {
    id: 'cat_personal_shopping',
    name: 'Personal Shopping',
    group: 'Personal',
    subcategories: ['Grooming & Personal Care', 'Electronics & Accessories', 'Books'],
    icon: 'Sparkles',
    color: '#6366f1',
  },
  {
    id: 'cat_miscellaneous',
    name: 'Miscellaneous',
    group: 'Personal',
    subcategories: ['Charity & Donations', 'Repair & Handyman', 'Other'],
    icon: 'MoreHorizontal',
    color: '#64748b',
  },
];

/**
 * Initializes the IndexedDB database with required default settings, categories,
 * family members, and accounts inside a single atomic Dexie transaction.
 */
export async function initializeDatabaseFoundation(): Promise<void> {
  const nowIso = new Date().toISOString();
  const todayDate = getTodayISO();

  await db.transaction(
    'rw',
    [db.appSettings, db.categories, db.familyMembers, db.accounts],
    async () => {
      // 1. Initialize default AppSettings
      const existingSettings = await db.appSettings.get('default');
      if (!existingSettings) {
        const defaultSettings: AppSettingRecord = {
          id: 'default',
          currency: 'INR',
          currencySymbol: '₹',
          language: 'en-IN',
          dateFormat: 'DD-MMM-YYYY',
          financialYearStartMonth: 4, // April to March
          theme: 'system',
          demoMode: false,
          openingCashBalance: 0,
          expectedSalaryCreditDay: 1,
          pinEnabled: false,
          autoLockMinutes: 5,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          transactionDate: todayDate,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await db.appSettings.put(defaultSettings);
      }

      // 2. Seed default Categories if none exist
      const categoryCount = await db.categories.count();
      if (categoryCount === 0) {
        const categoriesToInsert: CategoryRecord[] = DEFAULT_CATEGORIES_SEED.map((item) => ({
          id: item.id,
          name: item.name,
          group: item.group,
          subcategories: item.subcategories,
          type: 'expense',
          icon: item.icon,
          color: item.color,
          isDefault: true,
          isActive: true,
          transactionDate: todayDate,
          createdAt: nowIso,
          updatedAt: nowIso,
        }));
        await db.categories.bulkPut(categoriesToInsert);
      }

      // 3. Seed default Family Member associations if none exist
      const familyCount = await db.familyMembers.count();
      if (familyCount === 0) {
        const defaultMembers: FamilyMemberRecord[] = [
          {
            id: 'fam_self',
            name: 'Self',
            relationship: 'Self',
            description: 'Primary earner & personal expenses',
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'fam_spouse',
            name: 'Spouse',
            relationship: 'Spouse',
            description: 'Spouse expenses',
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'fam_children',
            name: 'Children',
            relationship: 'Children',
            description: 'School fees, education & kids expenses',
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'fam_parents',
            name: 'Parents',
            relationship: 'Parents',
            description: 'Parents medical & care expenses',
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'fam_entire_family',
            name: 'Entire Family',
            relationship: 'Entire Family',
            description: 'Shared household, groceries, rent & utilities',
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ];
        await db.familyMembers.bulkPut(defaultMembers);
      }

      // 4. Seed default Accounts if none exist
      const accountCount = await db.accounts.count();
      if (accountCount === 0) {
        const defaultAccounts: AccountRecord[] = [
          {
            id: 'acc_salary_bank',
            name: 'Primary Salary Bank Account',
            type: 'bank',
            bankName: 'Primary Bank',
            openingBalance: 0,
            currentBalance: 0,
            isDefault: true,
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'acc_family_savings',
            name: 'Savings Bank Account',
            type: 'bank',
            bankName: 'Savings Bank',
            openingBalance: 0,
            currentBalance: 0,
            isDefault: false,
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'acc_cash_wallet',
            name: 'Cash in Hand',
            type: 'cash',
            openingBalance: 0,
            currentBalance: 0,
            isDefault: false,
            isActive: true,
            transactionDate: todayDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ];
        await db.accounts.bulkPut(defaultAccounts);
      }
    }
  );
}
