import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { gamePlayers, games, rounds, scores } from '@/db/schema';
import type { SyncTableName } from './syncPayload';

export async function setCloudId(
  tableName: SyncTableName,
  localId: number,
  cloudId: string,
): Promise<void> {
  switch (tableName) {
    case 'games':
      await db.update(games).set({ cloudId }).where(eq(games.id, localId));
      break;
    case 'game_players':
      await db.update(gamePlayers).set({ cloudId }).where(eq(gamePlayers.id, localId));
      break;
    case 'rounds':
      await db.update(rounds).set({ cloudId }).where(eq(rounds.id, localId));
      break;
    case 'scores':
      await db.update(scores).set({ cloudId }).where(eq(scores.id, localId));
      break;
    default:
      break;
  }
}

export async function setCloudFks(
  tableName: Exclude<SyncTableName, 'games'>,
  localId: number,
  parentCloudIds: Record<string, string>,
): Promise<void> {
  switch (tableName) {
    case 'game_players':
      if (parentCloudIds.cloudGameId) {
        await db
          .update(gamePlayers)
          .set({ cloudGameId: parentCloudIds.cloudGameId })
          .where(eq(gamePlayers.id, localId));
      }
      break;
    case 'rounds':
      if (parentCloudIds.cloudGameId) {
        await db
          .update(rounds)
          .set({ cloudGameId: parentCloudIds.cloudGameId })
          .where(eq(rounds.id, localId));
      }
      break;
    case 'scores': {
      const patch: { cloudRoundId?: string; cloudGamePlayerId?: string } = {};
      if (parentCloudIds.cloudRoundId) patch.cloudRoundId = parentCloudIds.cloudRoundId;
      if (parentCloudIds.cloudGamePlayerId)
        patch.cloudGamePlayerId = parentCloudIds.cloudGamePlayerId;
      if (Object.keys(patch).length > 0) {
        await db.update(scores).set(patch).where(eq(scores.id, localId));
      }
      break;
    }
    default:
      break;
  }
}
