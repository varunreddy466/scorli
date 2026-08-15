/**
 * Regression test: scores.points must survive as a fractional value (IEEE 754
 * double) through buildPayloadWithCloudId, matching the local REAL column type
 * and the Supabase `double precision` column introduced by the gap #1 fix.
 */

/* eslint-disable import/first */

// ─── In-memory tables (must be declared before jest.mock factories) ───────────
type MockRow = Record<string, unknown>;

const mockDb: Record<string, MockRow[]> = {
  game_types: [],
  games: [],
  game_players: [],
  rounds: [],
  scores: [],
};

function mockNextId(table: string): number {
  const rows = mockDb[table];
  return rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.id as number)) + 1;
}

function mockInsert<T extends MockRow>(table: string, row: Omit<T, 'id'>): T {
  const r = { id: mockNextId(table), ...row } as T;
  mockDb[table].push(r);
  return r;
}

// ─── Mock helpers (must be prefixed with "mock" for Babel scope check) ────────
function mockMakeProxy(tableName: string) {
  return new Proxy(
    { __tableName: tableName },
    {
      get(target, prop) {
        if (prop === '__tableName') return target.__tableName;
        return { __col: String(prop), __table: tableName };
      },
    },
  );
}

function mockMakeEq(col: unknown, val: unknown) {
  return (row: MockRow) => {
    const c = col as { __col: string };
    return row[c.__col] === val;
  };
}

function mockMakeSelect(schema: { __tableName: string }) {
  const tableName = schema.__tableName;
  let predicate: (r: MockRow) => boolean = () => true;

  const api = {
    from(_s: unknown) {
      return api;
    },
    where(pred: (r: MockRow) => boolean) {
      predicate = pred;
      return api;
    },
    then(resolve: (rows: MockRow[]) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve(mockDb[tableName].filter(predicate)).then(resolve, reject);
    },
  };
  return api;
}

// ─── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('@/db/client', () => ({
  db: {
    select: jest.fn(() => ({
      from: (schema: { __tableName: string }) => mockMakeSelect(schema),
    })),
  },
  initDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/schema', () => ({
  games: mockMakeProxy('games'),
  gamePlayers: mockMakeProxy('game_players'),
  rounds: mockMakeProxy('rounds'),
  scores: mockMakeProxy('scores'),
  gameTypes: mockMakeProxy('game_types'),
}));

jest.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => mockMakeEq(col, val),
}));

import { buildPayloadWithCloudId } from '@/sync/syncPayload';

// ─── Tests ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  mockDb.game_types = [];
  mockDb.games = [];
  mockDb.game_players = [];
  mockDb.rounds = [];
  mockDb.scores = [];
});

describe('syncPayload – fractional scores.points', () => {
  it('preserves 12.5 points through buildPayloadWithCloudId', async () => {
    const gameType = mockInsert('game_types', { slug: 'custom', label: 'Custom', config: '{}' });

    const game = mockInsert('games', {
      gameTypeId: gameType.id,
      status: 'active',
      cloudId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const gamePlayer = mockInsert('game_players', {
      gameId: game.id,
      displayName: 'Alice',
      seatOrder: 0,
      color: '#FF0000',
      cloudId: null,
      cloudGameId: null,
      updatedAt: new Date().toISOString(),
    });

    const round = mockInsert('rounds', {
      gameId: game.id,
      roundNumber: 1,
      cloudId: null,
      cloudGameId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const score = mockInsert('scores', {
      roundId: round.id,
      gamePlayerId: gamePlayer.id,
      points: 12.5,
      modifiers: null,
      cloudId: null,
      cloudRoundId: null,
      cloudGamePlayerId: null,
      updatedAt: new Date().toISOString(),
    });

    const payload = await buildPayloadWithCloudId('scores', score.id as number);

    expect(payload).not.toBeNull();
    expect(payload!.points).toBe(12.5);
    expect(Number.isInteger(payload!.points)).toBe(false);
  });
});
