// utils/alertEngine.ts
import { Expense } from "@/types/expense";
import {
  Alert,
  AlertType,
  AlertSeverity,
  AlertSettings,
  AlertConditionResult,
} from "@/types/alert";
import { alertStorage } from "./alertStorage";

/**
 * Alert Engine
 * Core logic for evaluating alert conditions and generating alerts
 */
export const alertEngine = {
  /**
   * Main evaluation function - checks all enabled alerts
   * Returns array of triggered alerts sorted by priority
   */
  async evaluateAlerts(expenses: Expense[]): Promise<Alert[]> {
    try {
      console.log("🔍 Evaluating alerts...");
      
      const settings = await alertStorage.getSettings();
      const triggeredAlerts: Alert[] = [];

      // Check each enabled alert type
      for (const alertType of settings.enabledAlerts) {
        // Check if already shown today (cooldown)
        const wasShownToday = await alertStorage.wasShownToday(alertType);
        if (wasShownToday) {
          console.log(`⏭️ Skipping ${alertType} (already shown today)`);
          continue;
        }

        // Evaluate condition
        const result = await this.evaluateCondition(
          alertType,
          expenses,
          settings
        );

        if (result.triggered && result.alert) {
          const alert: Alert = {
            id: `${alertType}-${Date.now()}`,
            type: alertType,
            severity: result.alert.severity || AlertSeverity.INFO,
            title: result.alert.title || "Alert",
            message: result.alert.message || "",
            data: result.alert.data,
            timestamp: Date.now(),
            priority: result.alert.priority || 5,
            read: false,
            dismissed: false,
          };

          triggeredAlerts.push(alert);
          
          // Add to history
          await alertStorage.addToHistory(alertType, true);
        }
      }

      // Sort by priority (highest first)
      triggeredAlerts.sort((a, b) => b.priority - a.priority);

      console.log(`✅ Generated ${triggeredAlerts.length} alerts`);
      
      // Save alerts
      if (triggeredAlerts.length > 0) {
        await alertStorage.saveAlerts(triggeredAlerts);
      }

      // Update last evaluation timestamp
      await alertStorage.setLastEvaluation();

      return triggeredAlerts;
    } catch (error) {
      console.error("❌ Error evaluating alerts:", error);
      return [];
    }
  },

  /**
   * Evaluate specific alert condition
   */
  async evaluateCondition(
    type: AlertType,
    expenses: Expense[],
    settings: AlertSettings
  ): Promise<AlertConditionResult> {
    switch (type) {
      case AlertType.DAILY_BUDGET:
        return this.checkDailyBudget(expenses, settings);
      
      case AlertType.WEEKLY_BUDGET:
        return this.checkWeeklyBudget(expenses, settings);
      
      case AlertType.MONTHLY_BUDGET:
        return this.checkMonthlyBudget(expenses, settings);
      
      case AlertType.CATEGORY_BUDGET:
        return this.checkCategoryBudgets(expenses, settings);
      
      case AlertType.UNUSUAL_SPENDING:
        return this.checkUnusualSpending(expenses, settings);
      
      case AlertType.WEEKLY_SUMMARY:
        return this.checkWeeklySummary(expenses, settings);
      
      case AlertType.MONTHLY_COMPARISON:
        return this.checkMonthlyComparison(expenses, settings);
      
      default:
        return { triggered: false };
    }
  },

  // ==================== CONDITION CHECKS ====================

  /**
   * Check if daily budget exceeded
   */
  checkDailyBudget(
    expenses: Expense[],
    settings: AlertSettings
  ): AlertConditionResult {
    if (!settings.dailyBudget) {
      return { triggered: false };
    }

    const today = new Date().toISOString().split("T")[0];
    const todayExpenses = expenses.filter((e) => e.date === today);
    const totalToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    const percentUsed = (totalToday / settings.dailyBudget) * 100;

    if (totalToday > settings.dailyBudget) {
      return {
        triggered: true,
        alert: {
          severity: AlertSeverity.CRITICAL,
          title: "Daily Budget Exceeded!",
          message: `You've spent ₹${totalToday.toFixed(0)} today, which is ₹${(totalToday - settings.dailyBudget).toFixed(0)} over your ₹${settings.dailyBudget} daily limit.`,
          priority: 10,
          data: { totalToday, budget: settings.dailyBudget, percentUsed },
        },
      };
    } else if (percentUsed >= 80) {
      return {
        triggered: true,
        alert: {
          severity: AlertSeverity.WARNING,
          title: "Daily Budget Warning",
          message: `You've used ${percentUsed.toFixed(0)}% of your daily budget (₹${totalToday.toFixed(0)} / ₹${settings.dailyBudget}).`,
          priority: 7,
          data: { totalToday, budget: settings.dailyBudget, percentUsed },
        },
      };
    }

    return { triggered: false };
  },

  /**
   * Check if weekly budget exceeded
   */
  checkWeeklyBudget(
    expenses: Expense[],
    settings: AlertSettings
  ): AlertConditionResult {
    if (!settings.weeklyBudget) {
      return { triggered: false };
    }

    const weekExpenses = this.getExpensesInRange(expenses, 7);
    const totalWeek = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const percentUsed = (totalWeek / settings.weeklyBudget) * 100;

    if (totalWeek > settings.weeklyBudget) {
      return {
        triggered: true,
        alert: {
          severity: AlertSeverity.CRITICAL,
          title: "Weekly Budget Exceeded!",
          message: `You've spent ₹${totalWeek.toFixed(0)} this week, exceeding your ₹${settings.weeklyBudget} limit by ₹${(totalWeek - settings.weeklyBudget).toFixed(0)}.`,
          priority: 9,
          data: { totalWeek, budget: settings.weeklyBudget, percentUsed },
        },
      };
    } else if (percentUsed >= 80) {
      return {
        triggered: true,
        alert: {
          severity: AlertSeverity.WARNING,
          title: "Weekly Budget Warning",
          message: `You've used ${percentUsed.toFixed(0)}% of your weekly budget.`,
          priority: 6,
          data: { totalWeek, budget: settings.weeklyBudget, percentUsed },
        },
      };
    }

    return { triggered: false };
  },

  /**
   * Check if monthly budget exceeded
   */
  checkMonthlyBudget(
    expenses: Expense[],
    settings: AlertSettings
  ): AlertConditionResult {
    if (!settings.monthlyBudget) {
      return { triggered: false };
    }

    const monthExpenses = this.getExpensesInRange(expenses, 30);
    const totalMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const percentUsed = (totalMonth / settings.monthlyBudget) * 100;

    if (totalMonth > settings.monthlyBudget) {
      return {
        triggered: true,
        alert: {
          severity: AlertSeverity.CRITICAL,
          title: "Monthly Budget Exceeded!",
          message: `You've spent ₹${totalMonth.toFixed(0)} this month, ₹${(totalMonth - settings.monthlyBudget).toFixed(0)} over budget.`,
          priority: 8,
          data: { totalMonth, budget: settings.monthlyBudget, percentUsed },
        },
      };
    } else if (percentUsed >= 80) {
      return {
        triggered: true,
        alert: {
          severity: AlertSeverity.WARNING,
          title: "Monthly Budget Warning",
          message: `You've used ${percentUsed.toFixed(0)}% of your monthly budget.`,
          priority: 5,
          data: { totalMonth, budget: settings.monthlyBudget, percentUsed },
        },
      };
    }

    return { triggered: false };
  },

  /**
   * Check category budgets
   */
  checkCategoryBudgets(
    expenses: Expense[],
    settings: AlertSettings
  ): AlertConditionResult {
    const enabledBudgets = settings.categoryBudgets.filter((cb) => cb.enabled);
    
    if (enabledBudgets.length === 0) {
      return { triggered: false };
    }

    const monthExpenses = this.getExpensesInRange(expenses, 30);

    for (const categoryBudget of enabledBudgets) {
      const categoryExpenses = monthExpenses.filter(
        (e) => e.category === categoryBudget.category
      );
      const totalSpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      const percentUsed = (totalSpent / categoryBudget.monthlyLimit) * 100;

      if (totalSpent > categoryBudget.monthlyLimit) {
        return {
          triggered: true,
          alert: {
            severity: AlertSeverity.CRITICAL,
            title: `${categoryBudget.category} Budget Exceeded!`,
            message: `You've spent ₹${totalSpent.toFixed(0)} on ${categoryBudget.category} this month, ₹${(totalSpent - categoryBudget.monthlyLimit).toFixed(0)} over your ₹${categoryBudget.monthlyLimit} limit.`,
            priority: 9,
            data: {
              category: categoryBudget.category,
              totalSpent,
              budget: categoryBudget.monthlyLimit,
              percentUsed,
            },
          },
        };
      } else if (percentUsed >= 80) {
        return {
          triggered: true,
          alert: {
            severity: AlertSeverity.WARNING,
            title: `${categoryBudget.category} Budget Warning`,
            message: `You've used ${percentUsed.toFixed(0)}% of your ${categoryBudget.category} budget (₹${totalSpent.toFixed(0)} / ₹${categoryBudget.monthlyLimit}).`,
            priority: 7,
            data: {
              category: categoryBudget.category,
              totalSpent,
              budget: categoryBudget.monthlyLimit,
              percentUsed,
            },
          },
        };
      }
    }

    return { triggered: false };
  },

  /**
   * Check for unusual spending patterns
   */
  checkUnusualSpending(
    expenses: Expense[],
    settings: AlertSettings
  ): AlertConditionResult {
    const todayExpenses = this.getExpensesInRange(expenses, 1);
    const totalToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    if (totalToday === 0) {
      return { triggered: false };
    }

    // Calculate 30-day average
    const last30Days = this.getExpensesInRange(expenses, 30);
    const avgDaily = last30Days.reduce((sum, e) => sum + e.amount, 0) / 30;

    const multiplier = settings.unusualSpendingMultiplier || 2;

    if (totalToday > avgDaily * multiplier) {
      return {
        triggered: true,
        alert: {
          severity: AlertSeverity.WARNING,
          title: "Unusual Spending Detected",
          message: `Today's spending (₹${totalToday.toFixed(0)}) is ${multiplier}x higher than your daily average (₹${avgDaily.toFixed(0)}).`,
          priority: 6,
          data: { totalToday, avgDaily, multiplier },
        },
      };
    }

    return { triggered: false };
  },

  /**
   * Weekly summary alert
   */
  checkWeeklySummary(
    expenses: Expense[],
    settings: AlertSettings
  ): AlertConditionResult {
    if (!settings.weeklySummaryEnabled) {
      return { triggered: false };
    }

    const today = new Date().getDay();
    if (today !== settings.weeklySummaryDay) {
      return { triggered: false };
    }

    const weekExpenses = this.getExpensesInRange(expenses, 7);
    const totalWeek = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const avgDaily = totalWeek / 7;

    // Get top category
    const categoryTotals = this.getCategoryTotals(weekExpenses);
    const topCategory = Object.entries(categoryTotals).sort(
      ([, a], [, b]) => b - a
    )[0];

    return {
      triggered: true,
      alert: {
        severity: AlertSeverity.INFO,
        title: "Weekly Summary",
        message: `You spent ₹${totalWeek.toFixed(0)} this week (₹${avgDaily.toFixed(0)}/day). Top category: ${topCategory?.[0] || "N/A"} (₹${topCategory?.[1]?.toFixed(0) || 0}).`,
        priority: 3,
        data: { totalWeek, avgDaily, topCategory: topCategory?.[0] },
      },
    };
  },

  /**
   * Monthly comparison alert (vs 3/6/12 month average)
   */
  checkMonthlyComparison(
    expenses: Expense[],
    settings: AlertSettings
  ): AlertConditionResult {
    if (!settings.monthlySummaryEnabled) {
      return { triggered: false };
    }

    const today = new Date().getDate();
    if (today !== settings.monthlySummaryDay) {
      return { triggered: false };
    }

    const currentMonth = this.getExpensesInRange(expenses, 30);
    const totalCurrent = currentMonth.reduce((sum, e) => sum + e.amount, 0);

    // Calculate 3-month average
    const last3Months = this.getExpensesInRange(expenses, 90);
    const avg3Months = last3Months.reduce((sum, e) => sum + e.amount, 0) / 3;

    const percentDiff = ((totalCurrent - avg3Months) / avg3Months) * 100;

    if (Math.abs(percentDiff) < 10) {
      return { triggered: false }; // No significant change
    }

    const severity =
      percentDiff > 50
        ? AlertSeverity.CRITICAL
        : percentDiff > 20
        ? AlertSeverity.WARNING
        : AlertSeverity.INFO;

    const message =
      percentDiff > 0
        ? `Your spending is ${percentDiff.toFixed(0)}% higher than your 3-month average (₹${totalCurrent.toFixed(0)} vs ₹${avg3Months.toFixed(0)}).`
        : `Great job! You're spending ${Math.abs(percentDiff).toFixed(0)}% less than your 3-month average.`;

    return {
      triggered: true,
      alert: {
        severity,
        title: "Monthly Comparison",
        message,
        priority: 4,
        data: { totalCurrent, avg3Months, percentDiff },
      },
    };
  },

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Get expenses within last N days
   */
  getExpensesInRange(expenses: Expense[], days: number): Expense[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    return expenses.filter((e) => e.date >= cutoffStr);
  },

  /**
   * Get category totals
   */
  getCategoryTotals(expenses: Expense[]): Record<string, number> {
    const totals: Record<string, number> = {};
    
    expenses.forEach((e) => {
      if (!totals[e.category]) {
        totals[e.category] = 0;
      }
      totals[e.category] += e.amount;
    });

    return totals;
  },
  /**
   * Trigger notification for immediate alert
   * Called after transaction is added
   */
  async triggerImmediateNotification(
    expenses: Expense[],
    newTransaction: Expense
  ): Promise<void> {
    try {
      const settings = await alertStorage.getSettings();
      
      // Check daily budget
      if (settings.dailyBudget && settings.enabledAlerts.includes(AlertType.DAILY_BUDGET)) {
        const today = new Date().toISOString().split("T")[0];
        const todayExpenses = expenses.filter((e) => e.date === today);
        const totalToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
        const percentUsed = (totalToday / settings.dailyBudget) * 100;

        if (percentUsed >= 90) {
          const message = 
            percentUsed >= 100
              ? `🚨 Daily budget exceeded! Spent ₹${totalToday.toFixed(0)} of ₹${settings.dailyBudget}`
              : `⚠️ You've used ${percentUsed.toFixed(0)}% of your daily budget (₹${totalToday.toFixed(0)}/₹${settings.dailyBudget})`;
          
          await alertStorage.addNotification(message);
        }
      }

      // Check weekly budget
      if (settings.weeklyBudget && settings.enabledAlerts.includes(AlertType.WEEKLY_BUDGET)) {
        const weekExpenses = this.getExpensesInRange(expenses, 7);
        const totalWeek = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
        const percentUsed = (totalWeek / settings.weeklyBudget) * 100;

        if (percentUsed >= 80) {
          const message = 
            percentUsed >= 100
              ? `🚨 Weekly budget exceeded! Spent ₹${totalWeek.toFixed(0)} of ₹${settings.weeklyBudget}`
              : `⚠️ ${percentUsed.toFixed(0)}% of weekly budget used (₹${totalWeek.toFixed(0)}/₹${settings.weeklyBudget})`;
          
          await alertStorage.addNotification(message);
        }
      }

      // Check monthly budget
      if (settings.monthlyBudget && settings.enabledAlerts.includes(AlertType.MONTHLY_BUDGET)) {
        const monthExpenses = this.getExpensesInRange(expenses, 30);
        const totalMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const percentUsed = (totalMonth / settings.monthlyBudget) * 100;

        if (percentUsed >= 80) {
          const message = 
            percentUsed >= 100
              ? `🚨 Monthly budget exceeded! Spent ₹${totalMonth.toFixed(0)} of ₹${settings.monthlyBudget}`
              : `⚠️ ${percentUsed.toFixed(0)}% of monthly budget used (₹${totalMonth.toFixed(0)}/₹${settings.monthlyBudget})`;
          
          await alertStorage.addNotification(message);
        }
      }

      // Check category budgets
      if (settings.enabledAlerts.includes(AlertType.CATEGORY_BUDGET)) {
        const categoryBudget = settings.categoryBudgets.find(
          (cb) => cb.enabled && cb.category === newTransaction.category
        );

        if (categoryBudget) {
          const monthExpenses = this.getExpensesInRange(expenses, 30);
          const categoryExpenses = monthExpenses.filter(
            (e) => e.category === categoryBudget.category
          );
          const totalSpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
          const percentUsed = (totalSpent / categoryBudget.monthlyLimit) * 100;

          if (percentUsed >= 80) {
            const message = 
              percentUsed >= 100
                ? `🚨 ${categoryBudget.category} budget exceeded! Spent ₹${totalSpent.toFixed(0)} of ₹${categoryBudget.monthlyLimit}`
                : `⚠️ ${categoryBudget.category}: ${percentUsed.toFixed(0)}% of budget used (₹${totalSpent.toFixed(0)}/₹${categoryBudget.monthlyLimit})`;
            
            await alertStorage.addNotification(message);
          }
        }
      }

      // Check unusual spending
      if (settings.enabledAlerts.includes(AlertType.UNUSUAL_SPENDING)) {
        const todayExpenses = this.getExpensesInRange(expenses, 1);
        const totalToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        if (totalToday > 0) {
          const last30Days = this.getExpensesInRange(expenses, 30);
          const avgDaily = last30Days.reduce((sum, e) => sum + e.amount, 0) / 30;
          const multiplier = settings.unusualSpendingMultiplier || 2;

          if (totalToday > avgDaily * multiplier) {
            const message = `⚠️ Unusual spending detected! Today's spending (₹${totalToday.toFixed(0)}) is ${multiplier}x higher than your daily average`;
            await alertStorage.addNotification(message);
          }
        }
      }

      console.log("✅ Immediate notification check complete");
    } catch (error) {
      console.error("❌ Error triggering immediate notification:", error);
    }
  },
};