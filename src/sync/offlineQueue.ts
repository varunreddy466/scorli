import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { syncQueue } from '@/db/schema';

export async function enqueue(
  tableName: string,
  localId: number,
  operation: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown> | null,
): Promise<void> {
  await db.insert(syncQueue).values({
    tableName,
    localId,
    operation,
    payload,
    createdAt: new Date(),
  });
}

export async function getPendingOperations() {
  return db.select().from(syncQueue).orderBy(asc(syncQueue.createdAt));
}

export async function removeFromQueue(id: number): Promise<void> {
  await db.delete(syncQueue).where(eq(syncQueue.id, id));
}
