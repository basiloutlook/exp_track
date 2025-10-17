// types/alert.ts

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = "info",       // Blue - Insights, tips
  WARNING = "warning", // Yellow - Approaching limits
  CRITICAL = "critical" // Red - Budget exceeded, unusual activity
}

/**
 * Available alert types
 */
export enum AlertType {
  DAILY_BUDGET = "dailyBudget",
  WEEKLY_BUDGET = "weeklyBudget",
  MONTHLY_BUDGET = "monthlyBudget",
  CATEGORY_BUDGET = "categoryBudget",
  UNUSUAL_SPENDING = "unusualSpending",
  WEEKLY_SUMMARY = "weeklySummary",
  MONTHLY_COMPARISON = "monthlyComparison",
  SAVING_TIP = "savingTip"
}

/**
 * Alert notification style
 */
export enum NotificationStyle {
  PUSH_AND_BANNER = "pushAndBanner",   // Push + In-app banner
  BANNER_ONLY = "bannerOnly",          // In-app banner only
  SILENT = "silent"                    // Alert center only (no notifications)
}

/**
 * Individual alert instance
 */
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, any>; // Additional context data
  timestamp: number;
  priority: number; // Higher = more important
  read: boolean;
  dismissed: boolean;
}

/**
 * Category-specific budget configuration
 */
export interface CategoryBudget {
  category: string;
  monthlyLimit: number;
  enabled: boolean;
}

/**
 * Quiet hours configuration
 */
export interface QuietHours {
  enabled: boolean;
  start: string; // HH:MM format (e.g., "22:00")
  end: string;   // HH:MM format (e.g., "08:00")
}

/**
 * User's alert preferences
 */
export interface AlertSettings {
  // Budget thresholds
  dailyBudget: number | null;          // null = not set
  weeklyBudget: number | null;
  monthlyBudget: number | null;
  categoryBudgets: CategoryBudget[];
  
  // Enabled alert types
  enabledAlerts: AlertType[];
  
  // Timing preferences
  alertTime: string;                   // HH:MM format (default: "20:00")
  quietHours: QuietHours;
  
  // Notification preferences
  notificationStyle: NotificationStyle;
  notificationsEnabled: boolean;       // Master toggle for push notifications
  
  // Thresholds
  unusualSpendingMultiplier: number;   // e.g., 2 = alert if 2x average
  
  // Frequency
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: number;            // 0-6 (0 = Sunday)
  monthlySummaryEnabled: boolean;
  monthlySummaryDay: number;           // 1-28
}

/**
 * Alert history entry (to prevent spam)
 */
export interface AlertHistory {
  type: AlertType;
  date: string;      // YYYY-MM-DD format
  timestamp: number;
  shown: boolean;
}

/**
 * Default alert settings for new users
 */
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  dailyBudget: null,
  weeklyBudget: null,
  monthlyBudget: null,
  categoryBudgets: [],
  
  enabledAlerts: [
    AlertType.CATEGORY_BUDGET,
    AlertType.WEEKLY_SUMMARY,
    AlertType.MONTHLY_COMPARISON
  ],
  
  alertTime: "20:00",
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "08:00"
  },
  
  notificationStyle: NotificationStyle.BANNER_ONLY,
  notificationsEnabled: false, // Will be enabled after permission granted
  
  unusualSpendingMultiplier: 2,
  
  weeklySummaryEnabled: true,
  weeklySummaryDay: 0, // Sunday
  monthlySummaryEnabled: true,
  monthlySummaryDay: 1 // 1st of month
};

/**
 * Helper type for alert condition check results
 */
export interface AlertConditionResult {
  triggered: boolean;
  alert?: Partial<Alert>; // If triggered, contains alert data
}