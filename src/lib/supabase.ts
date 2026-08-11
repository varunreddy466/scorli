import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'placeholder-anon-key';

async function getChunkCount(key: string): Promise<number> {
  const count = await SecureStore.getItemAsync(`${key}_count`);
  if (!count) return 0;
  const parsed = Number.parseInt(count, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function clearChunkedValue(key: string): Promise<void> {
  const count = await getChunkCount(key);
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(`${key}_${i}`);
  }
  if (count > 0) {
    await SecureStore.deleteItemAsync(`${key}_count`);
  }
}

const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const count = await getChunkCount(key);
    if (count === 0) {
      return SecureStore.getItemAsync(key);
    }

    const chunks: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk == null) {
        return null;
      }
      chunks.push(chunk);
    }

    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    await clearChunkedValue(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
    }
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    await clearChunkedValue(key);
  },
};

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
