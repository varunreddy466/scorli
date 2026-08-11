import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getPendingOperations, removeFromQueue } from './offlineQueue';
import type { SyncStatus } from './types';

type Listener = (status: SyncStatus) => void;

const listeners = new Set<Listener>();
let currentStatus: SyncStatus = 'idle';

function getDeleteCloudId(payload: Record<string, unknown> | null): string | null {
  const cloudId = payload?.cloudId;
  return typeof cloudId === 'string' && cloudId.length > 0 ? cloudId : null;
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function subscribeSyncStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function setStatus(status: SyncStatus) {
  currentStatus = status;
  listeners.forEach((listener) => {
    listener(status);
  });
}

export async function runSync(): Promise<void> {
  const { session } = useAuthStore.getState();
  if (!session) {
    setStatus('idle');
    return;
  }

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    setStatus('offline');
    return;
  }

  setStatus('syncing');
  try {
    const pending = await getPendingOperations();
    let anyFailed = false;
    for (const op of pending) {
      try {
        let opError: { message: string } | null = null;
        if (op.operation === 'insert' || op.operation === 'update') {
          const { error } = await supabase.from(op.tableName).upsert(op.payload ?? {});
          opError = error;
        } else {
          const cloudId = getDeleteCloudId(op.payload);
          if (!cloudId) {
            continue;
          }
          const { error } = await supabase
            .from(op.tableName)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', cloudId);
          opError = error;
        }
        if (opError) {
          anyFailed = true;
        } else {
          await removeFromQueue(op.id);
        }
      } catch {
        // Leave failed entries queued for a future retry.
        anyFailed = true;
      }
    }
    setStatus(anyFailed ? 'error' : 'idle');
  } catch {
    setStatus('error');
  }
}

export function initSync() {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void runSync();
      return;
    }
    setStatus('offline');
  });
}
