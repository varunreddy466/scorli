import { desc, eq } from 'drizzle-orm';
import { create } from 'zustand';
import { db, initDB } from '@/db/client';
import { gamePlayers, games, gameTypes, rounds, scores } from '@/db/schema';
import type { Game, NewGame, NewGamePlayer } from '@/db/schema';
import { getGameRules } from '@/rules';

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

export const useGameStore = create<GameState>((set, get) => ({
  initialized: false,
  activeGames: [],
  completedGames: [],

  init: async () => {
    await initDB();
    await db
      .insert(gameTypes)
      .values([
        { slug: 'skyjo', name: 'Skyjo', config: { targetScore: 100 } },
        { slug: 'rummy', name: 'Rummy', config: { eliminationThreshold: 200 } },
        { slug: 'custom', name: 'Custom', config: {} },
      ])
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
      .select({ slug: gameTypes.slug, config: gameTypes.config })
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

    const config = (joined.config as Record<string, unknown>) ?? {};
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

    const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
    const allScores = await db
      .select()
      .from(scores)
      .innerJoin(rounds, eq(scores.roundId, rounds.id))
      .where(eq(rounds.gameId, gameId));

    const totals = players.map((player) => ({
      gamePlayerId: player.id,
      displayName: player.displayName,
      total: allScores
        .filter((scoreRow) => scoreRow.scores.gamePlayerId === player.id)
        .reduce((sum, scoreRow) => sum + scoreRow.scores.points, 0),
    }));

    const gameOver = rules.isGameOver(totals, config);
    if (gameOver) {
      await db
        .update(games)
        .set({ status: 'completed', endedAt: now, updatedAt: now })
        .where(eq(games.id, gameId));
    } else {
      await db.update(games).set({ updatedAt: now }).where(eq(games.id, gameId));
    }

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
