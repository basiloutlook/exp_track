// utils/chatHistoryService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInsightsFromServer, markInsightAsDelivered } from './googleSheets';

export type MessageType = 'user' | 'bot' | 'insight';

export interface InsightData {
  insightType: 'alert' | 'trend' | 'positive' | 'behavioral';
  severity: 'high' | 'medium' | 'low' | 'positive';
  title: string;
  category: string;
  serverId?: string; // ID from Google Sheets
}

export interface ChatMessage {
  id: string;
  text: string;
  type: MessageType;
  timestamp: Date;
  insightData?: InsightData;
}

const CHAT_HISTORY_KEY = '@expense_chat_history';
const LAST_INSIGHT_CHECK_KEY = '@last_insight_check';
const MAX_MESSAGES = 1000; // Keep last 1000 messages

class ChatHistoryService {
  /**
   * Get all chat messages from storage
   */
  async getChatHistory(): Promise<ChatMessage[]> {
    try {
      const historyJson = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
      if (!historyJson) return [];

      const history = JSON.parse(historyJson);
      
      // Convert timestamp strings back to Date objects
      return history.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch (error) {
      console.error('Error loading chat history:', error);
      return [];
    }
  }

  /**
   * Save a single message to history
   */
  async saveMessage(message: ChatMessage): Promise<void> {
    try {
      const history = await this.getChatHistory();
      history.push(message);

      // Trim to max messages
      const trimmedHistory = history.slice(-MAX_MESSAGES);

      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.error('Error saving message:', error);
    }
  }

  /**
   * Save multiple messages at once
   */
  async saveMessages(messages: ChatMessage[]): Promise<void> {
    try {
      const history = await this.getChatHistory();
      const updatedHistory = [...history, ...messages];

      // Trim to max messages
      const trimmedHistory = updatedHistory.slice(-MAX_MESSAGES);

      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  }

  /**
   * Fetch new insights from server and add to chat history
   * Returns number of new insights added
   */
  async syncInsightsFromServer(): Promise<number> {
    try {
      // Get last check timestamp
      const lastCheckStr = await AsyncStorage.getItem(LAST_INSIGHT_CHECK_KEY);
      const lastCheck = lastCheckStr ? new Date(lastCheckStr) : null;

      // Fetch insights from server
      const serverInsights = await getInsightsFromServer(lastCheck);
      
      if (serverInsights.length === 0) {
        console.log('No new insights from server');
        return 0;
      }

      console.log(`Fetched ${serverInsights.length} new insights from server`);

      // Convert server insights to chat messages
      const insightMessages: ChatMessage[] = serverInsights.map((insight: any) => ({
        id: `insight-${insight.id || Date.now()}-${Math.random()}`,
        text: insight.message || insight.description || '',
        type: 'insight' as MessageType,
        timestamp: insight.timestamp ? new Date(insight.timestamp) : new Date(),
        insightData: {
          insightType: insight.type || 'default',
          severity: insight.severity || 'low',
          title: insight.title || 'Insight',
          category: insight.category || 'general',
          serverId: insight.id,
        },
      }));

      // Save to chat history
      await this.saveMessages(insightMessages);

      // Mark insights as delivered on server
      for (const insight of serverInsights) {
        if (insight.id) {
          await markInsightAsDelivered(insight.id);
        }
      }

      // Update last check timestamp
      await AsyncStorage.setItem(LAST_INSIGHT_CHECK_KEY, new Date().toISOString());

      return insightMessages.length;
    } catch (error) {
      console.error('Error syncing insights:', error);
      return 0;
    }
  }

  /**
   * Clear all chat history (use with caution)
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
      await AsyncStorage.removeItem(LAST_INSIGHT_CHECK_KEY);
      console.log('Chat history cleared');
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }

  /**
   * Delete messages older than X days
   */
  async deleteOldMessages(daysToKeep: number = 30): Promise<void> {
    try {
      const history = await this.getChatHistory();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const filteredHistory = history.filter(msg => msg.timestamp >= cutoffDate);

      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(filteredHistory));
      console.log(`Deleted messages older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Error deleting old messages:', error);
    }
  }

  /**
   * Get chat statistics
   */
  async getChatStats(): Promise<{
    totalMessages: number;
    userMessages: number;
    botMessages: number;
    insights: number;
    oldestMessage: Date | null;
    newestMessage: Date | null;
  }> {
    try {
      const history = await this.getChatHistory();
      
      return {
        totalMessages: history.length,
        userMessages: history.filter(m => m.type === 'user').length,
        botMessages: history.filter(m => m.type === 'bot').length,
        insights: history.filter(m => m.type === 'insight').length,
        oldestMessage: history.length > 0 ? history[0].timestamp : null,
        newestMessage: history.length > 0 ? history[history.length - 1].timestamp : null,
      };
    } catch (error) {
      console.error('Error getting chat stats:', error);
      return {
        totalMessages: 0,
        userMessages: 0,
        botMessages: 0,
        insights: 0,
        oldestMessage: null,
        newestMessage: null,
      };
    }
  }

  /**
   * Export chat history as JSON (for backup/debugging)
   */
  async exportHistory(): Promise<string> {
    try {
      const history = await this.getChatHistory();
      return JSON.stringify(history, null, 2);
    } catch (error) {
      console.error('Error exporting history:', error);
      return '[]';
    }
  }

  /**
   * Import chat history from JSON
   */
  async importHistory(jsonString: string): Promise<boolean> {
    try {
      const imported = JSON.parse(jsonString);
      
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format');
      }

      // Validate structure
      const validated = imported.map((msg: any) => ({
        id: msg.id || Date.now().toString(),
        text: msg.text || '',
        type: msg.type || 'bot',
        timestamp: new Date(msg.timestamp || Date.now()),
        insightData: msg.insightData || undefined,
      }));

      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(validated));
      console.log('History imported successfully');
      return true;
    } catch (error) {
      console.error('Error importing history:', error);
      return false;
    }
  }
}

export const chatHistoryService = new ChatHistoryService();