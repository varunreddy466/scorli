import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { syncMeta } from '@/db/schema';

const LAST_SYNC_KEY = 'last_sync_at';

export async function getLastSyncAt(): Promise<string | null> {
  const [row] = await db.select().from(syncMeta).where(eq(syncMeta.key, LAST_SYNC_KEY));
  if (!row?.value) return null;
  const parsed = row.value as { iso?: string };
  return parsed.iso ?? null;
}

export async function setLastSyncAt(iso: string): Promise<void> {
  await db
    .insert(syncMeta)
    .values({ key: LAST_SYNC_KEY, value: { iso } })
    .onConflictDoUpdate({
      target: syncMeta.key,
      set: { value: { iso } },
    });
}
