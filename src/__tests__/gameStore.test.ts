/**
 * Regression tests for the local-persistence fixes in this PR.
 *
 * 1. resolveGameConfig merges a per-game targetScore over the game-type default.
 * 2. Seeding generates one entry per registered rule and covers all 9 slugs.
 * 3. Per-game targetScore override reaches isGameOver correctly.
 * 4. updateScore recomputes totals and marks a game completed when appropriate.
 * 5. createGame succeeds for every slug in the registry.
 *
 * All helpers used by jest.mock factories are prefixed with "mock" so that
 * Babel's scope check permits them.
 */

/* eslint-disable import/first */

// ─── In-memory tables ─────────────────────────────────────────────────────────
type MockRow = Record<string, unknown>;

const mockTables: Record<string, MockRow[]> = {
  game_types: [],
  games: [],
  game_players: [],
  rounds: [],
  scores: [],
};

function mockNextId(tableName: string): number {
  const rows = mockTables[tableName];
  return rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.id as number)) + 1;
}

/**
 * Resolve a value from a (potentially joined) flat row.
 * ColRef objects carry { __col, __table }; plain values are returned as-is.
 */
function mockReadField(flatRow: MockRow, ref: unknown): unknown {
  if (typeof ref === 'object' && ref !== null && '__col' in ref && '__table' in ref) {
    const { __col, __table } = ref as { __col: string; __table: string };
    // Prefer the namespaced key (e.g. `game_types__id`) to avoid ambiguity.
    const ns = `${__table}__${__col}`;
    return ns in flatRow ? flatRow[ns] : flatRow[__col];
  }
  return ref;
}

/**
 * Extract the table name and schema variable key from a schema proxy.
 */
function mockSchemaInfo(schema: unknown): { tableName: string; schemaKey: string } {
  if (typeof schema === 'object' && schema !== null) {
    const tn = (schema as Record<string, unknown>).__tableName;
    const sk = (schema as Record<string, unknown>).__schemaKey;
    if (typeof tn === 'string' && typeof sk === 'string') return { tableName: tn, schemaKey: sk };
  }
  const s = schema as string;
  return { tableName: s, schemaKey: s };
}

/**
 * Chainable select builder.
 *
 * Drizzle's SELECT behavior that we need to replicate:
 *   db.select().from(T).innerJoin(U, on)     → rows: { [keyT]: rowT, [keyU]: rowU }[]
 *   db.select({...}).from(T).innerJoin(U, on) → rows: { alias: value }[]
 *   db.select().from(T).where(...)            → rows: T[]
 */
function mockMakeSelect(projection: MockRow | null) {
  const state = {
    tableName: '',
    schemaKey: '',
    filters: [] as ((flatRow: MockRow) => boolean)[],
    join: null as null | {
      tableName: string;
      schemaKey: string;
      on: (flatRow: MockRow) => boolean;
    },
    projection,
  };

  const api = {
    from(t: unknown) {
      const info = mockSchemaInfo(t);
      state.tableName = info.tableName;
      state.schemaKey = info.schemaKey;
      return api;
    },
    innerJoin(t: unknown, on: (flatRow: MockRow) => boolean) {
      const info = mockSchemaInfo(t);
      state.join = { tableName: info.tableName, schemaKey: info.schemaKey, on };
      return api;
    },
    where(fn: (flatRow: MockRow) => boolean) {
      state.filters.push(fn);
      return api;
    },
    orderBy() {
      return api;
    },

    then(resolve: (rows: unknown[]) => void) {
      const primaryRows = (mockTables[state.tableName] ?? []).map((r) => ({ ...r }));

      if (state.join) {
        const { tableName: joinTable, schemaKey: joinKey, on } = state.join;
        const primaryKey = state.schemaKey;

        // Build (primary, secondary, flat) triples.
        const pairs: { primary: MockRow; secondary: MockRow; flat: MockRow }[] = [];
        for (const a of primaryRows) {
          for (const b of mockTables[joinTable] ?? []) {
            // flat row: namespaced join columns + primary columns (primary wins).
            const flat: MockRow = {};
            for (const [k, v] of Object.entries(b)) {
              flat[`${joinTable}__${k}`] = v;
              if (!(k in a)) flat[k] = v; // non-conflicting un-prefixed copy
            }
            Object.assign(flat, a);
            if (on(flat)) pairs.push({ primary: { ...a }, secondary: { ...b }, flat });
          }
        }

        // Apply WHERE filters.
        const filtered = pairs.filter((p) => state.filters.every((f) => f(p.flat)));

        // Shape output.
        let result: unknown[];
        if (state.projection) {
          result = filtered.map((p) => {
            const out: MockRow = {};
            for (const [alias, ref] of Object.entries(state.projection!)) {
              out[alias] = mockReadField(p.flat, ref);
            }
            return out;
          });
        } else {
          // No projection: Drizzle nests by schema key.
          result = filtered.map((p) => ({ [primaryKey]: p.primary, [joinKey]: p.secondary }));
        }

        resolve(result);
        return Promise.resolve(result);
      }

      // No join.
      let rows: MockRow[] = [...primaryRows];
      for (const f of state.filters) rows = rows.filter(f);

      let result: unknown[];
      if (state.projection) {
        result = rows.map((row) => {
          const out: MockRow = {};
          for (const [alias, ref] of Object.entries(state.projection!)) {
            out[alias] = mockReadField(row, ref);
          }
          return out;
        });
      } else {
        result = rows;
      }

      resolve(result);
      return Promise.resolve(result);
    },
  };
  return api;
}

