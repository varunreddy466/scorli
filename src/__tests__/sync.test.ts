import { resolveConflict } from '@/sync/conflictResolution';

describe('resolveConflict (last-write-wins)', () => {
  it('picks remote when remote is newer', () => {
    const local = { updatedAt: new Date('2024-01-01T10:00:00Z') };
    const remote = { updatedAt: new Date('2024-01-01T11:00:00Z') };
    expect(resolveConflict(local, remote)).toBe('remote');
  });

  it('picks local when local is newer', () => {
    const local = { updatedAt: new Date('2024-01-01T12:00:00Z') };
    const remote = { updatedAt: new Date('2024-01-01T11:00:00Z') };
    expect(resolveConflict(local, remote)).toBe('local');
  });

  it('picks remote on equal timestamps (idempotent writes)', () => {
    const ts = new Date('2024-01-01T10:00:00Z');
    expect(resolveConflict({ updatedAt: ts }, { updatedAt: ts })).toBe('remote');
  });

  it('works with string timestamps', () => {
    const local = { updatedAt: '2024-01-01T10:00:00Z' };
    const remote = { updatedAt: '2024-01-01T11:00:00Z' };
    expect(resolveConflict(local, remote)).toBe('remote');
  });

  it('works with numeric timestamps', () => {
    const local = { updatedAt: 1000 };
    const remote = { updatedAt: 2000 };
    expect(resolveConflict(local, remote)).toBe('remote');
  });
});
