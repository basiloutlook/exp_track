// utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Expense } from "@/types/expense";

const STORAGE_KEYS = {
  EXPENSES: "expenses",
  USER: "user",
  SETTINGS: "settings",
  LABELS: "labels",
  EXPENSES_CACHE: "expenses_cache", // NEW
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
// 🔹 ADD THESE LINES HERE (after constants, before saveData function)
let inMemoryCache: Expense[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// ✅ ADD THIS LINE
let loadingPromise: Promise<Expense[]> | null = null;
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
  // If already loading, return the same promise (mutex lock)
  if (loadingPromise) {
    console.log('⏳ Waiting for existing load...');
    return loadingPromise;
  }

  // Check in-memory cache first
  if (inMemoryCache && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    console.log('📦 Using in-memory cache');
    return [...inMemoryCache];
  }

  // Start loading with lock
  loadingPromise = (async () => {
    try {
      // Try AsyncStorage cache
      const asyncCache = await this.getCachedExpensesWithTimestamp();
      if (asyncCache && (Date.now() - asyncCache.timestamp < CACHE_DURATION)) {
        console.log('💾 Using AsyncStorage cache');
        inMemoryCache = asyncCache.expenses;
        cacheTimestamp = Date.now();
        return asyncCache.expenses;
      }

      // Load from storage
      const expenses = await loadData<Expense[]>(STORAGE_KEYS.EXPENSES) || [];
      
      // Update both caches
      inMemoryCache = expenses;
      cacheTimestamp = Date.now();
      await this.setCachedExpenses(expenses);
      
      return expenses;
    } finally {
      // Always unlock
      loadingPromise = null;
    }
  })();

  return loadingPromise;
},
async setExpenses(expenses: Expense[]): Promise<void> {
  await saveData(STORAGE_KEYS.EXPENSES, expenses);
  // Update cache when expenses are set
  inMemoryCache = expenses;
  cacheTimestamp = Date.now();
  await this.setCachedExpenses(expenses);
},

  // NEW: Cache management methods
  async getCachedExpensesWithTimestamp(): Promise<{ expenses: Expense[], timestamp: number } | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES_CACHE);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error("❌ Error loading cache:", error);
      return null;
    }
  },

  async setCachedExpenses(expenses: Expense[]): Promise<void> {
    try {
      const cache = {
        expenses,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES_CACHE, JSON.stringify(cache));
      console.log(`💾 Cached ${expenses.length} expenses at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error("❌ Error saving cache:", error);
    }
  },

  async shouldRefreshCache(): Promise<boolean> {
    try {
      const cached = await this.getCachedExpensesWithTimestamp();
      if (!cached) {
        console.log("🔍 No cache found, refresh needed");
        return true;
      }
      const age = Date.now() - cached.timestamp;
      const shouldRefresh = age > CACHE_DURATION;
      
      if (shouldRefresh) {
        console.log(`⏰ Cache expired (${Math.round(age / 1000)}s old), refresh needed`);
      } else {
        console.log(`✓ Cache fresh (${Math.round(age / 1000)}s old)`);
      }
      
      return shouldRefresh;
    } catch (error) {
      console.error("❌ Error checking cache:", error);
      return true; // Refresh on error
    }
  },

  async invalidateCache(): Promise<void> {
  try {
    inMemoryCache = null;
    cacheTimestamp = 0;
    await AsyncStorage.removeItem(STORAGE_KEYS.EXPENSES_CACHE);
    console.log("🗑️ Cache invalidated");
  } catch (error) {
    console.error("❌ Error invalidating cache:", error);
  }
},
  // NEW: Add expense locally only (no Google Sheet sync)
  async addExpenseOnly(expense: Expense): Promise<void> {
  // Optimistic update - update cache immediately
  if (inMemoryCache) {
    inMemoryCache.push(expense);
  }

  const expenses = await loadData<Expense[]>(STORAGE_KEYS.EXPENSES) || [];
  expenses.push(expense);
  await saveData(STORAGE_KEYS.EXPENSES, expenses);
  
  // Refresh cache
  inMemoryCache = expenses;
  cacheTimestamp = Date.now();
  await this.setCachedExpenses(expenses);
},

  // NEW: Update expense locally only (no Google Sheet sync)
  // 🔹 FIND: async updateExpenseOnly(expense: Expense): Promise<void> {
// REPLACE with:

async updateExpenseOnly(expense: Expense): Promise<void> {
  // Optimistic update
  if (inMemoryCache) {
    const index = inMemoryCache.findIndex(e => e.id === expense.id);
    if (index !== -1) {
      inMemoryCache[index] = expense;
      cacheTimestamp = Date.now();
    }
  }

  const expenses = await loadData<Expense[]>(STORAGE_KEYS.EXPENSES) || [];
  const index = expenses.findIndex(e => e.id === expense.id);
  if (index !== -1) {
    expenses[index] = expense;
    await saveData(STORAGE_KEYS.EXPENSES, expenses);
    inMemoryCache = expenses;
    cacheTimestamp = Date.now();
    await this.setCachedExpenses(expenses);
  }
},

  // DEPRECATED: This was causing duplicates. Use addExpenseOnly or updateExpenseOnly instead
  

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

  // 🔹 FIND: async deleteExpense(id: string): Promise<void> {
// REPLACE with:

async deleteExpense(id: string): Promise<void> {
  try {
    // Update in-memory cache
    if (inMemoryCache) {
      inMemoryCache = inMemoryCache.filter((e) => e.id !== id);
    }
    
    const expenses = (await loadData<Expense[]>(STORAGE_KEYS.EXPENSES)) || [];
    const filtered = expenses.filter((e) => e.id !== id);
    await saveData(STORAGE_KEYS.EXPENSES, filtered);
    
    // Update cache
    inMemoryCache = filtered;
    cacheTimestamp = Date.now();
    await this.setCachedExpenses(filtered);
    
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