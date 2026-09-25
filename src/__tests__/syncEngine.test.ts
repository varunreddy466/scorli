/* eslint-disable import/first */
import type { SyncQueueEntry } from '@/sync/types';

// --- mock setup ---

const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/sync/syncMeta', () => ({
  getLastSyncAt: jest.fn().mockResolvedValue(null),
  setLastSyncAt: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: jest.fn().mockResolvedValue({
      data: { games: [], game_players: [], rounds: [], scores: [] },
      error: null,
    }),
  },
  isSupabaseConfigured: true,
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ session: { user: { id: 'uid' } } })),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

const mockRemoveFromQueue = jest.fn().mockResolvedValue(undefined);
const mockGetPendingOperations = jest.fn();
const mockSetCloudId = jest.fn().mockResolvedValue(undefined);

jest.mock('@/sync/offlineQueue', () => ({
  getPendingOperations: (...args: unknown[]) => mockGetPendingOperations(...args),
  removeFromQueue: (...args: unknown[]) => mockRemoveFromQueue(...args),
}));

jest.mock('@/sync/syncPayload', () => ({
  buildPayloadWithCloudId: jest.fn(async (_table: string, _localId: number) => ({})),
  buildDeletePayload: jest.fn(async (_table: string, _localId: number) => ({
    id: 'remote-id',
  })),
  hasCloudId: jest.fn(() => false),
}));

jest.mock('@/sync/cloudMapping', () => ({
  setCloudId: (...args: unknown[]) => mockSetCloudId(...args),
  setCloudFks: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/sync/conflictResolution', () => ({
  resolveConflict: jest.fn(),
}));

jest.mock('@/db/client', () => ({
  db: {},
  initDB: jest.fn().mockResolvedValue(undefined),
}));

import { runSync, getSyncStatus } from '@/sync/syncEngine';

function makeOp(override: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    id: 1,
    tableName: 'games',
    localId: 42,
    operation: 'insert',
    payload: { id: 'game-1' },
    createdAt: new Date(),
    ...override,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runSync — error path', () => {
  it('keeps failed op in queue and sets status to error when Supabase upsert fails', async () => {
    mockGetPendingOperations.mockResolvedValue([makeOp()]);
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockReturnValue({
      select: jest.fn().mockResolvedValue({ error: { message: 'network error' }, data: null }),
    });

    await runSync();

    expect(mockRemoveFromQueue).not.toHaveBeenCalled();
    expect(getSyncStatus()).toBe('error');
  });

  it('removes successful op from queue and sets status to idle', async () => {
    mockGetPendingOperations.mockResolvedValue([makeOp()]);
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockReturnValue({ select: jest.fn().mockResolvedValue({ error: null, data: [] }) });

    await runSync();

    expect(mockRemoveFromQueue).toHaveBeenCalledWith(1);
    expect(getSyncStatus()).toBe('idle');
  });

  it('persists the returned cloud id after a successful upsert', async () => {
    mockGetPendingOperations.mockResolvedValue([makeOp()]);
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
    });
    mockUpsert.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        error: null,
        data: [{ id: 'remote-id' }],
      }),
    });

    await runSync();

    expect(mockSetCloudId).toHaveBeenCalledWith('games', 42, 'remote-id');
  });

  it('sets error status and does not dequeue when soft-delete update fails', async () => {
    mockGetPendingOperations.mockResolvedValue([
      makeOp({ operation: 'delete', payload: { id: 'remote-id' } }),
    ]);
    mockEq.mockResolvedValue({ error: { message: 'fail' } });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    await runSync();

    expect(mockRemoveFromQueue).not.toHaveBeenCalled();
    expect(getSyncStatus()).toBe('error');
  });

  it('removes successful soft-delete op from queue', async () => {
    mockGetPendingOperations.mockResolvedValue([
      makeOp({ id: 5, operation: 'delete', payload: { id: 'remote-id' } }),
    ]);
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    await runSync();

    expect(mockEq).toHaveBeenCalledWith('remote-id');
    expect(mockRemoveFromQueue).toHaveBeenCalledWith(5);
    expect(getSyncStatus()).toBe('idle');
  });

  it('sets error if session is absent', async () => {
    const { useAuthStore } = jest.requireMock('@/store/authStore') as {
      useAuthStore: { getState: jest.Mock };
    };
    useAuthStore.getState.mockReturnValueOnce({ session: null });

    mockGetPendingOperations.mockResolvedValue([]);

    await runSync();

    expect(getSyncStatus()).toBe('idle');
    expect(mockRemoveFromQueue).not.toHaveBeenCalled();
  });
});
