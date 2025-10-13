import { Expense } from "@/types/expense";

const GOOGLE_SHEETS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxT16eqozdV3E_sx76yyiRMZ1FCs2xyYzZc2NM4icCdfJO0YuseOKT_tQn8mMeB2vW3/exec";
  

/**
 * Normalize Google Sheet date fields to prevent 1-day shift.
 * Ensures date is treated as a plain local date (not UTC midnight).
 */
function buildQuery(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

/**
 * Generic GET fetch from Apps Script (supports ?mode=raw, ?mode=summary, filters, etc.)
 */
export async function getExpensesFromGoogleSheet(
  opts: Record<string, any> = {}
): Promise<any[]> {
  try {
    const qs = buildQuery(opts);
    const url = `${GOOGLE_SHEETS_WEB_APP_URL}?${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('getExpensesFromGoogleSheet error:', err);
    throw err;
  }
}

/**
 * Add a new expense row to Google Sheet
 */
export async function addExpenseToGoogleSheet(expense: Expense): Promise<void> {
  const payload = {
    action: 'add',
    ...expense,
  };
  const res = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to add expense');
  }
}

/**
 * Update existing expense by ID
 */
export async function updateExpenseInGoogleSheet(expense: Expense): Promise<void> {
  const payload = {
    action: 'update',
    ...expense,
  };
  const res = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to update expense');
  }
}

/**
 * Delete an expense by ID
 */
export async function deleteExpenseFromGoogleSheet(id: string): Promise<void> {
  const payload = {
    action: 'delete',
    id,
  };
  const res = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to delete expense');
  }
}