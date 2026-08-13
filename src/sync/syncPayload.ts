import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { gamePlayers, gameTypes, games, rounds, scores } from '@/db/schema';
import type { Game, GamePlayer, Round, Score } from '@/db/schema';

export type SyncTableName = 'games' | 'game_players' | 'rounds' | 'scores';

export interface SyncPayload {
  tableName: SyncTableName;
  localId: number;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown> | null;
}

export async function buildPayload(
  tableName: SyncTableName,
  localId: number,
): Promise<Record<string, unknown> | null> {
  switch (tableName) {
    case 'games':
      return buildGamePayload(localId);
    case 'game_players':
      return buildGamePlayerPayload(localId);
    case 'rounds':
      return buildRoundPayload(localId);
    case 'scores':
      return buildScorePayload(localId);
    default:
      return null;
  }
}

export async function buildPayloadWithCloudId(
  tableName: SyncTableName,
  localId: number,
): Promise<Record<string, unknown> | null> {
  const payload = await buildPayload(tableName, localId);
  if (!payload) return null;
  if (payload.id === null || payload.id === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete payload.id;
  }
  return payload;
}

export function hasCloudId(payload: Record<string, unknown> | null): boolean {
  return typeof payload?.id === 'string' && payload.id.length > 0;
}

export async function buildDeletePayload(
  tableName: SyncTableName,
  localId: number,
): Promise<Record<string, unknown> | null> {
  const payload = await buildPayload(tableName, localId);
  if (!payload) return null;
  return payload;
}

async function buildGamePayload(localId: number): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(games).where(eq(games.id, localId));
  if (!row) return null;
  const slug = await getGameTypeSlug(row.gameTypeId);
  return {
    id: row.cloudId,
    game_type_slug: slug,
    status: row.status,
    target_score: row.targetScore,
    created_at: toIso(row.createdAt),
    ended_at: toIso(row.endedAt),
    updated_at: toIso(row.updatedAt),
    deleted_at: toIso(row.deletedAt),
  };
}

async function buildGamePlayerPayload(localId: number): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(gamePlayers).where(eq(gamePlayers.id, localId));
  if (!row) return null;
  return {
    id: row.cloudId,
    game_id: row.cloudGameId,
    profile_id: row.profileId,
    guest_name: row.displayName,
    seat_order: row.seatOrder,
    color: row.color,
    updated_at: toIso(row.updatedAt),
    deleted_at: toIso(row.deletedAt),
  };
}

async function buildRoundPayload(localId: number): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(rounds).where(eq(rounds.id, localId));
  if (!row) return null;
  return {
    id: row.cloudId,
    game_id: row.cloudGameId,
    round_number: row.roundNumber,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
    deleted_at: toIso(row.deletedAt),
  };
}

async function buildScorePayload(localId: number): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(scores).where(eq(scores.id, localId));
  if (!row) return null;
  return {
    id: row.cloudId,
    round_id: row.cloudRoundId,
    game_player_id: row.cloudGamePlayerId,
    points: row.points,
    modifiers: row.modifiers,
    updated_at: toIso(row.updatedAt),
    deleted_at: toIso(row.deletedAt),
  };
}

async function getGameTypeSlug(gameTypeId: number): Promise<string | undefined> {
  const [row] = await db
    .select({ slug: gameTypes.slug })
    .from(gameTypes)
    .where(eq(gameTypes.id, gameTypeId));
  return row?.slug;
}

function toIso(value: Date | number | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function getCloudId(row: Game | GamePlayer | Round | Score): string | null {
  return row.cloudId ?? null;
}
