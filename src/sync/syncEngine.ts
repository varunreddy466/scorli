import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getPendingOperations, removeFromQueue } from './offlineQueue';
import { resolveConflict } from './conflictResolution';
import { setCloudFks, setCloudId } from './cloudMapping';
import { buildDeletePayload, buildPayloadWithCloudId, hasCloudId } from './syncPayload';
import type { SyncStatus } from './types';
import type { SyncTableName } from './syncPayload';

type Listener = (status: SyncStatus) => void;

const listeners = new Set<Listener>();
let currentStatus: SyncStatus = 'idle';

export const UPLOAD_ORDER: SyncTableName[] = ['games', 'game_players', 'rounds', 'scores'];

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

function isSyncTableName(value: string): value is SyncTableName {
  return UPLOAD_ORDER.includes(value as SyncTableName);
}

async function pushPending(): Promise<boolean> {
  const pending = await getPendingOperations();
  const byOrder = [...pending].sort((a, b) => {
    const aIndex = UPLOAD_ORDER.indexOf(a.tableName as SyncTableName);
    const bIndex = UPLOAD_ORDER.indexOf(b.tableName as SyncTableName);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let anyFailed = false;
  for (const op of byOrder) {
    if (!isSyncTableName(op.tableName)) {
      continue;
    }

    try {
      let payload: Record<string, unknown> | null = null;
      if (op.operation === 'insert' || op.operation === 'update') {
        payload = await buildPayloadWithCloudId(op.tableName, op.localId);
      } else {
        payload = await buildDeletePayload(op.tableName, op.localId);
      }
      if (!payload) {
        continue;
      }

      let opError: { message: string } | null = null;
      if (op.operation === 'insert' || op.operation === 'update') {
        const { data, error } = await supabase.from(op.tableName).upsert(payload).select();
        opError = error;
        if (!error && data && data.length > 0) {
          const returned = data[0] as { id: string };
          await setCloudId(op.tableName, op.localId, returned.id);
        }
        if (!opError && !hasCloudId(payload) && data && data.length > 0) {
          // Parent was just assigned its cloud id; ensure child payloads
          // generated later use the new FK mapping.
          await updateChildCloudFks(op.tableName, op.localId, data);
        }
      } else {
        const cloudId = getDeleteCloudId(payload);
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
  return anyFailed;
}

interface RemoteGame {
  id: string;
  game_type_slug: string;
  status: string;
  target_score: number | null;
  config: Record<string, unknown> | null;
  owner_id: string | null;
  created_at: string;
  ended_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

interface RemoteGamePlayer {
  id: string;
  game_id: string;
  profile_id: string | null;
  guest_name: string;
  seat_order: number;
  color: string;
  updated_at: string;
  deleted_at: string | null;
}

interface RemoteRound {
  id: string;
  game_id: string;
  round_number: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface RemoteScore {
  id: string;
  round_id: string;
  game_player_id: string;
  points: number;
  modifiers: Record<string, unknown> | null;
  updated_at: string;
  deleted_at: string | null;
}

async function updateChildCloudFks(
  tableName: SyncTableName,
  localId: number,
  data: unknown[] | null,
): Promise<void> {
  if (!data || data.length === 0) return;
  const returned = data[0] as { id: string };
  if (tableName === 'games') {
    await setCloudFks('game_players', localId, { cloudGameId: returned.id });
    await setCloudFks('rounds', localId, { cloudGameId: returned.id });
  } else if (tableName === 'game_players') {
    await setCloudFks('scores', localId, { cloudGamePlayerId: returned.id });
  } else if (tableName === 'rounds') {
    await setCloudFks('scores', localId, { cloudRoundId: returned.id });
  }
}

async function pullChanges(): Promise<boolean> {
  return false;
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
    const pushFailed = await pushPending();
    const pullFailed = await pullChanges();
    setStatus(pushFailed || pullFailed ? 'error' : 'idle');
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
