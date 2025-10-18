import React, { useEffect, useState, useRef } from 'react';
import { Animated, Text, View, StyleSheet, Dimensions } from 'react-native';
import { useSyncStatus } from '../hooks/useSyncStatus';

const { width } = Dimensions.get('window');

export default function SyncToast() {
  const { syncStatus } = useSyncStatus();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (syncStatus) {
      setMessage('🔄 Syncing changes...');
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else if (visible) {
      setMessage('✅ All changes synced');
      // Show the success briefly before hiding
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
      });
    }
  }, [syncStatus]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.toast}>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    width: width,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
