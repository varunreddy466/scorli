import { desc, eq } from 'drizzle-orm';
import { create } from 'zustand';
import { db, initDB } from '@/db/client';
import { gamePlayers, games, gameTypes, rounds, scores } from '@/db/schema';
import type { Game, GameType, NewGame, NewGamePlayer } from '@/db/schema';
import { getAllGameTypes, getGameRules } from '@/rules';

/**
 * Merges a game-type's default config with a per-game targetScore override.
 * Use this consistently wherever config is passed to rules functions.
 */
export function resolveGameConfig(
  gameType: Pick<GameType, 'config'>,
  game: { targetScore?: number | null },
): Record<string, unknown> {
  const base = (gameType.config as Record<string, unknown>) ?? {};
  return game.targetScore != null ? { ...base, targetScore: game.targetScore } : base;
}

interface GameState {
  initialized: boolean;
  activeGames: Game[];
  completedGames: Game[];
  init: () => Promise<void>;
  createGame: (params: {
    gameTypeSlug: string;
    targetScore?: number;
    players: { displayName: string; color: string }[];
  }) => Promise<number>;
  addRound: (params: {
    gameId: number;
    scores: Record<number, number>;
    closerId?: number;
  }) => Promise<void>;
  deleteLastRound: (gameId: number) => Promise<void>;
  updateScore: (scoreId: number, points: number) => Promise<void>;
  finishGame: (gameId: number) => Promise<void>;
  loadGames: () => Promise<void>;
}

/** Recompute totals for all players in a game and mark completed if rules say so. */
async function recomputeAndSettle(gameId: number): Promise<void> {
  const [joined] = await db
    .select({
      slug: gameTypes.slug,
      config: gameTypes.config,
      targetScore: games.targetScore,
    })
    .from(games)
    .innerJoin(gameTypes, eq(games.gameTypeId, gameTypes.id))
    .where(eq(games.id, gameId));

  if (!joined) return;

  const rules = getGameRules(joined.slug);
  const config = resolveGameConfig(joined, joined);

  const playerRows = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
  const allScores = await db
    .select()
    .from(scores)
    .innerJoin(rounds, eq(scores.roundId, rounds.id))
    .where(eq(rounds.gameId, gameId));

  const totals = playerRows.map((player) => ({
    gamePlayerId: player.id,
    displayName: player.displayName,
    total: allScores
      .filter((s) => s.scores.gamePlayerId === player.id)
      .reduce((sum, s) => sum + s.scores.points, 0),
  }));

  const now = new Date();
  if (rules.isGameOver(totals, config)) {
    await db
      .update(games)
      .set({ status: 'completed', endedAt: now, updatedAt: now })
      .where(eq(games.id, gameId));
  } else {
    await db.update(games).set({ updatedAt: now }).where(eq(games.id, gameId));
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  initialized: false,
  activeGames: [],
  completedGames: [],

  init: async () => {
    await initDB();
    const allRules = getAllGameTypes();
    await db
      .insert(gameTypes)
      .values(
        allRules.map((rule) => ({
          slug: rule.slug,
          name: rule.name,
          config:
            rule.defaultConfig !== undefined
              ? rule.defaultConfig
              : { targetScore: rule.defaultTargetScore, winCondition: rule.winCondition },
        })),
      )
      .onConflictDoNothing();
    await get().loadGames();
    set({ initialized: true });
  },

  loadGames: async () => {
    const all = await db.select().from(games).orderBy(desc(games.createdAt));
    const visibleGames = all.filter((game) => game.deletedAt == null);

    set({
      activeGames: visibleGames.filter((game) => game.status === 'in_progress'),
      completedGames: visibleGames.filter((game) => game.status === 'completed'),
    });
  },

  createGame: async ({ gameTypeSlug, targetScore, players }) => {
    const [gt] = await db.select().from(gameTypes).where(eq(gameTypes.slug, gameTypeSlug));
    if (!gt) {
      throw new Error(`Unknown game type: ${gameTypeSlug}`);
    }

    const now = new Date();
    const [game] = await db
      .insert(games)
      .values({
        gameTypeId: gt.id,
        targetScore,
        createdAt: now,
        updatedAt: now,
        status: 'in_progress',
      } satisfies NewGame)
      .returning();

    await db.insert(gamePlayers).values(
      players.map(
        (player, index) =>
          ({
            gameId: game.id,
            displayName: player.displayName,
            seatOrder: index,
            color: player.color,
            updatedAt: now,
          }) satisfies NewGamePlayer,
      ),
    );

    await get().loadGames();
    return game.id;
  },

  addRound: async ({ gameId, scores: scoreMap, closerId }) => {
    const [joined] = await db
      .select({ slug: gameTypes.slug, config: gameTypes.config, targetScore: games.targetScore })
      .from(games)
      .innerJoin(gameTypes, eq(games.gameTypeId, gameTypes.id))
      .where(eq(games.id, gameId));

    if (!joined) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const rules = getGameRules(joined.slug);
    const existing = await db.select().from(rounds).where(eq(rounds.gameId, gameId));
    const now = new Date();

    const [round] = await db
      .insert(rounds)
      .values({
        gameId,
        roundNumber: existing.length + 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const config = resolveGameConfig(joined, joined);
    const result = rules.scoreRound({
      scores: scoreMap,
      closerId,
      config,
    });

    const scoreRows = Object.entries(result.points).map(([playerId, points]) => ({
      roundId: round.id,
      gamePlayerId: Number(playerId),
      points,
      modifiers: result.modifiers[Number(playerId)] ?? null,
      updatedAt: now,
    }));
    await db.insert(scores).values(scoreRows);

    await recomputeAndSettle(gameId);
    await get().loadGames();
  },

  deleteLastRound: async (gameId) => {
    const allRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.gameId, gameId))
      .orderBy(desc(rounds.roundNumber));

    if (allRounds.length === 0) {
      return;
    }

    const lastRound = allRounds[0];
    await db.delete(scores).where(eq(scores.roundId, lastRound.id));
    await db.delete(rounds).where(eq(rounds.id, lastRound.id));
    await db.update(games).set({ updatedAt: new Date() }).where(eq(games.id, gameId));
    await get().loadGames();
  },

  updateScore: async (scoreId, points) => {
    await db.update(scores).set({ points, updatedAt: new Date() }).where(eq(scores.id, scoreId));

    const [scoreRow] = await db
      .select({ gameId: rounds.gameId })
      .from(scores)
      .innerJoin(rounds, eq(scores.roundId, rounds.id))
      .where(eq(scores.id, scoreId));

    if (scoreRow) {
      await recomputeAndSettle(scoreRow.gameId);
    }

    await get().loadGames();
  },

  finishGame: async (gameId) => {
    const now = new Date();
    await db
      .update(games)
      .set({ status: 'completed', endedAt: now, updatedAt: now })
      .where(eq(games.id, gameId));
    await get().loadGames();
  },
}));
