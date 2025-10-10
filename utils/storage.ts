import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Expense } from "@/types/expense";
import {
  addExpenseToGoogleSheet,
  updateExpenseInGoogleSheet,
  deleteExpenseFromGoogleSheet,
} from "./googleSheets";

const STORAGE_KEYS = {
  EXPENSES: "expenses",
  USER: "user",
  SETTINGS: "settings",
  LABELS: "labels",
};

async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving data:", error);
  }
}

async function loadData<T>(key: string): Promise<T | null> {
  try {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error("Error loading data:", error);
    return null;
  }
}

export const storageService = {
  async getUserEmail(): Promise<string | null> {
    const user = await loadData<{ email?: string }>(STORAGE_KEYS.USER);
    return user?.email ?? null;
  },

  async saveUserEmail(email: string): Promise<void> {
    await saveData(STORAGE_KEYS.USER, { email });
  },

  async getExpenses(): Promise<Expense[]> {
    try {
      const expenses = await loadData<Expense[]>(STORAGE_KEYS.EXPENSES);
      return Array.isArray(expenses) ? expenses : [];
    } catch (error) {
      console.error("❌ Error loading expenses:", error);
      return [];
    }
  },

  async setExpenses(expenses: Expense[]): Promise<void> {
    await saveData(STORAGE_KEYS.EXPENSES, expenses);
  },

  // NEW: Add expense locally only (no Google Sheet sync)
  async addExpenseOnly(expense: Expense): Promise<void> {
    try {
      const expenses = (await loadData<Expense[]>(STORAGE_KEYS.EXPENSES)) || [];
      expenses.push(expense);
      await saveData(STORAGE_KEYS.EXPENSES, expenses);
      console.log("✅ Expense added locally");
    } catch (error) {
      console.error("❌ Error adding expense locally:", error);
    }
  },

  // NEW: Update expense locally only (no Google Sheet sync)
  async updateExpenseOnly(updated: Expense): Promise<void> {
    try {
      const expenses = (await loadData<Expense[]>(STORAGE_KEYS.EXPENSES)) || [];
      const idx = expenses.findIndex((e) => e.id === updated.id);
      if (idx >= 0) {
        expenses[idx] = updated;
      } else {
        expenses.push(updated);
      }
      await saveData(STORAGE_KEYS.EXPENSES, expenses);
      console.log("✅ Updated expense locally");
    } catch (error) {
      console.error("❌ Error updating expense locally:", error);
    }
  },

  // DEPRECATED: This was causing duplicates. Use addExpenseOnly or updateExpenseOnly instead
  async saveExpense(expense: Expense): Promise<void> {
    try {
      let expenses = (await loadData<Expense[]>(STORAGE_KEYS.EXPENSES)) || [];

      // Ensure ID exists
      if (!expense.id) {
        expense.id = Date.now().toString();
      }

      const idx = expenses.findIndex((e) => e.id === expense.id);
      if (idx >= 0) {
        expenses[idx] = expense;
        await updateExpenseInGoogleSheet(expense);
      } else {
        expenses.push(expense);
        await addExpenseToGoogleSheet(expense);
      }

      await saveData(STORAGE_KEYS.EXPENSES, expenses);
      console.log("✅ Expense saved locally and synced to sheet");
    } catch (error) {
      console.error("❌ Error saving expense:", error);
    }
  },

  // Keep for backward compatibility but update locally only
  async updateExpense(updated: Expense): Promise<void> {
    try {
      const expenses = (await loadData<Expense[]>(STORAGE_KEYS.EXPENSES)) || [];
      const idx = expenses.findIndex((e) => e.id === updated.id);
      if (idx >= 0) {
        expenses[idx] = updated;
      } else {
        expenses.push(updated);
      }
      await saveData(STORAGE_KEYS.EXPENSES, expenses);
      console.log("✅ Updated expense locally");
    } catch (error) {
      console.error("❌ Error updating expense:", error);
    }
  },

  async deleteExpense(id: string): Promise<void> {
    try {
      const expenses = (await loadData<Expense[]>(STORAGE_KEYS.EXPENSES)) || [];
      const filtered = expenses.filter((e) => e.id !== id);
      await saveData(STORAGE_KEYS.EXPENSES, filtered);
      console.log("🗑️ Expense deleted locally:", id);
    } catch (error) {
      console.error("❌ Error deleting expense locally:", error);
    }
  },

  async exportToCSV(): Promise<string | null> {
    try {
      const expenses = await this.getExpenses();
      if (expenses.length === 0) return null;

      const header = "Date,Category,Subcategory,Item,Amount,Email,Shop,Payment Mode,Labels\n";
      const rows = expenses.map(
        (e) =>
          `${e.date},${e.category},${e.subCategory ?? ""},${e.item},${e.amount},${e.email},${e.shopName},${e.paymentMode},"${(e.labels || []).join(
            ", "
          )}"`
      );
      return header + rows.join("\n");
    } catch (error) {
      console.error("❌ Error exporting expenses:", error);
      return null;
    }
  },

  async saveLabel(label: string) {
    try {
      let labels = (await loadData<string[]>(STORAGE_KEYS.LABELS)) || [];
      if (!labels.includes(label)) {
        labels.unshift(label);
        labels = labels.slice(0, 20);
      }
      await saveData(STORAGE_KEYS.LABELS, labels);
    } catch (error) {
      console.error("❌ Error saving label:", error);
    }
  },

  async getRecentLabels(): Promise<string[]> {
    try {
      const labels = (await loadData<string[]>(STORAGE_KEYS.LABELS)) || [];
      return labels;
    } catch (error) {
      console.error("❌ Error loading labels:", error);
      return [];
    }
  },
};