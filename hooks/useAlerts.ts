// hooks/useAlerts.ts
import { useState, useEffect, useCallback } from "react";
import { Alert } from "@/types/alert";
import { Expense } from "@/types/expense";
import { alertStorage } from "@/utils/alertStorage";
import { alertEngine } from "@/utils/alertEngine";

export function useAlerts(expenses: Expense[]) {
  const [pendingAlerts, setPendingAlerts] = useState<Alert[]>([]);
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasBudgets, setHasBudgets] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Load pending alerts on mount
  useEffect(() => {
    loadAlerts();
  }, []);

  // Evaluate new alerts when expenses change
  useEffect(() => {
    if (expenses.length > 0) {
      evaluateAlerts();
    }
  }, [expenses]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const [pending, budgetsConfigured, completed] = await Promise.all([
        alertStorage.getPendingAlerts(),
        alertStorage.hasBudgetsConfigured(),
        alertStorage.hasCompletedOnboarding(),
      ]);

      setPendingAlerts(pending);
      setHasBudgets(budgetsConfigured);
      setOnboardingComplete(completed);

      // Show first pending alert if any
      if (pending.length > 0 && !currentAlert) {
        setCurrentAlert(pending[0]);
      }
    } catch (error) {
      console.error("❌ Error loading alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const evaluateAlerts = async () => {
    try {
      // Check if we should evaluate (not too frequently)
      const lastEval = await alertStorage.getLastEvaluation();
      const hoursSinceLastEval = (Date.now() - lastEval) / (1000 * 60 * 60);

      // Evaluate at most once per hour
      if (hoursSinceLastEval < 1) {
        console.log("⏭️ Skipping alert evaluation (evaluated recently)");
        return;
      }

      console.log("🔄 Evaluating alerts...");
      const newAlerts = await alertEngine.evaluateAlerts(expenses);

      if (newAlerts.length > 0) {
        // Reload pending alerts
        await loadAlerts();
      }
    } catch (error) {
      console.error("❌ Error evaluating alerts:", error);
    }
  };

  const dismissCurrentAlert = useCallback(() => {
    if (!currentAlert) return;

    alertStorage.dismissAlert(currentAlert.id);
    
    // Show next alert if available
    const remaining = pendingAlerts.filter((a) => a.id !== currentAlert.id);
    setPendingAlerts(remaining);
    setCurrentAlert(remaining.length > 0 ? remaining[0] : null);
  }, [currentAlert, pendingAlerts]);

  const showNextAlert = useCallback(() => {
    if (currentAlert) {
      alertStorage.markAlertAsRead(currentAlert.id);
    }

    const remaining = pendingAlerts.filter((a) => a.id !== currentAlert?.id);
    setPendingAlerts(remaining);
    setCurrentAlert(remaining.length > 0 ? remaining[0] : null);
  }, [currentAlert, pendingAlerts]);

  const refreshAlerts = useCallback(async () => {
    await loadAlerts();
  }, []);

  return {
    currentAlert,
    pendingAlerts,
    pendingCount: pendingAlerts.length,
    loading,
    hasBudgets,
    onboardingComplete,
    showBudgetWarning: !onboardingComplete || !hasBudgets,
    dismissCurrentAlert,
    showNextAlert,
    refreshAlerts,
    evaluateAlerts,
  };
}