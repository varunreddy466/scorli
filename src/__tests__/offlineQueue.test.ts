/* eslint-disable import/first */
jest.mock('drizzle-orm', () => ({
  asc: jest.fn((value: unknown) => value),
  eq: jest.fn(() => undefined),
}));

jest.mock('@/db/client', () => ({
  db: {
    insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        orderBy: jest.fn().mockResolvedValue([
          {
            id: 1,
            tableName: 'games',
            localId: 42,
            operation: 'insert',
            payload: {},
            createdAt: new Date(),
          },
        ]),
      })),
    })),
    delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
  },
}));

jest.mock('@/db/schema', () => ({
  syncQueue: { id: 'id', createdAt: 'createdAt' },
}));

import { getPendingOperations } from '@/sync/offlineQueue';

describe('offlineQueue', () => {
  it('getPendingOperations returns queued items', async () => {
    const ops = await getPendingOperations();
    expect(ops).toHaveLength(1);
    expect(ops[0].tableName).toBe('games');
    expect(ops[0].operation).toBe('insert');
  });
});
