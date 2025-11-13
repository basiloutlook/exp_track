// utils/passiveInsightsService.ts - SIMPLIFIED PHASE 3
// No push notifications - just smart insights in chat when user opens app

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserPreferences } from '@/utils/conversationContextService';
import { ChatMessage } from '@/utils/chatHistoryService';

const STORAGE_KEY = '@expense_tracker:last_insight_check';

/**
 * Check if we should generate new insights (don't spam user)
 */
async function shouldGenerateInsights(): Promise<boolean> {
  const lastCheck = await AsyncStorage.getItem(STORAGE_KEY);
  
  if (!lastCheck) return true; // First time
  
  const lastCheckDate = new Date(lastCheck);
  const now = new Date();
  
  // Only generate insights once per day
  const hoursSinceLastCheck = (now.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceLastCheck >= 24;
}

/**
 * Main function - call when user opens chatbot
 * Adds insights to chat naturally, no push notifications
 */
export async function generatePassiveInsights(): Promise<void> {
  try {
    const shouldGenerate = await shouldGenerateInsights();
    
    if (!shouldGenerate) {
      console.log('⏭️ Skipping passive insights (already generated today)');
      return;
    }
    
    // Wrap in timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    const insightPromise = (async () => {
      const expenses = await getExpensesFromGoogleSheet();
      if (!expenses || expenses.length === 0) return;

      const preferences = await getUserPreferences();
      const insights: ChatMessage[] = [];
  
  // 1. Budget check (if user has goals)
  if (preferences.spendingGoals.length > 0) {
    const budgetInsight = await checkBudgetStatus(expenses, preferences);
    if (budgetInsight) insights.push(budgetInsight);
  }
  
  // 2. Unusual spending check
  const anomalyInsight = await checkForAnomalies(expenses);
  if (anomalyInsight) insights.push(anomalyInsight);
  
  // 3. Weekly summary (only on Sundays or user's preferred day)
  if (isWeeklySummaryDay()) {
    const summary = await generateWeeklySummary(expenses);
    insights.push(summary);
  }
  
  for (const insight of insights) {
        await chatHistoryService.saveMessage(insight);
      }
      
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    })();
    
    await Promise.race([insightPromise, timeoutPromise]);
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Timeout') {
      console.warn('⏱️ Passive insights timed out, skipping');
    } else {
      console.error('❌ Error in generatePassiveInsights:', error);
    }
  }
}
/**
 * Check budget status - only alert if significant
 */
async function checkBudgetStatus(
  expenses: any[], 
  preferences: any
): Promise<ChatMessage | null> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const thisMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    return expenseDate >= monthStart && expenseDate <= now;
  });
  
  const totalSpent = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  for (const goal of preferences.spendingGoals) {
    if (!goal.targetAmount) continue;
    
    const percentUsed = (totalSpent / goal.targetAmount) * 100;
    
    // Only alert at critical thresholds
    if (percentUsed >= 90 && percentUsed < 100) {
      return {
        id: `budget_warning_${Date.now()}`,
        text: `⚠️ Budget Alert: You've used ${Math.round(percentUsed)}% of your monthly budget (₹${Math.round(totalSpent)} of ₹${goal.targetAmount}). Consider slowing down spending.`,
        type: 'insight',
        timestamp: new Date(),
        insightData: {
          insightType: 'alert',
          severity: 'medium',
          title: 'Budget Warning',
          category: 'Budget',
        },
      };
    } else if (percentUsed >= 100) {
      const excess = totalSpent - goal.targetAmount;
      return {
        id: `budget_exceeded_${Date.now()}`,
        text: `🚨 Budget Exceeded: You've spent ₹${Math.round(excess)} over your monthly budget. Let's find ways to get back on track.`,
        type: 'insight',
        timestamp: new Date(),
        insightData: {
          insightType: 'alert',
          severity: 'high',
          title: 'Budget Exceeded',
          category: 'Budget',
        },
      };
    }
  }
  
  return null;
}

/**
 * Check for spending anomalies
 */
