import { and, asc, eq } from 'drizzle-orm';
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

export async function getPendingOperationCount(
  tableName: string,
  localId: number,
): Promise<number> {
  const rows = await db
    .select({ id: syncQueue.id })
    .from(syncQueue)
    .where(and(eq(syncQueue.tableName, tableName), eq(syncQueue.localId, localId)));
  return rows.length;
}

export async function getPendingOperations() {
  return db.select().from(syncQueue).orderBy(asc(syncQueue.createdAt));
}

export async function removeFromQueue(id: number): Promise<void> {
  await db.delete(syncQueue).where(eq(syncQueue.id, id));
}
