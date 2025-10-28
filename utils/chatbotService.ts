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
          properties: {}, // No parameters needed, it always runs for 'this_month'
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
  chatHistory: Content[] // Pass the existing chat history
): Promise<{ newHistory: Content[]; responseText: string }> {
  
  const systemPrompt: Part = {
    text: "You are an expert financial advisor. Analyze the user's spending data from their Google Sheet by using the provided tools. Be conversational, precise, and provide actionable insights. Always use the tools to get data before answering. If a query is vague (e.g., 'am I doing good?'), ask for clarification or use a tool (like 'get_spending_trend') to provide a data-backed starting point."
  };

  // 1. Add the user's new message to the history
  const historyWithUserQuery: Content[] = [
    ...chatHistory,
    { role: 'user', parts: [{ text: userQuery }] },
  ];

  try {
    // 2. === FIRST GEMINI CALL: Check for Tool Use ===
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          // Send system prompt ONLY if history is empty
          ...(chatHistory.length === 0 ? [{ role: 'user' as const, parts: [systemPrompt] }, { role: 'model' as const, parts: [{ text: "Understood. I am ready to help you analyze your expenses. What would you like to know?"}] }] : []),
          ...historyWithUserQuery
        ],
        tools: tools,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
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

    // 3. === DECISION: Is it a Tool Call or a Text Response? ===

    if (modelResponsePart.functionCall) {
      // --- CASE A: GEMINI WANTS TO USE A TOOL ---
      const functionCall = modelResponsePart.functionCall as FunctionCall;
      console.log('Gemini requested tool call:', functionCall.name, functionCall.args);

      // Add Gemini's function call to history
      const historyWithFunctionCall: Content[] = [
        ...historyWithUserQuery,
        { role: 'model', parts: [{ functionCall: functionCall }] }
      ];

      // 4. --- EXECUTE THE TOOL (Call Google Apps Script) ---
      const toolResult = await callGoogleAppsScript(functionCall);

      // 5. --- SECOND GEMINI CALL: Send Tool Result Back ---
      const finalResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            // Send the *entire* history again, now with the function response
            ...(chatHistory.length === 0 ? [{ role: 'user' as const, parts: [systemPrompt] }, { role: 'model' as const, parts: [{ text: "Understood. I am ready to help you analyze your expenses. What would you like to know?"}] }] : []),
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
          tools: tools, // Send tools again
        }),
      });

      if (!finalResponse.ok) {
        throw new Error(`Gemini API error (step 2): ${finalResponse.status}`);
      }

      const finalData = await finalResponse.json();
      const finalResponseText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || "I found the data, but couldn't formulate a response.";
      
      // Return the complete new history and the final text
      return {
        newHistory: [
          ...historyWithFunctionCall,
          { role: 'function', parts: [{ functionResponse: { name: functionCall.name, response: toolResult } }] },
          { role: 'model', parts: [{ text: finalResponseText }] }
        ],
        responseText: finalResponseText,
      };

    } else if (modelResponsePart.text) {
      // --- CASE B: GEMINI GAVE A TEXT RESPONSE ---
      // (e.g., "Hello!", or "Which category are you asking about?")
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

    // --- THIS IS THE FIX ---
    // Handle the 'unknown' error type
    let errorMessage = "An unknown error occurred while calling Google Apps Script.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    // -----------------------

    return { success: false, error: errorMessage };
  }
}