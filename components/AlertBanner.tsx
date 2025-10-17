// components/AlertBanner.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { X, AlertCircle, AlertTriangle, Info } from "lucide-react-native";
import { Alert, AlertSeverity } from "@/types/alert";
import { alertStorage } from "@/utils/alertStorage";
import { Colors } from "@/constants/Colors";

interface AlertBannerProps {
  alert: Alert;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number; // milliseconds
}

export default function AlertBanner({
  alert,
  onDismiss,
  autoDismiss = true,
  autoDismissDelay = 5000,
}: AlertBannerProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    if (autoDismiss) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = async () => {
    // Slide out animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Mark as dismissed in storage
      alertStorage.dismissAlert(alert.id);
      onDismiss?.();
    });
  };

  const getIcon = () => {
    const iconSize = 20;
    const iconColor = getSeverityColors().icon;

    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        return <AlertCircle size={iconSize} color={iconColor} />;
      case AlertSeverity.WARNING:
        return <AlertTriangle size={iconSize} color={iconColor} />;
      case AlertSeverity.INFO:
      default:
        return <Info size={iconSize} color={iconColor} />;
    }
  };

  const getSeverityColors = () => {
    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        return Colors.alert.critical;
      case AlertSeverity.WARNING:
        return Colors.alert.warning;
      case AlertSeverity.INFO:
      default:
        return Colors.alert.info;
    }
  };

  const colors = getSeverityColors();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderLeftColor: colors.border,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.iconContainer}>{getIcon()}</View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {alert.title}
        </Text>
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {alert.message}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={18} color={colors.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
  },
});