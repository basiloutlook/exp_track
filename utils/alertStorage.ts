// utils/alertStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AlertSettings,
  Alert,
  AlertHistory,
  DEFAULT_ALERT_SETTINGS,
  AlertType,
} from "@/types/alert";

const ALERT_STORAGE_KEYS = {
  SETTINGS: "alert_settings",
  HISTORY: "alert_history",
  PENDING_ALERTS: "pending_alerts",
  ONBOARDING_COMPLETE: "alert_onboarding_complete",
  LAST_EVALUATION: "alert_last_evaluation",
};

/**
 * Alert Storage Service
 * Manages all alert-related data persistence
 */
export const alertStorage = {
  // ==================== SETTINGS ====================

  /**
   * Get user's alert settings
   * Returns default settings if none exist
   */
  async getSettings(): Promise<AlertSettings> {
    try {
      const json = await AsyncStorage.getItem(ALERT_STORAGE_KEYS.SETTINGS);
      if (!json) {
        // First time - return defaults
        return DEFAULT_ALERT_SETTINGS;
      }
      return JSON.parse(json) as AlertSettings;
    } catch (error) {
      console.error("❌ Error loading alert settings:", error);
      return DEFAULT_ALERT_SETTINGS;
    }
  },

  /**
   * Save alert settings
   */
  async saveSettings(settings: AlertSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.SETTINGS,
        JSON.stringify(settings)
      );
      console.log("✅ Alert settings saved");
    } catch (error) {
      console.error("❌ Error saving alert settings:", error);
      throw error;
    }
  },

  /**
   * Update specific setting fields
   */
  async updateSettings(
    partial: Partial<AlertSettings>
  ): Promise<AlertSettings> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...partial };
      await this.saveSettings(updated);
      return updated;
    } catch (error) {
      console.error("❌ Error updating alert settings:", error);
      throw error;
    }
  },

  /**
   * Check if user has completed budget onboarding
   */
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(
        ALERT_STORAGE_KEYS.ONBOARDING_COMPLETE
      );
      return value === "true";
    } catch (error) {
      console.error("❌ Error checking onboarding status:", error);
      return false;
    }
  },

  /**
   * Mark budget onboarding as complete
   */
  async setOnboardingComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.ONBOARDING_COMPLETE,
        "true"
      );
      console.log("✅ Onboarding marked complete");
    } catch (error) {
      console.error("❌ Error setting onboarding complete:", error);
    }
  },

  /**
   * Check if user has set up any budgets
   */
  async hasBudgetsConfigured(): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      return (
        settings.dailyBudget !== null ||
        settings.weeklyBudget !== null ||
        settings.monthlyBudget !== null ||
        settings.categoryBudgets.some((cb) => cb.enabled)
      );
    } catch (error) {
      console.error("❌ Error checking budget configuration:", error);
      return false;
    }
  },

  // ==================== ALERTS ====================

  /**
   * Get pending alerts (unread/undismissed)
   */
  async getPendingAlerts(): Promise<Alert[]> {
    try {
      const json = await AsyncStorage.getItem(ALERT_STORAGE_KEYS.PENDING_ALERTS);
      if (!json) return [];
      
      const alerts = JSON.parse(json) as Alert[];
      // Return only unread and undismissed alerts
      return alerts.filter((a) => !a.read && !a.dismissed);
    } catch (error) {
      console.error("❌ Error loading pending alerts:", error);
      return [];
    }
  },

  /**
   * Get all alerts (including read/dismissed)
   */
  async getAllAlerts(): Promise<Alert[]> {
    try {
      const json = await AsyncStorage.getItem(ALERT_STORAGE_KEYS.PENDING_ALERTS);
      return json ? (JSON.parse(json) as Alert[]) : [];
    } catch (error) {
      console.error("❌ Error loading all alerts:", error);
      return [];
    }
  },

  /**
   * Save new alerts
   * Merges with existing alerts and removes duplicates
   */
  async saveAlerts(newAlerts: Alert[]): Promise<void> {
    try {
      const existing = await this.getAllAlerts();
      
      // Merge and deduplicate (keep newest)
      const alertMap = new Map<string, Alert>();
      
      // Add existing alerts
      existing.forEach((a) => alertMap.set(a.id, a));
      
      // Add/update with new alerts
      newAlerts.forEach((a) => alertMap.set(a.id, a));
      
      const merged = Array.from(alertMap.values());
      
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.PENDING_ALERTS,
        JSON.stringify(merged)
      );
      
      console.log(`✅ Saved ${newAlerts.length} new alerts (total: ${merged.length})`);
    } catch (error) {
      console.error("❌ Error saving alerts:", error);
      throw error;
    }
  },

  /**
   * Mark alert as read
   */
  async markAlertAsRead(alertId: string): Promise<void> {
    try {
      const alerts = await this.getAllAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, read: true } : a
      );
      
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.PENDING_ALERTS,
        JSON.stringify(updated)
      );
      
      console.log(`✅ Marked alert as read: ${alertId}`);
    } catch (error) {
      console.error("❌ Error marking alert as read:", error);
    }
  },

  /**
   * Mark alert as dismissed
   */
  async dismissAlert(alertId: string): Promise<void> {
    try {
      const alerts = await this.getAllAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, dismissed: true, read: true } : a
      );
      
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.PENDING_ALERTS,
        JSON.stringify(updated)
      );
      
      console.log(`🗑️ Dismissed alert: ${alertId}`);
    } catch (error) {
      console.error("❌ Error dismissing alert:", error);
    }
  },

  /**
   * Clear old alerts (older than 30 days)
   */
  async clearOldAlerts(): Promise<void> {
    try {
      const alerts = await this.getAllAlerts();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      
      const recent = alerts.filter((a) => a.timestamp > thirtyDaysAgo);
      
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.PENDING_ALERTS,
        JSON.stringify(recent)
      );
      
      console.log(`🧹 Cleared ${alerts.length - recent.length} old alerts`);
    } catch (error) {
      console.error("❌ Error clearing old alerts:", error);
    }
  },

  // ==================== HISTORY ====================

  /**
   * Get alert history (for cooldown checks)
   */
  async getHistory(): Promise<AlertHistory[]> {
    try {
      const json = await AsyncStorage.getItem(ALERT_STORAGE_KEYS.HISTORY);
      return json ? (JSON.parse(json) as AlertHistory[]) : [];
    } catch (error) {
      console.error("❌ Error loading alert history:", error);
      return [];
    }
  },

  /**
   * Add entry to alert history
   */
  async addToHistory(type: AlertType, shown: boolean = true): Promise<void> {
    try {
      const history = await this.getHistory();
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      
      const entry: AlertHistory = {
        type,
        date: today,
        timestamp: Date.now(),
        shown,
      };
      
      history.push(entry);
      
      // Keep only last 90 days
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const filtered = history.filter((h) => h.timestamp > ninetyDaysAgo);
      
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.HISTORY,
        JSON.stringify(filtered)
      );
      
      console.log(`📝 Added to alert history: ${type} (${today})`);
    } catch (error) {
      console.error("❌ Error adding to alert history:", error);
    }
  },

  /**
   * Check if alert was shown today (for cooldown)
   */
  async wasShownToday(type: AlertType): Promise<boolean> {
    try {
      const history = await this.getHistory();
      const today = new Date().toISOString().split("T")[0];
      
      return history.some((h) => h.type === type && h.date === today && h.shown);
    } catch (error) {
      console.error("❌ Error checking alert history:", error);
      return false;
    }
  },

  /**
   * Get last evaluation timestamp
   */
  async getLastEvaluation(): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(
        ALERT_STORAGE_KEYS.LAST_EVALUATION
      );
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error("❌ Error loading last evaluation:", error);
      return 0;
    }
  },

  /**
   * Update last evaluation timestamp
   */
  async setLastEvaluation(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ALERT_STORAGE_KEYS.LAST_EVALUATION,
        Date.now().toString()
      );
    } catch (error) {
      console.error("❌ Error setting last evaluation:", error);
    }
  },

  // ==================== UTILITIES ====================

  /**
   * Clear all alert data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(ALERT_STORAGE_KEYS));
      console.log("🧹 Cleared all alert data");
    } catch (error) {
      console.error("❌ Error clearing alert data:", error);
    }
  },

  // Add this method to alertStorage
async addNotification(message: string) {
  try {
    const STORAGE_KEY = "@notification_history";
    const MAX_NOTIFICATIONS = 10;
    
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const notifications = stored ? JSON.parse(stored) : [];
    
    const newNotif = {
      id: Date.now().toString(),
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    
    const updated = [newNotif, ...notifications].slice(0, MAX_NOTIFICATIONS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error adding notification:", error);
  }
},

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalAlerts: number;
    pendingAlerts: number;
    historyEntries: number;
    hasBudgets: boolean;
    onboardingComplete: boolean;
  }> {
    try {
      const [allAlerts, pending, history, hasBudgets, onboardingComplete] =
        await Promise.all([
          this.getAllAlerts(),
          this.getPendingAlerts(),
          this.getHistory(),
          this.hasBudgetsConfigured(),
          this.hasCompletedOnboarding(),
        ]);

      return {
        totalAlerts: allAlerts.length,
        pendingAlerts: pending.length,
        historyEntries: history.length,
        hasBudgets,
        onboardingComplete,
      };
    } catch (error) {
      console.error("❌ Error getting alert stats:", error);
      return {
        totalAlerts: 0,
        pendingAlerts: 0,
        historyEntries: 0,
        hasBudgets: false,
        onboardingComplete: false,
      };
    }
  },
};