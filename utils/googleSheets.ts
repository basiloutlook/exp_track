// utils/googleSheets.ts
import { Share, Platform } from "react-native";

/**
 * ⚙️ Configure your Apps Script Web App URL here.
 * Example: https://script.google.com/macros/s/AKfycbx1234abcd/exec
 */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyukwDUpU3hMUbbtN_kRrymgwI90nch5kg8SkLvmCimxQlJOBKB39zwYRmPGaQ_KLDj/exec";

/**
 * Send a new expense to the Google Sheet through the Apps Script Web App.
 */
export async function addExpenseToGoogleSheet(expense: {
  date: string;
  category: string;
  item: string;
  amount: number;
  email: string;
  shop: string;
  paymentMode: string;
}) {
  try {
    const payload = {
      date: expense.date,
      category: expense.category,
      item: expense.item,
      amount: expense.amount,
      email: expense.email,
      shop: expense.shop,
      paymentMode: expense.paymentMode,
    };

    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Failed to save to Google Sheet");
    }

    console.log("✅ Expense added to Google Sheet:", result.message);
    return true;
  } catch (error) {
    console.error("❌ Error adding expense to Google Sheet:", error);
    return false;
  }
}
/**
 * Import data from a published Google Sheet (as CSV)
 */
export async function importFromPublishedSheet(
  csvUrl: string
): Promise<string> {
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
    const csv = await res.text();
    return csv;
  } catch (error) {
    console.error("Error importing from published sheet:", error);
    throw error;
  }
}

/**
 * Import data from an Apps Script Web App that returns JSON.
 * This endpoint should return a JSON array of expense objects.
 */
export async function importFromAppsScript(jsonUrl: string): Promise<any[]> {
  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) throw new Error(`Failed to fetch JSON: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Expected JSON array");
    return data;
  } catch (error) {
    console.error("Error importing from Apps Script:", error);
    throw error;
  }
}

/**
 * Export all expenses (CSV string) and share/download it.
 * Call this with a CSV string (from storage export).
 */
export async function exportCSV(csv: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `expenses_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      await Share.share({
        message: csv,
        title: "Expense Report CSV",
      });
    }
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    throw error;
  }
}

/**
 * Instruction text for users on how to import/export data with Google Sheets
 */
export function getInstructions(): string {
  return `To import this data into Google Sheets:

1. Export the CSV file using the Export button in the Dashboard
2. Open Google Sheets (sheets.google.com)
3. Create a new spreadsheet or open an existing one
4. Go to File > Import
5. Choose the CSV file you exported
6. Select "Insert new sheet(s)" or "Replace spreadsheet"
7. Click "Import data"

The CSV format matches the structure of your expense tracking form.`;
}
