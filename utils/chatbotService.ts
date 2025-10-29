// utils/chatbotService.ts

// These are your Gemini API credentials
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY!;
const GEMINI_API_URL = process.env.EXPO_PUBLIC_GEMINI_API_URL!; 

// This is the NEW Web App URL from your deployed Google Apps Script
const GAS_WEB_APP_URL = process.env.EXPO_PUBLIC_GAS_WEB_APP_URL!;

console.log("🔑 GEMINI_API_URL:", GEMINI_API_URL);
console.log("🔐 GEMINI_API_KEY:", GEMINI_API_KEY ? "Loaded ✅" : "❌ Missing");
console.log("📈 GAS_WEB_APP_URL:", GAS_WEB_APP_URL ? "Loaded ✅" : "❌ Missing");

// Define the conversation history types
// (These match the Gemini API structure)
export interface Content {
  role: 'user' | 'model' | 'function';
  parts: Part[];
}

export interface Part {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionResponse {
  name: string;
  response: Record<string, any>;
}

/**
 * ===================================================================
 * Tool Definition
 * * This JSON object tells Gemini what functions (tools) it has 
 * access to. The "name", "description", and "parameters" must
 * exactly match what your chatbot.gs file expects.
 * ===================================================================
 */
const tools = [
  {
    functionDeclarations: [
      // YOUR EXISTING 4 TOOLS - KEEP THESE AS IS
      {
        name: 'get_spending_trend',
        description: "Get the user's total spending trend for a period, compared to the previous period.",
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: "The period to check, e.g., 'this_month', 'this_week'. Defaults to 'this_month'.",
            },
          },
          required: [],
        },
      },
      {
        name: 'get_top_categories',
        description: 'Get the top N spending categories for a given period.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: "The period to check, e.g., 'this_month'. Defaults to 'this_month'.",
            },
            count: {
              type: 'NUMBER',
              description: 'The number of categories to return. Defaults to 3.',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_category_vs_average',
        description: "Checks if any spending categories this month are significantly higher than their 3-month average.",
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_impulse_purchases',
        description: 'Get total spending and top categories for items labeled "Impulse" in a given period.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: "The period to check, e.g., 'this_month'. Defaults to 'this_month'.",
            },
          },
          required: [],
        },
      },
      
      // ============================================
      // ADD THESE 4 NEW TOOLS BELOW
      // ============================================
      
      {
        name: 'filter_expenses',
        description: 'Filter expenses with multiple criteria including period, categories, amount range, payment method, and labels. Returns detailed expense list.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: "Time period: 'today', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days', 'last_3_months', 'last_6_months', 'this_year'",
            },
            categories: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Array of category names to filter by',
            },
            minAmount: {
              type: 'NUMBER',
              description: 'Minimum transaction amount',
            },
            maxAmount: {
              type: 'NUMBER',
              description: 'Maximum transaction amount',
            },
            paymentMethod: {
              type: 'STRING',
              description: 'Filter by payment method',
            },
            label: {
              type: 'STRING',
              description: "Filter by label (e.g., 'impulse')",
            },
            sortBy: {
              type: 'STRING',
              description: "Sort by 'date' or 'amount'",
            },
            sortOrder: {
              type: 'STRING',
              description: "Sort order: 'asc' or 'desc'",
            },
            limit: {
              type: 'NUMBER',
              description: 'Maximum number of results to return',
            },
          },
          required: [],
        },
      },
      
      {
        name: 'compare_time_periods',
        description: 'Compare spending across multiple time periods with category breakdowns. Great for week-to-week or month-to-month comparisons.',
        parameters: {
          type: 'OBJECT',
          properties: {
            periods: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: "Array of periods to compare, e.g., ['this_week', 'last_week'] or ['this_month', 'last_month', 'last_3_months']",
            },
          },
          required: ['periods'],
        },
      },
      
      {
        name: 'analyze_spending_patterns',
        description: 'Analyze spending patterns including day-of-week spending, outlier transactions (unusually high amounts), and recurring expenses.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: "Time period to analyze. Defaults to 'last_30_days'",
            },
          },
          required: [],
        },
      },
      
      {
        name: 'get_expense_statistics',
        description: 'Get comprehensive statistics including total, average, median, min, max, payment method breakdown, and unique counts.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: "Time period for statistics. Defaults to 'this_month'",
            },
          },
          required: [],
        },
      },

      {
        name: 'analyze_spending_behavior',
        description: 'Deep behavioral analysis: timing patterns (when you spend most), psychological triggers (what leads to spending), and spending psychology (small vs large purchases). Use this to understand WHY the user spends.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: "Time period to analyze. Defaults to 'last_30_days'",
            },
            focus_area: {
              type: 'STRING',
              description: "Focus area: 'timing' (when they spend), 'triggers' (what causes spending), 'psychology' (spending patterns), or 'all'",
            },
          },
          required: [],
        },
      },
      
      {
        name: 'compare_alternatives',
        description: 'Show cheaper alternatives based on actual usage patterns. Compares current spending (e.g., taxi) with alternatives (e.g., public transport) including trade-offs (time, comfort, etc.). Use when user asks how to save money in a specific category.',
        parameters: {
          type: 'OBJECT',
          properties: {
            category: {
              type: 'STRING',
              description: "Category to find alternatives for (e.g., 'Transportation', 'Food')",
            },
            period: {
              type: 'STRING',
              description: "Time period to analyze. Defaults to 'this_month'",
            },
          },
          required: ['category'],
        },
      },
      
      {
        name: 'forecast_spending',
        description: 'Predict future spending with confidence intervals. Projects month-end total based on current pace, shows category-wise forecasts, and warns if overspending is likely. Use for "Am I on track?" or "How much will I spend this month?" questions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            projection_period: {
              type: 'STRING',
              description: "Period to forecast: 'this_month', 'next_month', 'rest_of_year'",
            },
          },
          required: [],
        },
      },
      
      {
        name: 'optimize_budget',
        description: 'AI-powered budget optimization. Provides multiple strategies to reduce spending, actionable steps ranked by effort and impact, and respects user constraints. Use when user asks "How can I save money?" or "I need to cut ₹5000 from my budget".',
        parameters: {
          type: 'OBJECT',
          properties: {
            goal: {
              type: 'STRING',
              description: "Optimization goal: 'save_money', 'balance', 'reduce_category'",
            },
            target_amount: {
              type: 'NUMBER',
              description: 'Amount to save/reduce (in rupees)',
            },
            constraints: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: "Categories to protect from cuts, e.g., ['keep_food', 'keep_transport']",
            },
          },
          required: ['goal'],
        },
      },
      
      {
        name: 'detect_anomalies',
        description: 'Detect unusual spending patterns and outlier transactions with context. Identifies suspicious patterns (e.g., rapid successive purchases), rare category spending, and transactions significantly above average. Use for "Any unusual spending?" or to proactively alert user.',
        parameters: {
          type: 'OBJECT',
          properties: {
            sensitivity: {
              type: 'STRING',
              description: "Detection sensitivity: 'low' (only major outliers), 'medium' (balanced), 'high' (flag more anomalies)",
            },
            period: {
              type: 'STRING',
              description: "Time period to analyze. Defaults to 'last_30_days'",
            },
          },
          required: [],
        },
      },
    ],
  },
];

