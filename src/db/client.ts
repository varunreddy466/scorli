import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const expo = SQLite.openDatabaseSync('scorli.db');
export const db = drizzle(expo, { schema });

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
      ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      profile_id TEXT,
      display_name TEXT NOT NULL,
      seat_order INTEGER NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      game_player_id INTEGER NOT NULL REFERENCES game_players(id),
      points REAL NOT NULL,
      modifiers TEXT
    );
  `);
}