const mockDb = {
  select: jest.fn((projection?: MockRow) => ({
    from: (t: unknown) => mockMakeSelect(projection ?? null).from(t),
  })),

  insert: jest.fn((t: unknown) => ({
    values: (vals: MockRow | MockRow[]) => {
      const { tableName } = mockSchemaInfo(t);
      const arr = Array.isArray(vals) ? vals : [vals];
      return {
        onConflictDoNothing: () =>
          Promise.resolve(
            (() => {
              for (const v of arr) {
                if (v.slug && mockTables[tableName].some((r) => r.slug === v.slug)) continue;
                mockTables[tableName].push({ id: mockNextId(tableName), ...v });
              }
            })(),
          ),
        returning: () => {
          const inserted: MockRow[] = [];
          for (const v of arr) {
            const row: MockRow = { id: mockNextId(tableName), ...v };
            mockTables[tableName].push(row);
            inserted.push(row);
          }
          return Promise.resolve(inserted);
        },
        then(resolve: () => void) {
          for (const v of arr) mockTables[tableName].push({ id: mockNextId(tableName), ...v });
          resolve();
          return Promise.resolve();
        },
      };
    },
  })),

  update: jest.fn((t: unknown) => ({
    set: (patch: MockRow) => ({
      where: (fn: (row: MockRow) => boolean) => {
        const { tableName } = mockSchemaInfo(t);
        mockTables[tableName] = mockTables[tableName].map((r) => (fn(r) ? { ...r, ...patch } : r));
        return Promise.resolve();
      },
    }),
  })),

  delete: jest.fn((t: unknown) => ({
    where: (fn: (row: MockRow) => boolean) => {
      const { tableName } = mockSchemaInfo(t);
      mockTables[tableName] = mockTables[tableName].filter((r) => !fn(r));
      return Promise.resolve();
    },
  })),
};

// ─── jest.mock factories ──────────────────────────────────────────────────────

jest.mock('@/db/client', () => ({
  // Use a getter so mockDb is looked up at call time (avoids hoisting issues).
  get db() {
    return mockDb;
  },
  initDB: jest.fn().mockResolvedValue(undefined),
}));

// Schema proxies: any property access returns a ColRef { __col, __table }.
// Special properties __tableName and __schemaKey return the table identifiers.
jest.mock('@/db/schema', () => ({
  gameTypes: new Proxy(
    { __tableName: 'game_types', __schemaKey: 'gameTypes' },
    {
      get: (t, col) =>
        col === '__tableName'
          ? t.__tableName
          : col === '__schemaKey'
            ? t.__schemaKey
            : { __col: String(col), __table: 'game_types' },
    },
  ),
  games: new Proxy(
    { __tableName: 'games', __schemaKey: 'games' },
    {
      get: (t, col) =>
        col === '__tableName'
          ? t.__tableName
          : col === '__schemaKey'
            ? t.__schemaKey
            : { __col: String(col), __table: 'games' },
    },
  ),
  gamePlayers: new Proxy(
    { __tableName: 'game_players', __schemaKey: 'gamePlayers' },
    {
      get: (t, col) =>
        col === '__tableName'
          ? t.__tableName
          : col === '__schemaKey'
            ? t.__schemaKey
            : { __col: String(col), __table: 'game_players' },
    },
  ),
  rounds: new Proxy(
    { __tableName: 'rounds', __schemaKey: 'rounds' },
    {
      get: (t, col) =>
        col === '__tableName'
          ? t.__tableName
          : col === '__schemaKey'
            ? t.__schemaKey
            : { __col: String(col), __table: 'rounds' },
    },
  ),
  scores: new Proxy(
    { __tableName: 'scores', __schemaKey: 'scores' },
    {
      get: (t, col) =>
        col === '__tableName'
          ? t.__tableName
          : col === '__schemaKey'
            ? t.__schemaKey
            : { __col: String(col), __table: 'scores' },
    },
  ),
}));

