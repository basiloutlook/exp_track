import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Expense } from "@/types/expense";
import { addExpenseToGoogleSheet } from "./googleSheets";

const STORAGE_KEYS = {
  EXPENSES: "expenses",
  USER: "user",
  SETTINGS: "settings",
  LABELS: "labels", // ✅ new key
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

  // ✅ Save expense locally + sync to Google Sheets
  async saveExpense(expense: Expense): Promise<void> {
    try {
      let expenses = await loadData<Expense[]>(STORAGE_KEYS.EXPENSES);
      if (!Array.isArray(expenses)) expenses = [];

      if (!expense.id) expense.id = Date.now().toString();

      expenses.push(expense);
      await saveData(STORAGE_KEYS.EXPENSES, expenses);

      // ✅ Send to Google Sheet (including subCategory)
      await addExpenseToGoogleSheet({
        date: expense.date,
        category: expense.category,
        subCategory: expense.subCategory ?? "", // ✅ added
        item: expense.item,
        amount: expense.amount,
        email: expense.email,
        shopName: expense.shopName ?? "",
        paymentMode: expense.paymentMode,
        labels: expense.labels ?? [],
      });

      console.log("✅ Expense saved locally & to Google Sheets");
    } catch (error) {
      console.error("❌ Error saving expense:", error);
    }
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

  async deleteExpense(id: string): Promise<void> {
    try {
      const expenses = await this.getExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      await saveData(STORAGE_KEYS.EXPENSES, filtered);
      console.log("🗑️ Expense deleted locally:", id);
    } catch (error) {
      console.error("❌ Error deleting expense:", error);
    }
  },

  async exportToCSV(): Promise<string | null> {
    try {
      const expenses = await this.getExpenses();
      if (expenses.length === 0) return null;

      const header = "Date,Category,Subcategory,Item,Amount,Email,Shop,Payment Mode,Labels\n";
      const rows = expenses.map(e =>
        `${e.date},${e.category},${e.subCategory ?? ""},${e.item},${e.amount},${e.email},${e.shopName},${e.paymentMode},"${e.labels.join(", ")}"`
      );
      return header + rows.join("\n");
    } catch (error) {
      console.error("❌ Error exporting expenses:", error);
      return null;
    }
  },
    async saveLabel(label: string) {
    try {
      let labels = await loadData<string[]>(STORAGE_KEYS.LABELS);
      if (!Array.isArray(labels)) labels = [];

      // add new label (keep unique)
      if (!labels.includes(label)) {
        labels.unshift(label); // newest first
        labels = labels.slice(0, 20); // limit to last 20
      }

      await saveData(STORAGE_KEYS.LABELS, labels);
    } catch (error) {
      console.error("❌ Error saving label:", error);
    }
  },

  async getRecentLabels(): Promise<string[]> {
    try {
      const labels = await loadData<string[]>(STORAGE_KEYS.LABELS);
      return Array.isArray(labels) ? labels : [];
    } catch (error) {
      console.error("❌ Error loading labels:", error);
      return [];
    }
  },
};

