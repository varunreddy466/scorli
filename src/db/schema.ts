import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const gameTypes = sqliteTable('game_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>(),
});

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameTypeId: integer('game_type_id')
    .notNull()
    .references(() => gameTypes.id),
  status: text('status', { enum: ['in_progress', 'completed'] })
    .notNull()
    .default('in_progress'),
  targetScore: integer('target_score'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  cloudId: text('cloud_id'),
});

export const gamePlayers = sqliteTable('game_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id),
  profileId: text('profile_id'),
  displayName: text('display_name').notNull(),
  seatOrder: integer('seat_order').notNull(),
  color: text('color').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  cloudId: text('cloud_id'),
  cloudGameId: text('cloud_game_id'),
});

export const rounds = sqliteTable('rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  cloudId: text('cloud_id'),
  cloudGameId: text('cloud_game_id'),
});

export const scores = sqliteTable('scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id')
    .notNull()
    .references(() => rounds.id),
  gamePlayerId: integer('game_player_id')
    .notNull()
    .references(() => gamePlayers.id),
  points: real('points').notNull(),
  modifiers: text('modifiers', { mode: 'json' }).$type<Record<string, unknown>>(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  cloudId: text('cloud_id'),
  cloudRoundId: text('cloud_round_id'),
  cloudGamePlayerId: text('cloud_game_player_id'),
});

export const syncQueue = sqliteTable('sync_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  localId: integer('local_id').notNull(),
  operation: text('operation', { enum: ['insert', 'update', 'delete'] }).notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<Record<string, unknown>>(),
});

export type GameType = typeof gameTypes.$inferSelect;
export type Game = typeof games.$inferSelect;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type SyncQueueRecord = typeof syncQueue.$inferSelect;
export type SyncMeta = typeof syncMeta.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type NewGamePlayer = typeof gamePlayers.$inferInsert;
export type NewRound = typeof rounds.$inferInsert;
export type NewScore = typeof scores.$inferInsert;
export type NewSyncQueueRecord = typeof syncQueue.$inferInsert;
