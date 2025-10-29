// utils/conversationContextService.ts - PHASE 2: Conversational Context

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User preferences and learned behavior
 */
export interface UserPreferences {
  preferredTone: 'casual' | 'professional' | 'friendly';
  priorityCategories: string[]; // Categories user cares most about
  avoidanceTopics: string[]; // Things user doesn't want to discuss
  spendingGoals: {
    category?: string;
    targetAmount?: number;
    timeframe?: string;
  }[];
  constraints: string[]; // e.g., "keep_food", "safety_priority"
  reminderPreferences: {
    rentReminder: boolean;
    budgetAlerts: boolean;
    savingsGoals: boolean;
  };
}

/**
 * Conversation memory - tracks what was discussed
 */
export interface ConversationMemory {
  lastDiscussedTopics: string[]; // Last 10 topics
  unresolvedIssues: string[]; // Issues user acknowledged but hasn't fixed (removed space)
  acknowledgedInsights: string[]; // Insights user said were helpful
  dismissedSuggestions: string[]; // Suggestions user rejected
  lastReviewDate?: Date;
}
/**
 * Learned patterns about user behavior
 */
export interface LearnedPatterns {
  typicalSpendingDays: number[]; // Day of week (0-6)
  peakSpendingHours: number[]; // Hour of day (0-23)
  frequentMerchants: string[];
  categoryAverages: Record<string, number>;
  savingsRate?: number;
  lastUpdated: Date;
}

const STORAGE_KEYS = {
  PREFERENCES: '@expense_tracker:user_preferences',
  MEMORY: '@expense_tracker:conversation_memory',
  PATTERNS: '@expense_tracker:learned_patterns',
  FEEDBACK: '@expense_tracker:insight_feedback',
};

/**
 * Initialize default preferences for new users
 */
export async function initializeUserContext(): Promise<void> {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
  
  if (!existing) {
    const defaultPreferences: UserPreferences = {
      preferredTone: 'friendly',
      priorityCategories: [],
      avoidanceTopics: [],
      spendingGoals: [],
      constraints: [],
      reminderPreferences: {
        rentReminder: true,
        budgetAlerts: true,
        savingsGoals: true,
      },
    };
    
    await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(defaultPreferences));
    
    const defaultMemory: ConversationMemory = {
      lastDiscussedTopics: [],
      unresolvedIssues: [],
      acknowledgedInsights: [],
      dismissedSuggestions: [],
    };
    
    await AsyncStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(defaultMemory));
  }
}

/**
 * Get user preferences
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
  
  if (!data) {
    await initializeUserContext();
    return getUserPreferences();
  }
  
  return JSON.parse(data);
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
  const current = await getUserPreferences();
  const updated = { ...current, ...updates };
  await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
}

/**
 * Get conversation memory
 */
export async function getConversationMemory(): Promise<ConversationMemory> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.MEMORY);
  
  if (!data) {
    return {
      lastDiscussedTopics: [],
      unresolvedIssues: [],
      acknowledgedInsights: [],
      dismissedSuggestions: [],
    };
  }
  
  return JSON.parse(data);
}

/**
 * Record a discussed topic
 */
export async function recordDiscussedTopic(topic: string): Promise<void> {
  const memory = await getConversationMemory();
  
  memory.lastDiscussedTopics = [
    topic,
    ...memory.lastDiscussedTopics.filter(t => t !== topic),
  ].slice(0, 10); // Keep last 10
  
  await AsyncStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(memory));
}

/**
 * Track unresolved issue
 */
export async function addUnresolvedIssue(issue: string): Promise<void> {
  const memory = await getConversationMemory();
  
  if (!memory.unresolvedIssues.includes(issue)) {
    memory.unresolvedIssues.push(issue);
    await AsyncStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(memory));
  }
}

/**
 * Mark issue as resolved
 */
export async function markIssueResolved(issue: string): Promise<void> {
  const memory = await getConversationMemory();
  memory.unresolvedIssues = memory.unresolvedIssues.filter(i => i !== issue);
  await AsyncStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(memory));
}

/**
 * Record user feedback on insights
 */
export async function recordInsightFeedback(
  insightType: string,
  helpful: boolean,
  reason?: string
): Promise<void> {
  const memory = await getConversationMemory();
  
  if (helpful) {
    memory.acknowledgedInsights.push(insightType);
  } else {
    memory.dismissedSuggestions.push(insightType);
  }
  
  await AsyncStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(memory));
  
  // Also store detailed feedback
  const feedbackKey = `${STORAGE_KEYS.FEEDBACK}:${Date.now()}`;
  await AsyncStorage.setItem(
    feedbackKey,
    JSON.stringify({ insightType, helpful, reason, timestamp: new Date() })
  );
}

