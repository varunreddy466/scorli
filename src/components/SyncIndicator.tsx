import { StyleSheet, Text, View } from 'react-native';
import { useSyncStatus } from '@/sync';
import type { SyncStatus } from '@/sync';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

const STATUS_CONFIG: Record<SyncStatus | 'local-only', { label: string; color: string } | null> = {
  'local-only': null,
  idle: { label: '✓ Synced', color: '#22c55e' },
  syncing: { label: '↻ Syncing', color: '#f59e0b' },
  offline: { label: '⊘ Offline', color: '#94a3b8' },
  error: { label: '✕ Sync error', color: '#ef4444' },
};

export function SyncIndicator() {
  const status = useSyncStatus();
  const session = useAuthStore((state) => state.session);

  if (!isSupabaseConfigured || !session) {
    return null;
  }

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['idle'];
  if (!config) {
    return null;
  }

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
