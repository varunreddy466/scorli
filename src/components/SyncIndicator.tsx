import { StyleSheet, Text, View } from 'react-native';
import { useSyncStatus } from '@/sync';
import type { SyncStatus } from '@/sync';

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string }> = {
  idle: { label: '✓ Synced', color: '#22c55e' },
  syncing: { label: '↻ Syncing', color: '#f59e0b' },
  offline: { label: '⊘ Offline', color: '#94a3b8' },
  error: { label: '✕ Sync error', color: '#ef4444' },
};

export function SyncIndicator() {
  const status = useSyncStatus();
  const config = STATUS_CONFIG[status];

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '500' },
});
