# Scorli Architecture

This document describes the Scorli architecture at a high level (HLD) and a low level (LLD).
All file references are relative to the repository root and kept as inline code paths for
greppability.

---

## HLD — High-Level Design

### 1. System context

```
┌─────────────────────────────────────────────────────────────┐
│                   Scorli Mobile App                          │
│          (Expo / React Native, iOS + Android)                │
│                                                              │
│  Presentation  (app/**)                                      │
│       ↓                                                      │
│  State         (src/store/gameStore.ts, authStore.ts)        │
│       ↓                          ↘                           │
│  Domain        (src/rules/*)     Sync Engine                 │
│  pure scoring                    (src/sync/*)                │
│       ↓                          ↓                           │
│  Local SQLite  — expo-sqlite + Drizzle ORM — source of truth │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           │ (only when signed in AND online)
             ┌─────────────┴──────────────────┐
             │            Supabase             │
             │  Auth (Apple / OAuth / email)   │
             │  Postgres + RLS                 │
             │  Edge Function: delete-account  │
             └─────────────────────────────────┘
```

### 2. Architectural principles

| Principle | Where it is implemented |
|---|---|
| **Offline-first / local-first** | `src/db/client.ts` opens `scorli.db`; `initDB()` creates all tables on first boot. Zero network required. |
| **Cloud is additive, never required** | `src/lib/supabase.ts` falls back to `https://placeholder.supabase.co` and exports `isSupabaseConfigured`; `runSync()` returns early with status `idle` when there is no session. |
| **Strategy pattern for game rules** | `src/rules/index.ts` registry maps slug → `GameRules`; every caller uses `getGameRules(slug)`, never a game-specific branch. |
| **Pure, testable domain logic** | Rules modules have no I/O — one Jest file per rule in `src/__tests__/`. |
| **Outbox pattern for sync** | `sync_queue` table + `enqueue()` / `getPendingOperations()` / `removeFromQueue()` in `src/sync/offlineQueue.ts`. |
| **Soft deletes + last-write-wins** | `updated_at`, `deleted_at`, and `cloud_id` on every synced table; `resolveConflict()` in `src/sync/conflictResolution.ts`. |
| **Defense at the DB** | RLS on all Postgres tables, plus `can_access_game()` SECURITY DEFINER helper to avoid policy recursion. |

### 3. Layer decomposition

| Layer | Modules | Responsibility |
|---|---|---|
| **Presentation** | `app/**` (expo-router) | Screens, navigation stack, direct Drizzle reads for view models |
| **Application / state** | `src/store/gameStore.ts`, `src/store/authStore.ts` | Orchestrate use-cases, own transactional flows |
| **Domain** | `src/rules/*` | Scoring, game-over detection, ranking — pure functions |
| **Persistence** | `src/db/schema.ts`, `src/db/client.ts` | Drizzle SQLite schema, bootstrap + additive migrations |
| **Integration** | `src/sync/*`, `src/lib/supabase.ts` | Outbox drain, connectivity, auth token storage |
| **Backend** | `supabase/migrations`, `supabase/functions/delete-account` | Cloud schema, RLS, account deletion |

### 4. Key runtime flows

**App boot** (`app/_layout.tsx`)

```
useGameStore.init()
  └─ initDB()
       └─ CREATE TABLE IF NOT EXISTS … (all tables)
       └─ ensureColumn() patches (updated_at, deleted_at, cloud_id)
       └─ seed game_types via onConflictDoNothing
  └─ loadGames()

useAuthStore.init()
  └─ supabase.auth.getSession()
  └─ onAuthStateChange subscription
  └─ runSync()

initSync()
  └─ NetInfo.addEventListener → runSync() on reconnect

cleanup
  └─ unsubscribe auth listener
  └─ unsubscribe NetInfo listener
```

**Add a round** (`src/store/gameStore.ts → addRound`)

