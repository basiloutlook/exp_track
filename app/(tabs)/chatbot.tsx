// app/(tabs)/chatbot.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Bot, User, TrendingUp, Sparkles, AlertCircle, CheckCircle, Info } from 'lucide-react-native';
import { getChatbotResponse, Content } from '@/utils/chatbotService';
import { getExpensesFromGoogleSheet } from '@/utils/googleSheets';
import { Expense } from '@/types/expense';
import { chatHistoryService, ChatMessage } from '@/utils/chatHistoryService';
import { useFocusEffect } from '@react-navigation/native';

const QUICK_QUERIES = [
  "What's my spending trend this month?",
  "Which category did I spend most on?",
  "Show my impulse purchases",
  "Compare this week with last week",
  "Any unusual spending patterns?",
];

// Icon mapping for different insight types
const INSIGHT_ICONS: Record<string, any> = {
  alert: AlertCircle,
  trend: TrendingUp,
  positive: CheckCircle,
  behavioral: Sparkles,
  default: Info,
};

// Color mapping for insight severity
const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  high: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '#dc2626' },
  medium: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', icon: '#f59e0b' },
  low: { bg: '#f0f9ff', border: '#93c5fd', text: '#1e40af', icon: '#3b82f6' },
  positive: { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: '#16a34a' },
};

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [apiHistory, setApiHistory] = useState<Content[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load expenses and chat history on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Refresh when screen comes into focus (optimized)
  useFocusEffect(
    useCallback(() => {
      if (!isLoadingHistory && messages.length === 0) {
        loadInitialData(); // First time only
      } else if (!isLoadingHistory) {
        syncNewInsights(); // Just check for new insights
      }
    }, [isLoadingHistory, messages.length])
  );

  const loadInitialData = async () => {
    setIsLoadingHistory(true);
    try {
      // Load expenses
      const expenseData = await getExpensesFromGoogleSheet();
      setExpenses(expenseData);

      // Load chat history (includes user messages, bot responses, AND insights)
      const recentMessages = await chatHistoryService.getChatHistory(PAGE_SIZE, 0);
      setMessages(recentMessages);
      setOffset(PAGE_SIZE);

      
      // Sync new insights from server
      const newInsightsCount = await chatHistoryService.syncInsightsFromServer();
      
      // Reload history if new insights were added
      const updatedHistory = newInsightsCount > 0 
        ? await chatHistoryService.getChatHistory(PAGE_SIZE, 0) 
        : messages;
      
      if (updatedHistory.length === 0) {
        // First time user - add welcome message
        const welcomeMessage: ChatMessage = {
          id: Date.now().toString(),
          text: "Hi! I'm your expense assistant. I'll send you personalized insights about your spending and answer any questions you have. Ask me anything!",
          type: 'bot',
          timestamp: new Date(),
        };
        await chatHistoryService.saveMessage(welcomeMessage);
        setMessages([welcomeMessage]);
      } else {
        setMessages(updatedHistory);
        
        // Show notification if new insights were added
        if (newInsightsCount > 0) {
          console.log(`✨ ${newInsightsCount} new insight(s) added to chat`);
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoadingHistory(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const loadOlderMessages = async () => {
    if (isLoadingHistory || !hasMore) return;
    setIsLoadingHistory(true);

    const older = await chatHistoryService.getChatHistory(PAGE_SIZE, offset);
    if (older.length === 0) {
      setHasMore(false);
    } else {
      setMessages((prev) => [...older, ...prev]); // prepend
      setOffset((prev) => prev + PAGE_SIZE);
    }

    setIsLoadingHistory(false);
  };

  const syncNewInsights = async () => {
    try {
      const newInsightsCount = await chatHistoryService.syncInsightsFromServer();
      if (newInsightsCount > 0) {
        const updatedHistory = await chatHistoryService.getChatHistory();
        setMessages(updatedHistory);
        console.log(`✨ ${newInsightsCount} new insight(s) added to chat`);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error('Error syncing insights:', error);
    }
  };

  const handleSend = async (queryText?: string) => {
    const text = queryText || inputText.trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      type: 'user',
      timestamp: new Date(),
    };

    // Add to UI immediately
    setMessages((prev) => [...prev, userMessage]);
    
    // Save to persistent storage
    await chatHistoryService.saveMessage(userMessage);
    
    setInputText('');
    setIsLoading(true);

    try {
      // --- START OF CHANGES ---

      // 1. Call with `apiHistory`, NOT `expenses`.
      //    The `text` variable already contains the user's query.
      const { newHistory, responseText } = await getChatbotResponse(
        text, 
        apiHistory 
      );

      // 2. Update the API history state for the next conversation turn
      setApiHistory(newHistory);

      // 3. Use `responseText` for the bot's message
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: responseText, // <-- Use responseText
        type: 'bot',
        timestamp: new Date(),
      };

      // --- END OF CHANGES ---

      setMessages((prev) => [...prev, botMessage]);
      await chatHistoryService.saveMessage(botMessage);

    } catch (error) {
      console.error('Chatbot handleSend error:', error); // Log the error
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble analyzing your data right now. Please try again.",
        type: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      await chatHistoryService.saveMessage(errorMessage);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    // User message
    if (message.type === 'user') {
      return (
        <View key={message.id} style={[styles.messageContainer, styles.userMessage]}>
          <View style={styles.messageHeader}>
            <User size={16} color="#ffffff" />
            <Text style={[styles.messageTime, { color: '#dbeafe' }]}>
              {message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""}
            </Text>
          </View>
          <Text style={[styles.messageText, { color: '#ffffff' }]}>{message.text}</Text>
        </View>
      );
    }

    // Bot response
    if (message.type === 'bot') {
      return (
        <View key={message.id} style={[styles.messageContainer, styles.botMessage]}>
          <View style={styles.messageHeader}>
            <Bot size={16} color="#10b981" />
            <Text style={styles.messageTime}>
              {message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""}
            </Text>
          </View>
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      );
    }

    // Auto-generated insight
    if (message.type === 'insight' && message.insightData) {
      const { insightType, severity, title } = message.insightData;
      
      // Safety check: Use default severity if invalid
      const validSeverity = severity && SEVERITY_COLORS[severity] 
        ? severity 
        : 'low';
      
      const severityStyle = SEVERITY_COLORS[validSeverity];
      const IconComponent = INSIGHT_ICONS[insightType || 'default'];

      return (
        <View key={message.id} style={styles.insightContainer}>
          <View style={[styles.insightBadge, { backgroundColor: severityStyle.bg, borderColor: severityStyle.border }]}>
            <View style={styles.insightHeader}>
              <IconComponent size={18} color={severityStyle.icon} />
              <Text style={[styles.insightTitle, { color: severityStyle.text }]}>{title || 'Insight'}</Text>
            </View>
            <Text style={[styles.insightText, { color: severityStyle.text }]}>{message.text}</Text>
            <Text style={[styles.insightTime, { color: severityStyle.text }]}>
              {message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""}
            </Text>
          </View>
        </View>
      );
    }

    return null;
  };

  if (isLoadingHistory) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Bot size={24} color="#10b981" />
          <Text style={styles.title}>Expense Assistant</Text>
          <TrendingUp size={24} color="#6b7280" />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading chat history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Bot size={24} color="#10b981" />
          <Text style={styles.title}>Expense Assistant</Text>
          <TrendingUp size={24} color="#6b7280" />
        </View>

        {/* Quick Query Buttons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickQueryContainer}
          contentContainerStyle={styles.quickQueryContent}
        >
          {QUICK_QUERIES.map((query, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickQueryButton}
              onPress={() => handleSend(query)}
              disabled={isLoading}
            >
              <Text style={styles.quickQueryText}>{query}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Messages */}
<ScrollView
  ref={scrollViewRef}
  style={styles.messagesContainer}
  contentContainerStyle={styles.messagesContent}
  showsVerticalScrollIndicator={false}
  onScroll={({ nativeEvent }) => {
    if (nativeEvent.contentOffset.y <= 0) {
      loadOlderMessages();
    }
  }}
  scrollEventThrottle={100}
>
  {isLoadingHistory && hasMore && (
    <ActivityIndicator size="small" color="#10b981" style={{ marginBottom: 10 }} />
  )}
  {messages.map(renderMessage)}
  {isLoading && (
    <View style={styles.loadingMessageContainer}>
      <ActivityIndicator size="small" color="#10b981" />
      <Text style={styles.loadingMessageText}>Analyzing your data...</Text>
    </View>
  )}
</ScrollView>


        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your expenses..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
          >
            <Send size={20} color={inputText.trim() && !isLoading ? '#ffffff' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  quickQueryContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 60,
  },
  quickQueryContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quickQueryButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  quickQueryText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  messageTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  insightContainer: {
    marginBottom: 12,
    width: '100%',
  },
  insightBadge: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderLeftWidth: 6,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  insightTime: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  loadingMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  loadingMessageText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
});