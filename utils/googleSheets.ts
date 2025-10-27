// utils/googleSheets.ts
import { Expense } from "@/types/expense";
import { storageService } from "./storage";

const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbxQyGH47GOlfuKy5d9aMwNw9LVr9T7OaZDDYYmesglyEBCvDcRDaGg1Nqo2t_rBvZi5/exec";

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
 * Fetch all expenses from Google Sheet with caching.
 * Uses cached data if available and fresh (within 5 minutes).
 * Falls back to cache if network request fails.
 */
export async function getExpensesFromGoogleSheet(): Promise<Expense[]> {
  try {
    // Check if we should use cached data
    const shouldRefresh = await storageService.shouldRefreshCache();
    
    if (!shouldRefresh) {
      const cached = await storageService.getCachedExpensesWithTimestamp();
      if (cached && cached.expenses.length > 0) {
        console.log("📦 Using cached data (fresh)");
        return cached.expenses;
      }
    }

    // Fetch fresh data from Google Sheets
    console.log("🌐 Fetching fresh data from Google Sheets");
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn("⚠️ Invalid data format from Google Sheets");
      // Try to return cached data as fallback
      const cached = await storageService.getCachedExpensesWithTimestamp();
      return cached?.expenses || [];
    }

    const expenses = data.map((row: any, index: number) => {
      const expense: Expense = {
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

    // Cache the fresh data
    await storageService.setCachedExpenses(expenses);
    console.log(`✅ Fetched and cached ${expenses.length} expenses`);

    return expenses;
  } catch (error) {
    console.error("❌ Error fetching Google Sheet data:", error);
    
    // Fallback to cached data if available
    const cached = await storageService.getCachedExpensesWithTimestamp();
    if (cached && cached.expenses.length > 0) {
      console.log("📦 Using cached data (fallback due to error)");
      return cached.expenses;
    }
    
    // If no cache available, return empty array
    console.warn("⚠️ No cached data available, returning empty array");
    return [];
  }
}

/**
 * Force refresh expenses from Google Sheet, bypassing cache.
 * Use this after CRUD operations to ensure data is up-to-date.
 */
export async function forceRefreshExpenses(): Promise<Expense[]> {
  try {
    console.log("🔄 Force refreshing data from Google Sheets");
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid data format from Google Sheets");
    }

    const expenses = data.map((row: any, index: number) => {
      const expense: Expense = {
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

    // Update cache with fresh data
    await storageService.setCachedExpenses(expenses);
    console.log(`✅ Force refreshed and cached ${expenses.length} expenses`);

    return expenses;
  } catch (error) {
    console.error("❌ Error force refreshing Google Sheet data:", error);
    throw error;
  }
}

/**
 * Add a new expense record to Google Sheet.
 * Invalidates cache after successful addition.
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
    
    // Invalidate cache to force refresh on next load
    await storageService.invalidateCache();
  } catch (error) {
    console.error("❌ Error adding to Google Sheet:", error);
    throw error;
  }
}

/**
 * Update an existing expense record by ID.
 * Invalidates cache after successful update.
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
    
    // Invalidate cache to force refresh on next load
    await storageService.invalidateCache();
  } catch (error) {
    console.error("❌ Error updating expense in Google Sheet:", error);
    throw error;
  }
}

/**
 * Delete an expense record from Google Sheet by ID.
 * Invalidates cache after successful deletion.
 */
export async function deleteExpenseFromGoogleSheet(id: string): Promise<void> {
  try {
    const payload = { action: 'delete', id };
    console.log('📤 Sending DELETE request to Google Sheet:', payload);

    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Failed to delete expense');
    
    console.log('🗑️ Deleted expense from Google Sheet:', id);
    
    // Invalidate cache to force refresh on next load
    await storageService.invalidateCache();
  } catch (error) {
    console.error('❌ Error deleting expense from Google Sheet:', error);
    throw error;
  }
}

// Add these functions to your existing utils/googleSheets.ts file

/**
 * Get insights from server that haven't been delivered yet
 * @param since - Only fetch insights created after this date
 */
export async function getInsightsFromServer(since: Date | null = null): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    params.append('mode', 'insights');
    if (since) {
      params.append('since', since.toISOString());
    }

    const url = `${GOOGLE_SHEET_URL}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const insights = await response.json();
    console.log(`✅ Fetched ${insights.length} insights from server`);
    return insights;
  } catch (error) {
    console.error('❌ Error fetching insights:', error);
    return [];
  }
}

/**
 * Mark an insight as delivered to the user (in chat)
 */
export async function markInsightAsDelivered(insightId: string): Promise<void> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'markInsightDelivered', 
        id: insightId 
      }),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    console.log(`✅ Marked insight as delivered: ${insightId}`);
  } catch (error) {
    console.error('❌ Error marking insight as delivered:', error);
  }
}
/**
 * Trigger insight generation manually from the app
 */
export async function triggerInsightGeneration(): Promise<any> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generateInsights' }),
    });

    const result = await response.json();
    console.log(`✅ Insight generation triggered:`, result);
    return result;
  } catch (error) {
    console.error('❌ Error triggering insight generation:', error);
    return { success: false, message: 'Failed to trigger insights' };
  }
}