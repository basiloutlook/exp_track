// 📄 src/hooks/useSyncStatus.ts
import { useEffect, useState } from 'react';
import { syncEmitter } from '@/utils/syncService';

/**
 * Custom hook that listens to sync status events from syncService.
 * You can use this to show a toast, spinner, or any UI indicator.
 */
export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const onStart = () => setSyncStatus('syncing');
    const onSuccess = () => setSyncStatus('success');
    const onError = () => setSyncStatus('error');

    syncEmitter.on('sync:start', onStart);
    syncEmitter.on('sync:success', onSuccess);
    syncEmitter.on('sync:error', onError);

    return () => {
      syncEmitter.off('sync:start', onStart);
      syncEmitter.off('sync:success', onSuccess);
      syncEmitter.off('sync:error', onError);
    };
  }, []);

  return { syncStatus };
}