```
Screen /game/[id]/round
  → addRound({ gameId, scores, closerId })
       → JOIN games × game_types → slug + config
       → getGameRules(slug).scoreRound({ scores, closerId, config })
       → INSERT rounds  (roundNumber = existing.length + 1)
       → INSERT scores  (points + modifiers JSON per player)
       → recompute totals from all scores for this game
       → rules.isGameOver(totals, config)
            true  → UPDATE games SET status = 'completed', ended_at = now
            false → UPDATE games SET updated_at = now
       → loadGames()  ← triggers Zustand re-render
```

**Sync** (`src/sync/syncEngine.ts → runSync`)

```
session?        no  → status = 'idle',    return
NetInfo online? no  → status = 'offline', return

status = 'syncing'
for each queued op (ORDER BY created_at ASC):
  insert | update → supabase.from(tableName).upsert(payload)
  delete          → cloudId present?
                       yes → supabase.from(tableName)
                                .update({ deleted_at: now })
                                .eq('id', cloudId)
                       no  → skip (continue)
  success → removeFromQueue(op.id)
  failure → leave queued; anyFailed = true

status = anyFailed ? 'error' : 'idle'

Observers: subscribeSyncStatus → useSyncStatus → <SyncIndicator/> in nav header
```

---

## LLD — Low-Level Design

### 1. Domain contract — `src/rules/types.ts`

```ts
export interface GameRules {
  slug: string;
  name: string;
  defaultTargetScore: number;
  winCondition: 'lowest' | 'highest';
  minPlayers: number;
  maxPlayers: number;
  description?: string;
  icon?: string;
  scoreRound(input: RoundInput): RoundResult;
  isGameOver(totals: PlayerTotals[], config: GameConfig): boolean;
  rank(totals: PlayerTotals[]): RankedPlayer[];
}
```

**`RoundInput`**

```ts
export interface RoundInput {
  scores: Record<number, number>; // gamePlayerId → raw score
  closerId?: number;              // who closed the round (Skyjo)
  config: GameConfig;
  entries?: Record<number, SpadesBidEntry>; // Spades only: bid/tricks pairs
}
```

`entries` exists so Spades can carry bid + tricks per player without changing the shared
signature used by all other game rules.

**`RoundResult`**

```ts
export interface RoundResult {
  points:    Record<number, number>;               // gamePlayerId → final points
  modifiers: Record<number, Record<string, unknown>>; // persisted to scores.modifiers JSON
}
```

`modifiers` is written as JSON into `scores.modifiers` and read back by the UI (e.g.
`app/game/[id].tsx` renders a `×2` badge when `modifiers.doubled === true`).

**Registry** — `src/rules/index.ts`

| Slug | Module |
|---|---|
| `skyjo` | `src/rules/skyjo.ts` |
| `rummy` | `src/rules/rummy.ts` |
| `custom` | `src/rules/custom.ts` |
| `phase-10` | `src/rules/phase10.ts` |
| `rummy-500` | `src/rules/rummy500.ts` |
| `hearts` | `src/rules/hearts.ts` |
| `spades` | `src/rules/spades.ts` |
| `canasta` | `src/rules/canasta.ts` |
| `cribbage` | `src/rules/cribbage.ts` |

`getGameRules(slug)` throws on an unknown slug. `getAllGameTypes()` returns all registry
values and drives the New Game picker screen.

**Worked example — Skyjo doubling penalty** (`src/rules/skyjo.ts`)

- Closer is doubled **unless** they are strictly lowest across all other players *and*
  their score is `> 0`.
- Penalty modifier: `{ doubled: true, originalScore, reason: 'closer_not_lowest' }`.
- No penalty modifier: `{ doubled: false, closed: true }`.
- `isGameOver`: any player's running total `>= config.targetScore ?? 100`.
- `rank`: ascending (lowest total wins, `rank: 1`).

---

### 2. Local schema — `src/db/schema.ts`