/**
 * Get learned patterns
 */
export async function getLearnedPatterns(): Promise<LearnedPatterns | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.PATTERNS);
  return data ? JSON.parse(data) : null;
}

/**
 * Update learned patterns (called after analyzing spending data)
 */
export async function updateLearnedPatterns(patterns: Partial<LearnedPatterns>): Promise<void> {
  const current = await getLearnedPatterns();
  const updated = {
    ...current,
    ...patterns,
    lastUpdated: new Date(),
  };
  
  await AsyncStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(updated));
}

/**
 * Build context string for Gemini based on user memory and preferences
 */
export async function buildConversationContext(): Promise<string> {
  const preferences = await getUserPreferences();
  const memory = await getConversationMemory();
  const patterns = await getLearnedPatterns();
  
  let context = '';
  
  // Add user preferences
  if (preferences.priorityCategories.length > 0) {
    context += `\nUser cares most about: ${preferences.priorityCategories.join(', ')}`;
  }
  
  if (preferences.constraints.length > 0) {
    context += `\nUser constraints: ${preferences.constraints.join(', ')}`;
  }
  
  if (preferences.spendingGoals.length > 0) {
    context += `\nActive goals: ${preferences.spendingGoals.map(g => 
      `${g.category || 'Overall'}: ₹${g.targetAmount} in ${g.timeframe}`
    ).join('; ')}`;
  }
  
  // Add unresolved issues
  if (memory.unresolvedIssues.length > 0) {
    context += `\nUnresolved issues from previous conversations: ${memory.unresolvedIssues.join(', ')}`;
  }
  
  // Add recent context
  if (memory.lastDiscussedTopics.length > 0) {
    context += `\nRecently discussed: ${memory.lastDiscussedTopics.slice(0, 3).join(', ')}`;
  }
  
  // Add learned patterns
  if (patterns) {
    if (patterns.frequentMerchants.length > 0) {
      context += `\nFrequent merchants: ${patterns.frequentMerchants.slice(0, 5).join(', ')}`;
    }
    
    if (patterns.savingsRate !== undefined) {
      context += `\nTypical savings rate: ${Math.round(patterns.savingsRate)}%`;
    }
  }
  
  // Add tone preference
  context += `\nPreferred communication style: ${preferences.preferredTone}`;
  
  return context;
}

/**
 * Extract and learn from user's response
 */
export async function learnFromUserResponse(userMessage: string): Promise<void> {
  const lowerMessage = userMessage.toLowerCase();
  
  // Detect preference changes
  if (lowerMessage.includes('dont want') || lowerMessage.includes("don't want")) {
    // Extract what they don't want
    const prefs = await getUserPreferences();
    // This is simplified - in production, use NLP to extract entities
    if (lowerMessage.includes('food')) {
      prefs.avoidanceTopics.push('food_advice');
      await updateUserPreferences(prefs);
    }
  }
  
  // Detect goals
  if (lowerMessage.includes('want to save') || lowerMessage.includes('goal')) {
    // Extract goal details - simplified version
    const amountMatch = lowerMessage.match(/₹?(\d+,?\d*)/);
    if (amountMatch) {
      const prefs = await getUserPreferences();
      prefs.spendingGoals.push({
        targetAmount: parseInt(amountMatch[1].replace(',', '')),
        timeframe: 'month', // Default
      });
      await updateUserPreferences(prefs);
    }
  }
  
  // Detect constraints
  if (lowerMessage.includes('need') || lowerMessage.includes('must')) {
    if (lowerMessage.includes('taxi') || lowerMessage.includes('safety')) {
      const prefs = await getUserPreferences();
      if (!prefs.constraints.includes('safety_priority')) {
        prefs.constraints.push('safety_priority');
        await updateUserPreferences(prefs);
      }
    }
  }
}

/**
 * Clean up old data (call periodically)
 */
export async function cleanupOldData(): Promise<void> {
  // Remove feedback older than 90 days
  const keys = await AsyncStorage.getAllKeys();
  const feedbackKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.FEEDBACK));
  
  const now = Date.now();
  const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
  
  for (const key of feedbackKeys) {
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const feedback = JSON.parse(data);
      if (new Date(feedback.timestamp).getTime() < ninetyDaysAgo) {
        await AsyncStorage.removeItem(key);
      }
    }
  }
}