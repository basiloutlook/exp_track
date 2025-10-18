// ✅ syncService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo'; // install this

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
const GOOGLE_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwXdK1Bh9DrFsOKdMlOpQZEWTQ7AONBhtuneRXY-S8ooD8Uem44eLObwgRl2loLaYMk/exec'; // 🔁 Replace with your deployed Apps Script URL

// -----------------------------------------------------------------------------
// 1️⃣ Add to local queue (non-blocking)
// -----------------------------------------------------------------------------
export async function enqueueSync(payload: any) {
  try {
    const existing = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
    existing.push(payload);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));

    // Try to sync immediately (fire and forget)
    processQueue();
  } catch (err) {
    console.warn('Failed to enqueue sync:', err);
  }
}

// -----------------------------------------------------------------------------
// 2️⃣ Process entire queue (sync all pending payloads)
// -----------------------------------------------------------------------------
export async function processQueue() {
  try {
    const queue = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
    if (queue.length === 0) return;

    // 🔔 Notify listeners that sync started
    syncEmitter.emit('sync:start');

    const remaining: any[] = [];

    for (const payload of queue) {
      try {
        const res = await fetch(GOOGLE_SHEET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.warn('Sync failed for item:', err);
        remaining.push(payload); // keep failed items
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));

    // 🔔 Notify listeners that sync finished
    syncEmitter.emit('sync:end', { success: remaining.length === 0 });
  } catch (err) {
    console.error('Error processing sync queue:', err);
    syncEmitter.emit('sync:end', { success: false });
  }
}

// -----------------------------------------------------------------------------
// 3️⃣ Initialize periodic + connectivity-based sync
// -----------------------------------------------------------------------------
export async function initAutoSync() {
  await processQueue();

  // try again every 5 min
  setInterval(processQueue, 5 * 60 * 1000);

  // ✅ For mobile, listen for network reconnect
  if (Platform.OS !== 'web') {
    NetInfo.addEventListener(state => {
      if (state.isConnected) processQueue();
    });
  }
}

// -----------------------------------------------------------------------------
// 4️⃣ Utility (optional): clear queue manually (for debugging)
// -----------------------------------------------------------------------------
export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
  console.log('✅ Sync queue cleared');
}