async function checkForAnomalies(expenses: any[]): Promise<ChatMessage | null> {
  if (expenses.length < 7) return null;
  
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  
  const last7Days = expenses.filter(e => {
    const date = new Date(e.date);
    return date >= sevenDaysAgo && date <= now;
  });
  
  const previous7Days = expenses.filter(e => {
    const date = new Date(e.date);
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });
  
  const last7Total = last7Days.reduce((sum, e) => sum + e.amount, 0);
  const previous7Total = previous7Days.reduce((sum, e) => sum + e.amount, 0);
  
  if (previous7Total > 0) {
    const percentChange = ((last7Total - previous7Total) / previous7Total) * 100;
    
    // Only alert if 75%+ increase (significant spike)
    if (percentChange >= 75) {
      return {
        id: `spending_spike_${Date.now()}`,
        text: `📈 Spending Spike: Your spending jumped ${Math.round(percentChange)}% this week (₹${Math.round(last7Total)} vs ₹${Math.round(previous7Total)} last week). Want to analyze what changed?`,
        type: 'insight',
        timestamp: new Date(),
        insightData: {
          insightType: 'trend',
          severity: 'medium',
          title: 'Unusual Spending Pattern',
          category: 'Spending',
        },
      };
    }
  }
  
  return null;
}

/**
 * Check if today is weekly summary day
 */
function isWeeklySummaryDay(): boolean {
  const dayOfWeek = new Date().getDay();
  return dayOfWeek === 0; // Sunday
}

/**
 * Generate weekly summary
 */
async function generateWeeklySummary(expenses: any[]): Promise<ChatMessage> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  
  const weekExpenses = expenses.filter(e => {
    const date = new Date(e.date);
    return date >= sevenDaysAgo && date <= now;
  });
  
  const totalSpent = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgDaily = totalSpent / 7;
  
  // Find top category
  const categoryTotals: Record<string, number> = {};
  weekExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  
  const topCategory = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])[0];
  
  return {
    id: `weekly_summary_${Date.now()}`,
    text: `📊 Weekly Summary\n\nThis week you spent ₹${Math.round(totalSpent)} (avg ₹${Math.round(avgDaily)}/day)\n\nTop category: ${topCategory[0]} (₹${Math.round(topCategory[1])})\n\nWant a detailed breakdown?`,
    type: 'insight',
    timestamp: new Date(),
    insightData: {
      insightType: 'behavioral',
      severity: 'low',
      title: 'Weekly Summary',
      category: 'Summary',
    },
  };
}

/**
 * Check for specific patterns from user's actual data
 */
export async function checkDataSpecificPatterns(expenses: any[]): Promise<ChatMessage[]> {
  const insights: ChatMessage[] = [];
  
  // Pattern 1: Multiple rent payments (from user's actual data)
  const rentExpenses = expenses.filter(e => 
    e.subCategory?.toLowerCase().includes('rent') || 
    e.category?.toLowerCase().includes('housing')
  );
  
  if (rentExpenses.length >= 2) {
    const uniqueRents = new Set(rentExpenses.map(e => e.amount));
    if (uniqueRents.size >= 2) {
      insights.push({
        id: `multiple_rents_${Date.now()}`,
        text: `🏠 I noticed you're paying rent at multiple places (${Array.from(uniqueRents).map(r => `₹${r}`).join(', ')}). Is this temporary? This could be your biggest opportunity to save.`,
        type: 'insight',
        timestamp: new Date(),
        insightData: {
          insightType: 'alert',
          severity: 'high',
          title: 'Multiple Rent Payments',
          category: 'Housing'
        },
      });
    }
  }
  
  // Pattern 2: High taxi + fuel spending
  const transportExpenses = expenses.filter(e => e.category === 'Transportation');
  const taxiSpend = transportExpenses
    .filter(e => e.subCategory === 'Taxi')
    .reduce((sum, e) => sum + e.amount, 0);
  const fuelSpend = transportExpenses
    .filter(e => e.subCategory === 'Fuel')
    .reduce((sum, e) => sum + e.amount, 0);
  
  if (taxiSpend > 0 && fuelSpend > 0) {
    insights.push({
      id: `transport_inefficiency_${Date.now()}`,
      text: `🚕 You're spending on both taxi (₹${Math.round(taxiSpend)}) and fuel (₹${Math.round(fuelSpend)}). Are you maintaining a vehicle you rarely use? This could be costing you extra.`,
      type: 'insight',
      timestamp: new Date(),
      insightData: {
        insightType: 'behavioral',
        severity: 'medium',
        title: 'Transportation Efficiency',
        category: 'Transportation',
      },
    });
  }
  
  // Pattern 3: High eating out, low groceries
  const foodExpenses = expenses.filter(e => e.category === 'Food');
  const grocerySpend = foodExpenses
    .filter(e => e.subCategory === 'Groceries')
    .reduce((sum, e) => sum + e.amount, 0);
  const eatingOutSpend = foodExpenses
    .filter(e => e.subCategory !== 'Groceries')
    .reduce((sum, e) => sum + e.amount, 0);
  
  if (eatingOutSpend > grocerySpend * 5) { // Eating out is 5x+ groceries
    const potentialSavings = Math.round(eatingOutSpend * 0.6); // Could save 60%
    insights.push({
      id: `food_pattern_${Date.now()}`,
      text: `🍔 Food Insight: You're spending ₹${Math.round(eatingOutSpend)} eating out vs only ₹${Math.round(grocerySpend)} on groceries. Cooking just a few more meals at home could save you ₹${potentialSavings}/month.`,
      type: 'insight',
      timestamp: new Date(),
      insightData: {
        insightType: 'behavioral',
        severity: 'medium',
        title: 'Food Spending Pattern',
        category: 'Food',
      },
    });
  }
  
  return insights;
}

