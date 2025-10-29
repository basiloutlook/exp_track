// ✅ syncService.ts - FIXED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

type Listener = (...args: any[]) => void;

class TinyEmitter {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, fn: Listener) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }

  off(event: string, fn: Listener) {
    this.listeners[event] = (this.listeners[event] || []).filter(l => l !== fn);
  }

  emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(fn => fn(...args));
  }
}

export const syncEmitter = new TinyEmitter();

const QUEUE_KEY = 'pendingSyncs';
const GOOGLE_SHEET_URL = process.env.EXPO_PUBLIC_GAS_WEB_APP_URL;

// -----------------------------------------------------------------------------
// 1️⃣ Add to local queue (non-blocking)
// -----------------------------------------------------------------------------
export async function enqueueSync(payload: any) {
  try {
    const existing = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
    existing.push(payload);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
    console.log('📥 Queued sync:', payload.action, payload.id);

    // Try to sync immediately (fire and forget)
    processQueue();
  } catch (err) {
    console.warn('❌ Failed to enqueue sync:', err);
  }
}

// -----------------------------------------------------------------------------
// 2️⃣ Process entire queue (sync all pending payloads)
// -----------------------------------------------------------------------------
export async function processQueue() {
  try {
    if (!GOOGLE_SHEET_URL) {
      console.warn('⚠️ GOOGLE_SHEET_URL not configured, skipping sync');
      return;
    }

    const queue = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
    if (queue.length === 0) {
      console.log('✅ Sync queue is empty');
      return;
    }

    console.log(`🔄 Processing ${queue.length} items in sync queue...`);

    // 🔔 Notify listeners that sync started
    syncEmitter.emit('sync:start');

    const remaining: any[] = [];
    let successCount = 0;

    for (const payload of queue) {
      try {
        console.log('📤 Syncing:', payload.action, payload.id);
        console.log('📦 Payload:', JSON.stringify(payload, null, 2));

        const res = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // ✅ Get response text first for debugging
        const responseText = await res.text();
        console.log('📥 Response:', responseText);

        // ✅ Check if response is OK
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${responseText}`);
        }

        // ✅ Parse and validate response
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseErr) {
          throw new Error(`Invalid JSON response: ${responseText}`);
        }
        
        if (!result.success) {
          throw new Error(result.message || 'Unknown error from Google Sheets');
        }

        console.log('✅ Synced successfully:', payload.action, payload.id);
        successCount++;

      } catch (err) {
        console.error('❌ Sync failed for item:', payload.action, payload.id);
        console.error('❌ Error details:', err);
        remaining.push(payload); // keep failed items for retry
      }
    }

    // Update queue with only failed items
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));

    console.log(`✅ Sync complete: ${successCount} succeeded, ${remaining.length} remaining`);

    // 🔔 Notify listeners that sync finished
    syncEmitter.emit('sync:end', { 
      success: remaining.length === 0,
      synced: successCount,
      remaining: remaining.length 
    });

  } catch (err) {
    console.error('❌ Error processing sync queue:', err);
    syncEmitter.emit('sync:end', { success: false, error: err });
  }
}

// -----------------------------------------------------------------------------
// 3️⃣ Initialize periodic + connectivity-based sync
// -----------------------------------------------------------------------------
let syncInterval: ReturnType<typeof setInterval> | null = null;

export async function initAutoSync() {
  console.log('🚀 Initializing auto-sync...');
  
  // Initial sync attempt
  await processQueue();

  // Clear any existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Try again every 5 min
  syncInterval = setInterval(() => {
    console.log('⏰ Periodic sync triggered');
    processQueue();
  }, 5 * 60 * 1000);

  // ✅ For mobile, listen for network reconnect
  if (Platform.OS !== 'web') {
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        console.log('🌐 Network reconnected, syncing...');
        processQueue();
      }
    });
  }
}

// -----------------------------------------------------------------------------
// 4️⃣ Get queue status (for debugging/UI)
// -----------------------------------------------------------------------------
export async function getQueueStatus() {
  try {
    const queue = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
    return {
      count: queue.length,
      items: queue
    };
  } catch (err) {
    console.error('Error getting queue status:', err);
    return { count: 0, items: [] };
  }
}

// -----------------------------------------------------------------------------
// 5️⃣ Utility: clear queue manually (for debugging)
// -----------------------------------------------------------------------------
export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
  console.log('✅ Sync queue cleared');
  syncEmitter.emit('queue:cleared');
}

// -----------------------------------------------------------------------------
// 6️⃣ Force immediate sync (for pull-to-refresh, etc.)
// -----------------------------------------------------------------------------
export async function forceSync() {
  console.log('🔄 Force sync triggered');
  await processQueue();
}