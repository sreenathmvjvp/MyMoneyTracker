/**
 * Formatting & Date Utilities for My Money Tracker
 * Enforces Indian Rupee (₹) en-IN numbering system and DD-MMM-YYYY date formatting.
 */

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Formats a number as Indian Rupees (₹) using the Indian numbering system (lakhs/crores).
 * Example: 240000 -> "₹2,40,000"
 */
export function formatINR(amount: number, decimals = 0): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeAmount);
}

/**
 * Formats an ISO date string (YYYY-MM-DD or full ISO timestamp) into DD-MMM-YYYY.
 * Example: "2026-11-07" -> "07-Nov-2026"
 */
export function formatDateDDMMMYYYY(dateInput: string | Date): string {
  if (!dateInput) return '';
  let year: number;
  let monthIndex: number;
  let day: number;

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    year = y;
    monthIndex = m - 1;
    day = d;
  } else {
    const parsed = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(parsed.getTime())) return String(dateInput);
    year = parsed.getFullYear();
    monthIndex = parsed.getMonth();
    day = parsed.getDate();
  }

  const dd = String(day).padStart(2, '0');
  const mmm = MONTH_NAMES_SHORT[monthIndex] ?? 'Jan';
  return `${dd}-${mmm}-${year}`;
}

/**
 * Formats a YYYY-MM string into a readable Month Year label (e.g., "Nov 2026")
 */
export function formatMonthLabel(yyyyMm: string): string {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm;
  const [year, month] = yyyyMm.split('-').map(Number);
  const mmm = MONTH_NAMES_SHORT[month - 1] ?? 'Jan';
  return `${mmm} ${year}`;
}

/**
 * Returns today's local date in YYYY-MM-DD format.
 */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current month in YYYY-MM format.
 */
export function getCurrentMonthYYYYMM(): string {
  return getTodayISO().slice(0, 7);
}

/**
 * Extracts YYYY-MM from a YYYY-MM-DD date string.
 */
export function toMonthKey(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return getCurrentMonthYYYYMM();
  return dateStr.slice(0, 7);
}

/**
 * Computes the Indian Financial Year (April to March) for a given YYYY-MM-DD or YYYY-MM string.
 * Example: "2026-11" -> "FY 2026-27", "2026-03" -> "FY 2025-26"
 */
export function getIndianFinancialYear(dateOrMonth: string): string {
  const clean = (dateOrMonth || getTodayISO()).trim();
  const parts = clean.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] || 4;

  if (!year || Number.isNaN(year)) {
    return 'FY 2026-27';
  }

  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `FY ${startYear}-${endYearShort}`;
}

/**
 * Returns the start and end dates (YYYY-MM-DD) for an Indian Financial Year start year.
 * Example: 2026 -> { startDate: "2026-04-01", endDate: "2027-03-31", label: "FY 2026-27" }
 */
export function getFinancialYearDateRange(startYear: number): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const endYear = startYear + 1;
  const endYearShort = String(endYear % 100).padStart(2, '0');
  return {
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    label: `FY ${startYear}-${endYearShort}`,
  };
}

/**
 * Generates a unique identifier with an optional table prefix.
 */
export function generateId(prefix = 'rec'): string {
  const randomUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomUuid}`;
}

/**
 * Creates a deterministic, normalized fingerprint to prevent accidental duplicate records.
 */
export function createFingerprint(...parts: Array<string | number | undefined | null>): string {
  return parts
    .map((part) =>
      String(part ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
    )
    .join('|');
}