// eq(colRef|literal, colRef|literal) → predicate.
// mockReadField is mock-prefixed, so it's permitted in the factory.
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(
    (left: unknown, right: unknown) => (flatRow: MockRow) =>
      mockReadField(flatRow, left) === mockReadField(flatRow, right),
  ),
  desc: jest.fn((col: unknown) => col),
}));

jest.mock('zustand', () => ({
  create: (
    fn: (
      set: (p: Record<string, unknown>) => void,
      get: () => Record<string, unknown>,
    ) => Record<string, unknown>,
  ) => {
    let state: Record<string, unknown> = {};
    const setState = (patch: Record<string, unknown>) => {
      state = { ...state, ...patch };
    };
    const getState = () => state;
    state = fn(setState, getState);
    return (selector: (s: unknown) => unknown) => selector(state);
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { getAllGameTypes } from '../rules';
import { resolveGameConfig, useGameStore } from '../store/gameStore';
import type { GameType } from '../db/schema';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetTables() {
  mockTables.game_types = [];
  mockTables.games = [];
  mockTables.game_players = [];
  mockTables.rounds = [];
  mockTables.scores = [];
}

function useStore() {
  return useGameStore((s) => s) as {
    init: () => Promise<void>;
    createGame: (p: {
      gameTypeSlug: string;
      targetScore?: number;
      players: { displayName: string; color: string }[];
    }) => Promise<number>;
    addRound: (p: { gameId: number; scores: Record<number, number> }) => Promise<void>;
    updateScore: (scoreId: number, points: number) => Promise<void>;
  };
}

// ─── 1. resolveGameConfig (pure) ─────────────────────────────────────────────

describe('resolveGameConfig', () => {
  const gt = (config: Record<string, unknown>): Pick<GameType, 'config'> => ({ config });

  it('returns base config unchanged when game.targetScore is null', () => {
    expect(resolveGameConfig(gt({ targetScore: 100 }), { targetScore: null })).toEqual({
      targetScore: 100,
    });
  });

  it('overrides targetScore with per-game value', () => {
    expect(resolveGameConfig(gt({ targetScore: 100 }), { targetScore: 75 })).toEqual({
      targetScore: 75,
    });
  });

  it('does not inject targetScore key when game.targetScore is null', () => {
    const result = resolveGameConfig(gt({}), { targetScore: null });
    expect(Object.prototype.hasOwnProperty.call(result, 'targetScore')).toBe(false);
  });

  it('preserves extra keys alongside the override', () => {
    expect(resolveGameConfig(gt({ eliminationThreshold: 200 }), { targetScore: 50 })).toEqual({
      eliminationThreshold: 200,
      targetScore: 50,
    });
  });
});

// ─── 2. Seeding values (rules-level, no DB) ───────────────────────────────────

describe('seeding rules', () => {
  it('registry has exactly 9 rules', () => {
    expect(getAllGameTypes()).toHaveLength(9);
  });

  it('every rule has a non-empty slug and name', () => {
    for (const rule of getAllGameTypes()) {
      expect(rule.slug.length).toBeGreaterThan(0);
      expect(rule.name.length).toBeGreaterThan(0);
    }
  });

  it('skyjo seed config includes targetScore: 100', () => {
    const skyjo = getAllGameTypes().find((r) => r.slug === 'skyjo')!;
    const seeded =
      skyjo.defaultConfig !== undefined
        ? skyjo.defaultConfig
        : { targetScore: skyjo.defaultTargetScore, winCondition: skyjo.winCondition };
    expect(seeded).toMatchObject({ targetScore: 100 });
  });

  it('rummy seed config includes eliminationThreshold: 200', () => {
    const rummy = getAllGameTypes().find((r) => r.slug === 'rummy')!;
    expect(rummy.defaultConfig).toMatchObject({ eliminationThreshold: 200 });
  });

  it('custom seed config is {}', () => {
    const custom = getAllGameTypes().find((r) => r.slug === 'custom')!;
    expect(custom.defaultConfig).toEqual({});
  });
});

// ─── 3. Per-game targetScore reaches isGameOver (pure rules) ──────────────────

describe('targetScore override via resolveGameConfig + isGameOver', () => {
  const { getGameRules } = jest.requireActual('../rules') as typeof import('../rules');

  it('skyjo ends at 50 when per-game targetScore is 50', () => {
    const rules = getGameRules('skyjo');
    const totals = [
      { gamePlayerId: 1, displayName: 'Alice', total: 50 },
      { gamePlayerId: 2, displayName: 'Bob', total: 10 },
    ];
    const config = resolveGameConfig({ config: { targetScore: 100 } }, { targetScore: 50 });
    expect(rules.isGameOver(totals, config)).toBe(true);
  });

  it('skyjo does NOT end at 50 with default targetScore 100', () => {
    const rules = getGameRules('skyjo');
    const totals = [
      { gamePlayerId: 1, displayName: 'Alice', total: 50 },
      { gamePlayerId: 2, displayName: 'Bob', total: 10 },
    ];
    const config = resolveGameConfig({ config: { targetScore: 100 } }, { targetScore: null });
    expect(rules.isGameOver(totals, config)).toBe(false);
  });

  it('hearts ends at 75 when per-game targetScore is 75', () => {
    const rules = getGameRules('hearts');
    const totals = [
      { gamePlayerId: 1, displayName: 'Alice', total: 75 },
      { gamePlayerId: 2, displayName: 'Bob', total: 10 },
    ];
    const config = resolveGameConfig({ config: { targetScore: 100 } }, { targetScore: 75 });
    expect(rules.isGameOver(totals, config)).toBe(true);
  });
});

// ─── 4. Seeding upgrade path (DB) ────────────────────────────────────────────

describe('seeding upgrade path', () => {
  beforeEach(resetTables);

  it('a DB seeded with the old 3 rows gains the missing 6 on init', async () => {
    mockTables.game_types = [
      { id: 1, slug: 'skyjo', name: 'Skyjo', config: { targetScore: 100 } },
      { id: 2, slug: 'rummy', name: 'Rummy', config: { eliminationThreshold: 200 } },
      { id: 3, slug: 'custom', name: 'Custom', config: {} },
    ];

    const store = useStore();
    await store.init();

    expect(mockTables.game_types).toHaveLength(getAllGameTypes().length);
    const slugs = mockTables.game_types.map((r) => r.slug as string);
    for (const rule of getAllGameTypes()) {
      expect(slugs).toContain(rule.slug);
    }
  });
});

// ─── 5. createGame — all slugs (DB) ──────────────────────────────────────────

describe('createGame — all slugs', () => {
  beforeEach(resetTables);

  it('createGame succeeds for every registered slug', async () => {
    const store = useStore();
    await store.init();

    for (const rule of getAllGameTypes()) {
      const id = await store.createGame({
        gameTypeSlug: rule.slug,
        players: [
          { displayName: 'Alice', color: '#f00' },
          { displayName: 'Bob', color: '#00f' },
        ],
      });
      expect(typeof id).toBe('number');
    }
  });
});

// ─── 6. updateScore completes game (DB) ──────────────────────────────────────

describe('updateScore completes game', () => {
  beforeEach(resetTables);

  it('marks game completed when edited score pushes total to the threshold', async () => {
    const store = useStore();
    await store.init();

    const gameId = await store.createGame({
      gameTypeSlug: 'skyjo', // default threshold: 100
      players: [
        { displayName: 'Alice', color: '#f00' },
        { displayName: 'Bob', color: '#00f' },
      ],
    });

    const aliceId = mockTables.game_players.find((p) => p.displayName === 'Alice')!.id as number;
    const bobId = mockTables.game_players.find((p) => p.displayName === 'Bob')!.id as number;

    // Round 1: 50 pts each — still in progress
    await store.addRound({ gameId, scores: { [aliceId]: 50, [bobId]: 50 } });
    expect(mockTables.games.find((g) => g.id === gameId)!.status).toBe('in_progress');

    // Edit Alice's score from 50 → 100; her total becomes 100 → game-over
    const aliceScore = mockTables.scores.find((s) => s.gamePlayerId === aliceId)!;
    await store.updateScore(aliceScore.id as number, 100);
    expect(mockTables.games.find((g) => g.id === gameId)!.status).toBe('completed');
  });
});
