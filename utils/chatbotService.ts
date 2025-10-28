// utils/chatbotService.ts
import { Expense } from '@/types/expense';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Add to your environment variables
const GEMINI_API_URL = process.env.GEMINI_API_URL;

interface ExpenseAnalytics {
  totalExpenses: number;
  categoryBreakdown: Record<string, number>;
  monthlyTrends: Record<string, number>;
  weeklyTrends: Record<string, number>;
  topVendors: Array<{ name: string; amount: number; count: number }>;
  paymentMethodBreakdown: Record<string, number>;
  labelBreakdown: Record<string, number>;
  recentExpenses: Expense[];
  averages: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  spendingPatterns: {
    peakDays: string[];
    peakHours: number[];
    consecutiveDays: number;
    zeroSpendDays: number;
  };
}

/**
 * Analyze expenses and generate comprehensive analytics
 */
function analyzeExpenses(expenses: Expense[]): ExpenseAnalytics {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter expenses for current month
  const currentMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
  });

  // Calculate totals
  const totalExpenses = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  currentMonthExpenses.forEach(e => {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
  });

  // Monthly trends (last 6 months)
  const monthlyTrends: Record<string, number> = {};
  for (let i = 0; i < 6; i++) {
    const targetMonth = new Date(currentYear, currentMonth - i, 1);
    const monthKey = targetMonth.toLocaleString('default', { month: 'short', year: 'numeric' });
    const monthExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate.getMonth() === targetMonth.getMonth() && 
             expenseDate.getFullYear() === targetMonth.getFullYear();
    });
    monthlyTrends[monthKey] = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }

  // Weekly trends (last 4 weeks)
  const weeklyTrends: Record<string, number> = {};
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekKey = `Week ${4 - i}`;
    const weekExpenses = currentMonthExpenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate >= weekStart && expenseDate <= weekEnd;
    });
    weeklyTrends[weekKey] = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
  }

  // Top vendors
  const vendorMap: Record<string, { amount: number; count: number }> = {};
  currentMonthExpenses.forEach(e => {
    if (e.shopName) {
      if (!vendorMap[e.shopName]) {
        vendorMap[e.shopName] = { amount: 0, count: 0 };
      }
      vendorMap[e.shopName].amount += e.amount;
      vendorMap[e.shopName].count += 1;
    }
  });
  const topVendors = Object.entries(vendorMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Payment method breakdown
  const paymentMethodBreakdown: Record<string, number> = {};
  currentMonthExpenses.forEach(e => {
    paymentMethodBreakdown[e.paymentMode] = (paymentMethodBreakdown[e.paymentMode] || 0) + e.amount;
  });

  // Label breakdown
  const labelBreakdown: Record<string, number> = {};
  currentMonthExpenses.forEach(e => {
    if (e.labels && Array.isArray(e.labels)) {
      e.labels.forEach(label => {
        labelBreakdown[label] = (labelBreakdown[label] || 0) + e.amount;
      });
    }
  });

  // Recent expenses
  const recentExpenses = [...currentMonthExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // Calculate averages
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDayOfMonth = now.getDate();
  const dailyAverage = totalExpenses / currentDayOfMonth;
  const weeklyAverage = totalExpenses / (currentDayOfMonth / 7);
  const monthlyAverage = expenses
    .filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate.getFullYear() === currentYear;
    })
    .reduce((sum, e) => sum + e.amount, 0) / (currentMonth + 1);

  // Spending patterns
  const dayMap: Record<string, number> = {};
  const hourMap: Record<number, number> = {};
  const dateSet = new Set<string>();
  
  currentMonthExpenses.forEach(e => {
    const expenseDate = new Date(e.date);
    const dayName = expenseDate.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = expenseDate.getHours();
    const dateKey = expenseDate.toDateString();
    
    dayMap[dayName] = (dayMap[dayName] || 0) + 1;
    hourMap[hour] = (hourMap[hour] || 0) + 1;
    dateSet.add(dateKey);
  });

  const peakDays = Object.entries(dayMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => day);

  const peakHours = Object.entries(hourMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([hour]) => parseInt(hour));

  // Calculate consecutive spending days
  const sortedDates = Array.from(dateSet).sort();
  let consecutiveDays = 0;
  let currentStreak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      currentStreak++;
      consecutiveDays = Math.max(consecutiveDays, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  const zeroSpendDays = currentDayOfMonth - dateSet.size;

  return {
    totalExpenses,
    categoryBreakdown,
    monthlyTrends,
    weeklyTrends,
    topVendors,
    paymentMethodBreakdown,
    labelBreakdown,
    recentExpenses,
    averages: {
      daily: dailyAverage,
      weekly: weeklyAverage,
      monthly: monthlyAverage,
    },
    spendingPatterns: {
      peakDays,
      peakHours,
      consecutiveDays,
      zeroSpendDays,
    },
  };
}

/**
 * Build system prompt with analytics context
 */