// ===================== AUTO INSIGHT GENERATOR =====================

import { chatHistoryService } from "./chatHistoryService";
import { getExpensesFromGoogleSheet } from "./googleSheets";
import { Expense } from "@/types/expense";

// Utility: Create a unique identifier for each insight
const generateInsightKey = (category: string, metric: string, period: string) => {
  return `${category}_${metric}_${period}`.toLowerCase();
};

// Utility: Group expenses by category
function groupExpensesByCategory(expenses: Expense[]) {
  return expenses.reduce((acc: Record<string, Expense[]>, exp) => {
    const cat = exp.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(exp);
    return acc;
  }, {});
}

// Utility: Calculate total spending for last 7 days
function getSpendingLastWeek(data: Expense[]): number {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return data
    .filter((d) => new Date(d.date) >= lastWeek)
    .reduce((sum, e) => sum + e.amount, 0);
}

// MAIN FUNCTION: Generate actionable insights & inject into chat
export async function generateAndInjectInsights() {
  try {
    const expenses = await getExpensesFromGoogleSheet();
    if (!expenses || expenses.length === 0) return;

    const grouped = groupExpensesByCategory(expenses);
    const insights: any[] = [];

    for (const [category, data] of Object.entries(grouped)) {
      const total = data.reduce((sum, e) => sum + e.amount, 0);
      const avg = total / data.length;
      const lastWeek = getSpendingLastWeek(data);

      // Insight #1: Spending increase
      if (lastWeek > avg * 1.3) {
        insights.push({
          text: `Your spending in ${category} rose by ${Math.round(((lastWeek - avg) / avg) * 100)}% this week.`,
          type: "insight",
          insightData: {
            title: "Spending Surge",
            category,
            metric: "increase",
            period: "weekly",
            severity: "medium",
            action: "recommend_budget_adjustment",
          },
        });
      }

      // Insight #2: Consistent overspending
      if (avg > 0 && lastWeek > avg * 1.5) {
        insights.push({
          text: `You’ve been overspending in ${category}. Try setting a spending limit for next week.`,
          type: "insight",
          insightData: {
            title: "Overspending Pattern",
            category,
            metric: "habitual_overspend",
            period: "weekly",
            severity: "high",
            action: "suggest_budget_cap",
          },
        });
      }

      // Insight #3: Positive trend
      if (lastWeek < avg * 0.8 && avg > 0) {
        insights.push({
          text: `Nice! Your ${category} expenses dropped by ${Math.round(((avg - lastWeek) / avg) * 100)}%. Keep it up!`,
          type: "insight",
          insightData: {
            title: "Positive Spending Trend",
            category,
            metric: "decrease",
            period: "weekly",
            severity: "positive",
            action: "reinforce_saving_behavior",
          },
        });
      }
    }

    // Save only new insights (avoid duplicates)
    for (const insight of insights) {
      const key = generateInsightKey(
        insight.insightData.category,
        insight.insightData.metric,
        insight.insightData.period
      );

      // Some implementations of chatHistoryService may not expose hasInsight.
      // Safely call it if present, otherwise treat as "not existing" to save the insight.
      const hasInsightFn = (chatHistoryService as any).hasInsight;
      const alreadyExists = typeof hasInsightFn === 'function'
        ? await hasInsightFn.call(chatHistoryService, key)
        : false;

      if (!alreadyExists) {
        await chatHistoryService.saveMessage({
          ...insight,
          insightData: { ...insight.insightData, key },
          timestamp: new Date(),
        });
        console.log(`💡 New insight saved: ${insight.insightData.title}`);
      } else {
        console.log(`⏩ Skipped duplicate insight: ${insight.insightData.title}`);
      }
    }
  } catch (err) {
    console.error("❌ Error in generateAndInjectInsights:", err);
  }
}
