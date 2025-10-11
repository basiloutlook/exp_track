import { Expense } from "@/types/expense";

const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbzuMYinNGX2OmcMPNXpd9HdBOkOxNveYSt3KtXmnVVuKA4VDuoG-5Vf781HwFNE4x7b/exec";
  

/**
 * Normalize Google Sheet date fields to prevent 1-day shift.
 * Ensures date is treated as a plain local date (not UTC midnight).
 */
function normalizeRowDate(raw: any): string {
  const d = raw?.date || raw?.Date || "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    // interpret as local date
    return d;
  }
  return d || "";
}

/**
 * Fetch all expenses from Google Sheet.
 */
export async function getExpensesFromGoogleSheet(): Promise<Expense[]> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL);
    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map((row: any, index: number) => {
      const expense = {
        id: row.id || row.ID || row.Id || `sheet-${index + 1}`,
        date: normalizeRowDate(row),
        category: row.category || row.Category || "",
        subCategory:
          row.subCategory || row["Sub Category"] || row.subcategory || "",
        item: row.item || row.Item || "",
        amount: parseFloat(row.amount || row.Amount || 0) || 0,
        email: row.email || row["Email Address"] || "",
        shopName:
          row.shopName || row.shop || row["Shop/Site/Person name"] || row.Shop || "",
        paymentMode: row.paymentMode || row["Mode of payment"] || "",
        labels:
          typeof row.labels === "string"
            ? row.labels
                .split(",")
                .map((l: string) => l.trim())
                .filter(Boolean)
            : Array.isArray(row.labels)
            ? row.labels
            : [],
        timestamp: row.timestamp || row.Timestamp || "",
      };
      return expense;
    });
  } catch (error) {
    console.error("❌ Error fetching Google Sheet data:", error);
    return [];
  }
}

/**
 * Add a new expense record to Google Sheet.
 */
export async function addExpenseToGoogleSheet(
  expense: Expense
): Promise<void> {
  try {
    const payload = {
      action: "add",
      id: expense.id,
      email: expense.email,
      date: expense.date,
      category: expense.category,
      subCategory: expense.subCategory,
      item: expense.item,
      shopName: expense.shopName || "",
      amount: expense.amount,
      paymentMode: expense.paymentMode,
      labels: Array.isArray(expense.labels)
        ? expense.labels.join(", ")
        : expense.labels || "",
      timestamp: expense.timestamp,
    };

    console.log("📤 Sending ADD request to Google Sheet:", payload);

    const response = await fetch(GOOGLE_SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || "Failed to add");
    console.log("✅ Added to Google Sheet:", result.message || "");
  } catch (error) {
    console.error("❌ Error adding to Google Sheet:", error);
    throw error;
  }
}

/**
 * Update an existing expense record by ID.
 */
export async function updateExpenseInGoogleSheet(
  expense: Expense
): Promise<void> {
  try {
    // Step 1: Delete the existing record
    await deleteExpenseFromGoogleSheet(expense.id);

    // Step 2: Add the updated record
    const payload = {
      action: "add",
      id: expense.id,
      email: expense.email,
      date: expense.date,
      category: expense.category,
      subCategory: expense.subCategory,
      item: expense.item,
      shopName: expense.shopName || "",
      amount: expense.amount,
      paymentMode: expense.paymentMode,
      labels: Array.isArray(expense.labels)
        ? expense.labels.join(", ")
        : expense.labels || "",
      timestamp: expense.timestamp,
    };

    console.log("📤 Sending ADD request to Google Sheet after deletion:", payload);

    const response = await fetch(GOOGLE_SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.success)
      throw new Error(result.message || "Failed to update expense");
    console.log("✅ Updated expense in Google Sheet:", result.message || "");
  } catch (error) {
    console.error("❌ Error updating expense in Google Sheet:", error);
    throw error;
  }
}

/**
 * Delete an expense record from Google Sheet by ID.
 */
export async function deleteExpenseFromGoogleSheet(id: string): Promise<void> {
  try {
    const payload = { action: 'delete', id }; // Ensure correct payload
    console.log('📤 Sending DELETE request to Google Sheet:', payload);

    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Failed to delete expense');
    console.log('🗑️ Deleted expense from Google Sheet:', id);
  } catch (error) {
    console.error('❌ Error deleting expense from Google Sheet:', error);
    throw error;
  }
}