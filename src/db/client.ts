import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const expo = SQLite.openDatabaseSync('scorli.db');
export const db = drizzle(expo, { schema });

type TableColumn = {
  name: string;
};

async function ensureColumn(
  tableName: string,
  columnName: string,
  definition: string,
): Promise<void> {
  const columns = await expo.getAllAsync<TableColumn>(`PRAGMA table_info(${tableName});`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await expo.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${definition};`);
  }
}

export async function initDB(): Promise<void> {
  await expo.execAsync(`
    CREATE TABLE IF NOT EXISTS game_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      config TEXT
    );
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_type_id INTEGER NOT NULL REFERENCES game_types(id),
      status TEXT NOT NULL DEFAULT 'in_progress',
      target_score INTEGER,
      created_at INTEGER NOT NULL,
      ended_at INTEGER,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      cloud_id TEXT
    );
    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      profile_id TEXT,
      display_name TEXT NOT NULL,
      seat_order INTEGER NOT NULL,
      color TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      cloud_id TEXT
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      cloud_id TEXT
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      game_player_id INTEGER NOT NULL REFERENCES game_players(id),
      points REAL NOT NULL,
      modifiers TEXT,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      cloud_id TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      local_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  await ensureColumn('games', 'updated_at', 'updated_at INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('games', 'deleted_at', 'deleted_at INTEGER');
  await ensureColumn('games', 'cloud_id', 'cloud_id TEXT');
  await ensureColumn('game_players', 'updated_at', 'updated_at INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('game_players', 'deleted_at', 'deleted_at INTEGER');
  await ensureColumn('game_players', 'cloud_id', 'cloud_id TEXT');
  await ensureColumn('rounds', 'updated_at', 'updated_at INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('rounds', 'deleted_at', 'deleted_at INTEGER');
  await ensureColumn('rounds', 'cloud_id', 'cloud_id TEXT');
  await ensureColumn('scores', 'updated_at', 'updated_at INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('scores', 'deleted_at', 'deleted_at INTEGER');
  await ensureColumn('scores', 'cloud_id', 'cloud_id TEXT');
}
