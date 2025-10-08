// utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Expense } from "@/types/expense";
import { addExpenseToGoogleSheet } from "./googleSheets"; // ✅ Import this

const STORAGE_KEYS = {
  EXPENSES: "expenses",
  USER: "user",
  SETTINGS: "settings",
};

/**
 * Save data to AsyncStorage
 */
export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    const jsonValue = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (error) {
    console.error("Error saving data:", error);
  }
}

/**
 * Load data from AsyncStorage
 */
export async function loadData<T>(key: string): Promise<T | null> {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error("Error loading data:", error);
    return null;
  }
}

/**
 * Remove a specific key from AsyncStorage
 */
export async function removeData(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error("Error removing data:", error);
  }
}

/**
 * Clear all app data from AsyncStorage
 */
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.error("Error clearing data:", error);
  }
}

export { STORAGE_KEYS };

export const storageService = {
  async getUserEmail(): Promise<string | null> {
    const user = await loadData<{ email?: string }>(STORAGE_KEYS.USER);
    return user?.email ?? null;
  },

  async saveUserEmail(email: string): Promise<void> {
    await saveData(STORAGE_KEYS.USER, { email });
  },

  /**
   * Save expense locally + send to Google Sheets
   */
  async saveExpense(expense: Expense): Promise<void> {
    try {
      // Save locally
      let expenses = await loadData<Expense[]>(STORAGE_KEYS.EXPENSES);
      if (!Array.isArray(expenses)) {
        expenses = [];
      }
      expenses.push(expense);
      await saveData(STORAGE_KEYS.EXPENSES, expenses);

      // ✅ Send to Google Sheet
      await addExpenseToGoogleSheet({
        date: expense.date,
        category: expense.category,
        item: expense.item,
        amount: expense.amount,
        email: expense.email,
        shop: expense.shopName, // map to "shop"
        paymentMode: expense.paymentMode,
      });

      console.log("✅ Expense saved locally & to Google Sheets");
    } catch (error) {
      console.error("❌ Error saving expense:", error);
    }
  },
};
