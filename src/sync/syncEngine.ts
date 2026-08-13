import NetInfo from '@react-native-community/netinfo';
import { eq } from 'drizzle-orm';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/db/client';
import { gamePlayers, games, gameTypes, rounds, scores } from '@/db/schema';
import type { Game, GamePlayer, Round, Score } from '@/db/schema';
import { getPendingOperations, removeFromQueue } from './offlineQueue';
import { resolveConflict } from './conflictResolution';
import { setCloudFks, setCloudId } from './cloudMapping';
import { buildDeletePayload, buildPayloadWithCloudId, hasCloudId } from './syncPayload';
import { getLastSyncAt, setLastSyncAt } from './syncMeta';
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

async function findLocalByCloudId(
  tableName: SyncTableName,
  cloudId: string,
): Promise<number | null> {
  let rows: { id: number }[] = [];
  switch (tableName) {
    case 'games':
      rows = await db.select({ id: games.id }).from(games).where(eq(games.cloudId, cloudId));
      break;
    case 'game_players':
      rows = await db
        .select({ id: gamePlayers.id })
        .from(gamePlayers)
        .where(eq(gamePlayers.cloudId, cloudId));
      break;
    case 'rounds':
      rows = await db.select({ id: rounds.id }).from(rounds).where(eq(rounds.cloudId, cloudId));
      break;
    case 'scores':
      rows = await db.select({ id: scores.id }).from(scores).where(eq(scores.cloudId, cloudId));
      break;
    default:
      break;
  }
  return rows[0]?.id ?? null;
}

async function applyRemoteGame(remote: RemoteGame): Promise<void> {
  const localId = await findLocalByCloudId('games', remote.id);
  if (localId != null) {
    const [local] = await db.select().from(games).where(eq(games.id, localId));
    const winner = resolveConflict(
      { updatedAt: local.updatedAt },
      { updatedAt: remote.updated_at },
    );
    if (winner === 'local') return;
  }

  if (remote.deleted_at) {
    if (localId != null) {
      await db
        .update(games)
        .set({ deletedAt: new Date(remote.deleted_at), updatedAt: new Date(remote.updated_at) })
        .where(eq(games.id, localId));
    }
    return;
  }

  const [gameType] = await db
    .select({ id: gameTypes.id })
    .from(gameTypes)
    .where(eq(gameTypes.slug, remote.game_type_slug));
  if (!gameType) return;

  const patch: Partial<Game> = {
    gameTypeId: gameType.id,
    status: remote.status as Game['status'],
    targetScore: remote.target_score ?? undefined,
    cloudId: remote.id,
    updatedAt: new Date(remote.updated_at),
  };
  if (remote.created_at) patch.createdAt = new Date(remote.created_at);
  if (remote.ended_at) patch.endedAt = new Date(remote.ended_at);

  if (localId != null) {
    await db.update(games).set(patch).where(eq(games.id, localId));
  } else {
    const insertPatch = patch as Omit<typeof patch, 'id'> & {
      gameTypeId: number;
      status: Game['status'];
      createdAt: Date;
      updatedAt: Date;
    };
    await db.insert(games).values({
      gameTypeId: insertPatch.gameTypeId,
      status: insertPatch.status,
      targetScore: insertPatch.targetScore,
      createdAt: insertPatch.createdAt ?? new Date(),
      updatedAt: insertPatch.updatedAt,
      cloudId: insertPatch.cloudId,
    });
  }
}

async function applyRemoteGamePlayer(remote: RemoteGamePlayer): Promise<void> {
  const gameId = await findLocalByCloudId('games', remote.game_id);
  if (gameId == null) return;

  const localId = await findLocalByCloudId('game_players', remote.id);
  if (localId != null) {
    const [local] = await db.select().from(gamePlayers).where(eq(gamePlayers.id, localId));
    const winner = resolveConflict(
      { updatedAt: local.updatedAt },
      { updatedAt: remote.updated_at },
    );
    if (winner === 'local') return;
  }

  if (remote.deleted_at) {
    if (localId != null) {
      await db
        .update(gamePlayers)
        .set({
          deletedAt: new Date(remote.deleted_at),
          updatedAt: new Date(remote.updated_at),
        })
        .where(eq(gamePlayers.id, localId));
    }
    return;
  }

  const patch: Partial<GamePlayer> = {
    gameId,
    profileId: remote.profile_id ?? undefined,
    displayName: remote.guest_name,
    seatOrder: remote.seat_order,
    color: remote.color,
    cloudId: remote.id,
    cloudGameId: remote.game_id,
    updatedAt: new Date(remote.updated_at),
  };

  if (localId != null) {
    await db.update(gamePlayers).set(patch).where(eq(gamePlayers.id, localId));
  } else {
    const insertPatch = patch as Omit<typeof patch, 'id'> & {
      gameId: number;
      displayName: string;
      seatOrder: number;
      color: string;
      updatedAt: Date;
    };
    await db.insert(gamePlayers).values({
      gameId: insertPatch.gameId,
      profileId: insertPatch.profileId,
      displayName: insertPatch.displayName,
      seatOrder: insertPatch.seatOrder,
      color: insertPatch.color,
      updatedAt: insertPatch.updatedAt,
      cloudId: insertPatch.cloudId,
      cloudGameId: insertPatch.cloudGameId,
    });
  }
}

