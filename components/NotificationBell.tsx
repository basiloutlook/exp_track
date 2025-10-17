// components/NotificationBell.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from "react-native";
import { Bell, Settings, Trash2 } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@notification_history";
const MAX_NOTIFICATIONS = 10;

interface NotificationItem {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationBellProps {
  size?: number;
  onRefresh?: () => void; // Callback to trigger refresh from parent
}

export default function NotificationBell({ size = 24, onRefresh }: NotificationBellProps) {
  const router = useRouter();
  const [showPopup, setShowPopup] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const { width } = Dimensions.get("window");

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const count = notifications.filter((n) => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showPopup ? 0 : -150,
      duration: 300,
      easing: showPopup ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showPopup]);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const saveNotifications = async (notifs: NotificationItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
    } catch (error) {
      console.error("Error saving notifications:", error);
    }
  };

  const markAllAsRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const clearNotification = async (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
    setShowPopup(false);
  };

  const handlePress = () => {
    setShowPopup((prev) => !prev);
    if (!showPopup && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const openSettings = () => {
    setShowPopup(false);
    router.push("/settings");
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatFullDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Expose refresh method
  useEffect(() => {
    if (onRefresh) {
      const interval = setInterval(() => {
        loadNotifications();
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [onRefresh]);

  return (
    <View style={{ position: "relative" }}>
      <TouchableOpacity onPress={handlePress} style={styles.container} activeOpacity={0.7}>
        <Bell size={size} color={Colors.text.primary} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {showPopup && (
        <Animated.View
          style={[
            styles.popupContainer,
            {
              transform: [{ translateY: slideAnim }],
              width: Math.min(width - 40, 320),
            },
          ]}
        >
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>Notifications</Text>
            <View style={styles.headerActions}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAllNotifications} style={styles.clearButton}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={openSettings} style={styles.settingsButton}>
                <Settings size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Bell size={32} color="#d1d5db" />
              <Text style={styles.emptyText}>No notifications</Text>
              <Text style={styles.emptySubtext}>You're all caught up!</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.notificationsList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {notifications.map((notif, index) => (
                <View
                  key={notif.id}
                  style={[
                    styles.notificationItem,
                    !notif.read && styles.unreadNotification,
                    index === notifications.length - 1 && styles.lastNotification,
                  ]}
                >
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationText}>{notif.message}</Text>
                    <Text style={styles.notificationDate}>
                      {formatDate(notif.timestamp)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => clearNotification(notif.id)}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={14} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {notifications.length > 0 && (
            <View style={styles.popupFooter}>
              <Text style={styles.footerText}>
                {notifications.length}/{MAX_NOTIFICATIONS} notifications
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    padding: 8,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: Colors.badge.bg,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.badge.text,
    fontSize: 10,
    fontWeight: "700",
  },
  popupContainer: {
    position: "absolute",
    top: 40,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
    maxHeight: 500,
  },
  popupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    padding: 12,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clearButton: {
    padding: 4,
  },
  settingsButton: {
    padding: 4,
  },
  notificationsList: {
    maxHeight: 400,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 8,
  },
  lastNotification: {
    borderBottomWidth: 0,
  },
  unreadNotification: {
    backgroundColor: "#f0f9ff",
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationDate: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
  },
  popupFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    padding: 8,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
});