| Table | Columns | Sync triple |
|---|---|---|
| `game_types` | `id`, `slug` (unique), `name`, `config` (json) | — local seed only |
| `games` | `id`, `game_type_id → game_types`, `status` (`in_progress\|completed`), `target_score`, `created_at`, `ended_at` | `updated_at`, `deleted_at`, `cloud_id` |
| `game_players` | `id`, `game_id → games`, `profile_id`, `display_name`, `seat_order`, `color` | `updated_at`, `deleted_at`, `cloud_id` |
| `rounds` | `id`, `game_id → games`, `round_number`, `created_at` | `updated_at`, `deleted_at`, `cloud_id` |
| `scores` | `id`, `round_id → rounds`, `game_player_id → game_players`, `points` (REAL), `modifiers` (json) | `updated_at`, `deleted_at`, `cloud_id` |
| `sync_queue` | `id`, `table_name`, `local_id`, `operation` (`insert\|update\|delete`), `payload` (json), `created_at` | — |

**Migration strategy**

`initDB()` in `src/db/client.ts` runs `CREATE TABLE IF NOT EXISTS` for every table on each
boot. Additive columns are handled by a hand-rolled `ensureColumn(table, column, definition)`
helper that:

1. Reads `PRAGMA table_info(<table>)` to check for the column.
2. Runs `ALTER TABLE <table> ADD COLUMN <definition>` if absent.
3. When the new column is `updated_at`, backfills it from `created_at` (or `Date.now()`)
   where the value equals `0`.

`drizzle-kit generate` / `drizzle-kit migrate` (via `npm run db:generate` / `npm run db:migrate`)
exists for schema authoring and generating migration files, but the runtime bootstrap uses the
above imperative path — not drizzle-kit migrations.

---

### 3. State — `src/store/gameStore.ts`

```ts
interface GameState {
  initialized:    boolean;
  activeGames:    Game[];
  completedGames: Game[];
  init():                                          Promise<void>;
  createGame(args: { gameTypeSlug, targetScore,
                     players }):                  Promise<number>;
  addRound(args: { gameId, scores, closerId }):   Promise<void>;
  deleteLastRound(gameId: number):                Promise<void>;
  updateScore(scoreId: number, points: number):   Promise<void>;
  finishGame(gameId: number):                     Promise<void>;
  loadGames():                                    Promise<void>;
}
```

**Behavioural details**

- `loadGames()` selects all games ordered by `createdAt DESC`, filters `deletedAt == null`
  in JavaScript (not SQL), then partitions the result set by `status` into `activeGames` /
  `completedGames`.
- `createGame` resolves the slug → `game_types` row, inserts with `.returning()` to obtain
  the new id, then bulk-inserts players with `seatOrder = index`.
- `deleteLastRound` orders rounds `DESC` by `roundNumber`, hard-deletes the associated
  scores rows first, then the round row, and bumps `games.updatedAt`.
- Every mutator ends with `await get().loadGames()` as the invalidation mechanism — there is
  no query-cache wiring for local data.

**`authStore`** (`src/store/authStore.ts`)

State: `{ session, user, loading }`.

- `init()` calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange`;
  returns an unsubscribe closure.
- `deleteAccount()` invokes the `delete-account` Edge Function with an explicit
  `Authorization: ****** header, then calls `supabase.auth.signOut()`.

---

### 4. Sync subsystem — `src/sync/`

| File | Contract |
|---|---|
| `types.ts` | `SyncStatus = 'idle' \| 'syncing' \| 'offline' \| 'error'`; `SyncQueueEntry` mirrors the `sync_queue` table row. |
| `offlineQueue.ts` | `enqueue(tableName, localId, operation, payload)` — inserts a row; `getPendingOperations()` — SELECT ordered ASC by `created_at`; `removeFromQueue(id)` — DELETE by id. |
| `syncEngine.ts` | `runSync()` — drains the queue (see HLD flow above); `initSync()` — registers a NetInfo listener; `getSyncStatus()` / `subscribeSyncStatus(fn)` — module-level `Set<Listener>` observer pattern. |
| `conflictResolution.ts` | `resolveConflict(local, remote): 'local' \| 'remote'` — remote wins ties (`remoteTime >= localTime`). |
| `useSyncStatus.ts` | React hook that bridges the observer into `src/components/SyncIndicator.tsx` for display in the nav header. |

