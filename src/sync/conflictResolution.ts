/**
 * Last-write-wins conflict resolution based on updatedAt timestamp.
 * Returns the record that should "win" (most recently updated).
 */
export function resolveConflict<T extends { updatedAt: Date | number | string }>(
  local: T,
  remote: T,
): 'local' | 'remote' {
  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();
  return remoteTime >= localTime ? 'remote' : 'local';
}