/**
 * ===================================================================
 * NEW getChatbotResponse - The Orchestrator
 * * This function now manages the multi-step tool-use flow.
 * It NO LONGER takes the `expenses` array.
 * ===================================================================
 */
export async function getChatbotResponse(
  userQuery: string,
  chatHistory: Content[],
  userContext: string = '' // Optional with default
): Promise<{ newHistory: Content[]; responseText: string }> {
  
  const systemPrompt: Part = {
    text: `You are an intelligent personal finance assistant and behavioral analyst. You don't just report numbers - you provide deep insights and actionable recommendations.

🎯 YOUR CAPABILITIES (13 Tools):

BASIC ANALYSIS (8 tools):
1. get_spending_trend - Compare periods
2. get_top_categories - Top spending areas
3. get_category_vs_average - Historical comparison
4. get_impulse_purchases - Impulse spending analysis
5. filter_expenses - Advanced filtering
6. compare_time_periods - Multi-period comparison
7. analyze_spending_patterns - Pattern detection
8. get_expense_statistics - Statistical analysis

ADVANCED INTELLIGENCE (5 tools):
9. analyze_spending_behavior - WHY they spend (timing, triggers, psychology)
10. compare_alternatives - Show cheaper options with trade-offs
11. forecast_spending - Predict future spending with confidence
12. optimize_budget - AI-powered budget optimization strategies
13. detect_anomalies - Find unusual patterns and outliers

💡 HOW TO BE HELPFUL:

When user asks vague questions:
- "Why am I broke?" → Use forecast_spending + optimize_budget + analyze_spending_behavior
- "Help me save money" → Use compare_alternatives + optimize_budget
- "Am I doing okay?" → Use get_spending_trend + forecast_spending + detect_anomalies
- "Any problems?" → Use detect_anomalies + analyze_spending_behavior

Be conversational and empathetic:
❌ BAD: "Your spending is ₹14,335"
✅ GOOD: "You've spent ₹14,335 in just 4 days - that's concerning. The main issue is ₹10,500 (73%) went to rent at TWO locations. Let's address this first."

Always provide context and action steps:
- Numbers WITH meaning ("₹150 tea = ₹4,500/month = could save for emergency fund")
- Specific recommendations ("Use train instead of taxi for non-urgent trips")
- Trade-offs explained ("Public transport saves ₹500/week but adds 30min/day")

Current date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Remember: You're a financial coach, not just a calculator. Help users understand their behavior and make better decisions.`
  };

  const historyWithUserQuery: Content[] = [
    ...chatHistory,
    { role: 'user', parts: [{ text: userQuery }] },
  ];

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          ...(chatHistory.length === 0 ? [
            { role: 'user' as const, parts: [systemPrompt] }, 
            { role: 'model' as const, parts: [{ text: "Understood. I'm ready to help you analyze your expenses and make better financial decisions. What would you like to know?"}] }
          ] : []),
          ...historyWithUserQuery
        ],
        tools: tools,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const modelResponsePart = data.candidates?.[0]?.content?.parts?.[0];

    if (!modelResponsePart) {
      throw new Error("Invalid response from Gemini.");
    }

    if (modelResponsePart.functionCall) {
      const functionCall = modelResponsePart.functionCall as FunctionCall;
      console.log('Gemini requested tool call:', functionCall.name, functionCall.args);

      const historyWithFunctionCall: Content[] = [
        ...historyWithUserQuery,
        { role: 'model', parts: [{ functionCall: functionCall }] }
      ];

      const toolResult = await callGoogleAppsScript(functionCall);

      const finalResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            ...(chatHistory.length === 0 ? [
              { role: 'user' as const, parts: [systemPrompt] }, 
              { role: 'model' as const, parts: [{ text: "Understood. I'm ready to help you analyze your expenses and make better financial decisions. What would you like to know?"}] }
            ] : []),
            ...historyWithFunctionCall,
            {
              role: 'function',
              parts: [{
                functionResponse: {
                  name: functionCall.name,
                  response: toolResult,
                }
              }]
            }
          ],
          tools: tools,
        }),
      });

      if (!finalResponse.ok) {
        throw new Error(`Gemini API error (step 2): ${finalResponse.status}`);
      }

      const finalData = await finalResponse.json();
      const finalResponseText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || "I found the data, but couldn't formulate a response.";
      
      return {
        newHistory: [
          ...historyWithFunctionCall,
          { role: 'function', parts: [{ functionResponse: { name: functionCall.name, response: toolResult } }] },
          { role: 'model', parts: [{ text: finalResponseText }] }
        ],
        responseText: finalResponseText,
      };

    } else if (modelResponsePart.text) {
      const responseText = modelResponsePart.text;
      
      return {
        newHistory: [
          ...historyWithUserQuery,
          { role: 'model', parts: [{ text: responseText }] }
        ],
        responseText: responseText,
      };
    } else {
      throw new Error("No valid response part (text or functionCall) found.");
    }

  } catch (error) {
    console.error('Chatbot error:', error);
    const fallbackText = "I'm having trouble connecting to my data. Please try again in a moment.";
    return {
      newHistory: [
        ...historyWithUserQuery,
        { role: 'model', parts: [{ text: fallbackText }] }
      ],
      responseText: fallbackText,
    };
  }
}

/**
 * Helper function to call your Google Apps Script Web App
 */
// utils/chatbotService.ts

/**
 * Helper function to call your Google Apps Script Web App
 */
async function callGoogleAppsScript(functionCall: FunctionCall): Promise<Record<string, any>> {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ functionCall }),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(`Google Apps Script logical error: ${data.error}`);
    }

    console.log('Received data from GAS:', data);
    return data;

  } catch (error) {
    console.error('Error calling Google Apps Script:', error);

    let errorMessage = "An unknown error occurred while calling Google Apps Script.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return { success: false, error: errorMessage };
  }
}