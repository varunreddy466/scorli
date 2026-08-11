export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncQueueEntry {
  id: number;
  tableName: string;
  localId: number;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown> | null;
  createdAt: Date;
}