async function applyRemoteRound(remote: RemoteRound): Promise<void> {
  const gameId = await findLocalByCloudId('games', remote.game_id);
  if (gameId == null) return;

  const localId = await findLocalByCloudId('rounds', remote.id);
  if (localId != null) {
    const [local] = await db.select().from(rounds).where(eq(rounds.id, localId));
    const winner = resolveConflict(
      { updatedAt: local.updatedAt },
      { updatedAt: remote.updated_at },
    );
    if (winner === 'local') return;
  }

  if (remote.deleted_at) {
    if (localId != null) {
      await db
        .update(rounds)
        .set({ deletedAt: new Date(remote.deleted_at), updatedAt: new Date(remote.updated_at) })
        .where(eq(rounds.id, localId));
    }
    return;
  }

  const patch: Partial<Round> = {
    gameId,
    roundNumber: remote.round_number,
    cloudId: remote.id,
    cloudGameId: remote.game_id,
    createdAt: new Date(remote.created_at),
    updatedAt: new Date(remote.updated_at),
  };

  if (localId != null) {
    await db.update(rounds).set(patch).where(eq(rounds.id, localId));
  } else {
    const insertPatch = patch as Omit<typeof patch, 'id'> & {
      gameId: number;
      roundNumber: number;
      createdAt: Date;
      updatedAt: Date;
    };
    await db.insert(rounds).values({
      gameId: insertPatch.gameId,
      roundNumber: insertPatch.roundNumber,
      createdAt: insertPatch.createdAt ?? new Date(),
      updatedAt: insertPatch.updatedAt,
      cloudId: insertPatch.cloudId,
      cloudGameId: insertPatch.cloudGameId,
    });
  }
}

async function applyRemoteScore(remote: RemoteScore): Promise<void> {
  const roundId = await findLocalByCloudId('rounds', remote.round_id);
  const gamePlayerId = await findLocalByCloudId('game_players', remote.game_player_id);
  if (roundId == null || gamePlayerId == null) return;

  const localId = await findLocalByCloudId('scores', remote.id);
  if (localId != null) {
    const [local] = await db.select().from(scores).where(eq(scores.id, localId));
    const winner = resolveConflict(
      { updatedAt: local.updatedAt },
      { updatedAt: remote.updated_at },
    );
    if (winner === 'local') return;
  }

  if (remote.deleted_at) {
    if (localId != null) {
      await db
        .update(scores)
        .set({ deletedAt: new Date(remote.deleted_at), updatedAt: new Date(remote.updated_at) })
        .where(eq(scores.id, localId));
    }
    return;
  }

  const patch: Partial<Score> = {
    roundId,
    gamePlayerId,
    points: remote.points,
    modifiers: remote.modifiers ?? undefined,
    cloudId: remote.id,
    cloudRoundId: remote.round_id,
    cloudGamePlayerId: remote.game_player_id,
    updatedAt: new Date(remote.updated_at),
  };

  if (localId != null) {
    await db.update(scores).set(patch).where(eq(scores.id, localId));
  } else {
    const insertPatch = patch as Omit<typeof patch, 'id'> & {
      roundId: number;
      gamePlayerId: number;
      points: number;
      updatedAt: Date;
    };
    await db.insert(scores).values({
      roundId: insertPatch.roundId,
      gamePlayerId: insertPatch.gamePlayerId,
      points: insertPatch.points,
      modifiers: insertPatch.modifiers,
      updatedAt: insertPatch.updatedAt,
      cloudId: insertPatch.cloudId,
      cloudRoundId: insertPatch.cloudRoundId,
      cloudGamePlayerId: insertPatch.cloudGamePlayerId,
    });
  }
}

interface PullResponse {
  games: RemoteGame[];
  game_players: RemoteGamePlayer[];
  rounds: RemoteRound[];
  scores: RemoteScore[];
}

async function pullChanges(): Promise<boolean> {
  const lastSyncAt = await getLastSyncAt();
  const { data, error } = (await supabase.rpc('pull_changes', {
    last_sync_at: lastSyncAt,
  })) as { data: PullResponse | null; error: { message: string } | null };
  if (error) return true;
  if (!data) return false;

  try {
    for (const remote of data.games) {
      await applyRemoteGame(remote);
    }
    for (const remote of data.game_players) {
      await applyRemoteGamePlayer(remote);
    }
    for (const remote of data.rounds) {
      await applyRemoteRound(remote);
    }
    for (const remote of data.scores) {
      await applyRemoteScore(remote);
    }
    await setLastSyncAt(new Date().toISOString());
    return false;
  } catch {
    return true;
  }
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