**Failure semantics** — per-operation try/catch; failures remain queued for the next
NetInfo-triggered run. A delete without a `cloudId` string is skipped via
`getDeleteCloudId()` returning `null`.

---

### 5. Cloud schema & authorization — `supabase/migrations/`

**Tables** (`20240801000000_init.sql`)

| Table | Notable columns / constraints |
|---|---|
| `profiles` | PK = `auth.users.id`; auto-created by `on_auth_user_created` trigger → `handle_new_user()` (SECURITY DEFINER, `search_path = ''`). |
| `games` | `owner_id`, `game_type_slug`, `config jsonb`, `status`, `target_score`, `ended_at`. |
| `game_players` | `profile_id` OR `guest_name` enforced by `gp_identity_check` constraint. |
| `rounds` | `game_id`, `round_number`, `created_at`. |
| `scores` | `points int` (note: local uses REAL — see gaps), `modifiers jsonb`. |
| `friendships` | Composite PK `(user_id, friend_id)`, `status`. |

**Indexes**: `games(owner_id, status)`, `game_players(game_id)`, `game_players(profile_id)`,
`rounds(game_id)`, `scores(round_id)`, `scores(game_player_id)`, `friendships(friend_id)`.

**Authorization model** (`20240801000001_rls.sql`)

```
can_access_game(p_game_id uuid) → bool
  owner_id = auth.uid()   OR
  exists a game_players row with profile_id = auth.uid()

REVOKE execute FROM public, anon;
GRANT  execute TO   authenticated;
```

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | any authenticated | — | own row | — |
| `games` | `can_access_game(id)` | `owner_id = auth.uid()` | owner | owner |
| `game_players` | `can_access_game(game_id)` | owner of game | owner of game | owner of game |
| `rounds` | `can_access_game(game_id)` | owner of game | owner of game | owner of game |
| `scores` | `can_access_game` via round | owner of game | owner of game | owner of game |
| `friendships` | either side | `user_id = auth.uid()` | either side | either side |

---

### 6. Security notes

**Chunked `SecureStoreAdapter`** (`src/lib/supabase.ts`)

`expo-secure-store` enforces a per-entry value size limit (≈ 2 KB on iOS). The Supabase
session JSON can exceed this. The adapter transparently splits values into chunks of
`CHUNK_SIZE = 1800` bytes:

- Stores chunk count in `<key>_count`.
- Stores individual chunks in `<key>_0`, `<key>_1`, … `<key>_N`.
- Reassembles chunks on read; clears all chunk keys on overwrite/delete.

This ensures tokens survive app restarts on both iOS and Android without hitting platform
limits.

---

### 7. Known gaps and risks

| # | Description | File reference |
|---|---|---|
| 1 | Cloud `scores.points` is `int`; local `scores.points` is `REAL`. A fractional local score would be truncated or rejected on upsert. | `supabase/migrations/20240801000000_init.sql`, `src/db/schema.ts` |
| 2 | Nothing in the app currently calls `enqueue()`. `gameStore` mutations write to SQLite but never populate `sync_queue`, so `runSync()` drains an always-empty outbox. `resolveConflict()` is also unused; there is no pull/download path — sync is push-only. | `src/store/gameStore.ts`, `src/sync/offlineQueue.ts`, `src/sync/conflictResolution.ts` |
| 3 | `cloud_id` is never populated locally, so any queued delete would always hit the `!cloudId → continue` branch in `runSync()` and be silently skipped. | `src/sync/syncEngine.ts` |
| 4 | Local ids are auto-increment integers; cloud ids are UUIDs. There is no id-mapping layer, so upsert payloads would require one before the sync path can work end-to-end. | `src/db/schema.ts`, `supabase/migrations/20240801000000_init.sql` |
| 5 | `gameStore.updateScore` does not recompute game-over the way `addRound` does. `app/game/[id].tsx` still has a `// TODO: edit score` comment on the score cell, so `updateScore` currently has no UI caller. | `src/store/gameStore.ts`, `app/game/[id].tsx` |
| 6 | A `.env` file is committed at the repository root. Verify it contains no real Supabase anon key or URL and add it to `.gitignore`. | `.env` |