function buildSystemPrompt(analytics: ExpenseAnalytics): string {
  return `You are an AI expense assistant analyzing user spending data. Be helpful, insightful, and conversational.

**Current Context:**
- Total Expenses This Month: ₹${analytics.totalExpenses.toFixed(2)}
- Daily Average: ₹${analytics.averages.daily.toFixed(2)}
- Weekly Average: ₹${analytics.averages.weekly.toFixed(2)}
- Monthly Average: ₹${analytics.averages.monthly.toFixed(2)}

**Category Breakdown:**
${Object.entries(analytics.categoryBreakdown)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, amt]) => `- ${cat}: ₹${amt.toFixed(2)}`)
  .join('\n')}

**Monthly Trends:**
${Object.entries(analytics.monthlyTrends)
  .map(([month, amt]) => `- ${month}: ₹${amt.toFixed(2)}`)
  .join('\n')}

**Weekly Trends:**
${Object.entries(analytics.weeklyTrends)
  .map(([week, amt]) => `- ${week}: ₹${amt.toFixed(2)}`)
  .join('\n')}

**Top Vendors:**
${analytics.topVendors.map(v => `- ${v.name}: ₹${v.amount.toFixed(2)} (${v.count} transactions)`).join('\n')}

**Payment Methods:**
${Object.entries(analytics.paymentMethodBreakdown)
  .sort((a, b) => b[1] - a[1])
  .map(([method, amt]) => `- ${method}: ₹${amt.toFixed(2)}`)
  .join('\n')}

**Labels/Tags:**
${Object.entries(analytics.labelBreakdown)
  .sort((a, b) => b[1] - a[1])
  .map(([label, amt]) => `- ${label}: ₹${amt.toFixed(2)}`)
  .join('\n')}

**Spending Patterns:**
- Peak spending days: ${analytics.spendingPatterns.peakDays.join(', ')}
- Peak spending hours: ${analytics.spendingPatterns.peakHours.map(h => `${h}:00`).join(', ')}
- Consecutive spending days: ${analytics.spendingPatterns.consecutiveDays}
- Zero-spend days this month: ${analytics.spendingPatterns.zeroSpendDays}

**Recent Transactions (Last 10):**
${analytics.recentExpenses.slice(0, 5).map(e => 
  `- ${e.item} (${e.category}): ₹${e.amount} on ${new Date(e.date).toLocaleDateString()}`
).join('\n')}

**Instructions:**
1. Answer questions about spending patterns, trends, and insights
2. Provide actionable recommendations when appropriate
3. Detect unusual patterns (spikes, frequent vendors, impulse purchases)
4. Compare current spending with averages and past periods
5. Be conversational but precise with numbers
6. Format currency as ₹X.XX
7. Keep responses concise (3-5 sentences max unless detailed analysis requested)
8. Proactively highlight concerning patterns or positive behaviors

Example insights you can provide:
- Spending alerts (exceeding averages)
- Category comparisons
- Vendor frequency analysis
- Payment method preferences
- Label-based summaries (e.g., "Impulse" expenses)
- Trend analysis (increasing/decreasing)
- Zero-spend streak encouragement`;
}

/**
 * Call Gemini API with expense context
 */
export async function getChatbotResponse(userQuery: string, expenses: Expense[]): Promise<string> {
  try {
    // Analyze expenses
    const analytics = analyzeExpenses(expenses);
    
    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(analytics);
    
    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `User Question: ${userQuery}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          topP: 0.8,
          topK: 40,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                          "I couldn't generate a response. Please try again.";

    return generatedText;
  } catch (error) {
    console.error('Chatbot error:', error);
    
    // Fallback to rule-based responses
    return generateFallbackResponse(userQuery, expenses);
  }
}

/**
 * Fallback rule-based responses when API fails
 */
function generateFallbackResponse(query: string, expenses: Expense[]): string {
  const analytics = analyzeExpenses(expenses);
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('total') || lowerQuery.includes('spent')) {
    return `This month, you've spent ₹${analytics.totalExpenses.toFixed(2)} across ${Object.keys(analytics.categoryBreakdown).length} categories. Your daily average is ₹${analytics.averages.daily.toFixed(2)}.`;
  }

  if (lowerQuery.includes('category') || lowerQuery.includes('categories')) {
    const topCategory = Object.entries(analytics.categoryBreakdown)
      .sort((a, b) => b[1] - a[1])[0];
    return `Your top spending category is ${topCategory[0]} with ₹${topCategory[1].toFixed(2)}. Other major categories include: ${Object.entries(analytics.categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(1, 3)
      .map(([cat, amt]) => `${cat} (₹${amt.toFixed(2)})`)
      .join(', ')}.`;
  }

  if (lowerQuery.includes('trend') || lowerQuery.includes('pattern')) {
    const months = Object.entries(analytics.monthlyTrends);
    const lastMonth = months[1];
    const currentMonth = months[0];
    const change = currentMonth[1] - lastMonth[1];
    const percentChange = ((change / lastMonth[1]) * 100).toFixed(1);
    
    return `Compared to ${lastMonth[0]}, your spending is ${change > 0 ? 'up' : 'down'} by ${Math.abs(parseFloat(percentChange))}% (₹${Math.abs(change).toFixed(2)}). You typically spend most on ${analytics.spendingPatterns.peakDays.join(' and ')}.`;
  }

  if (lowerQuery.includes('impulse')) {
    const impulseAmount = analytics.labelBreakdown['Impulse'] || 0;
    return `Your impulse purchases this month total ₹${impulseAmount.toFixed(2)}. ${impulseAmount > analytics.averages.weekly ? 'This is higher than your weekly average - consider budgeting for these expenses.' : 'Great job keeping impulse spending under control!'}`;
  }

  return `I found ${expenses.length} total transactions. This month you've spent ₹${analytics.totalExpenses.toFixed(2)}. Your top category is ${Object.entries(analytics.categoryBreakdown).sort((a, b) => b[1] - a[1])[0][0]}. Ask me about trends, categories, or specific insights!`;
}