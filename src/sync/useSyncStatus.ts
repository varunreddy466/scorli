import { useEffect, useState } from 'react';
import { getSyncStatus, subscribeSyncStatus } from './syncEngine';
import type { SyncStatus } from './types';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => subscribeSyncStatus(setStatus), []);

  return status;
}
