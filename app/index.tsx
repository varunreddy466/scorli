import { View, Text, FlatList, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';

export default function HomeScreen() {
  const router = useRouter();
  const activeGames = useGameStore((s) => s.activeGames);
  const initialized = useGameStore((s) => s.initialized);

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-lg text-white">Loading…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="mb-4 text-2xl font-bold text-slate-100">In Progress</Text>

      {activeGames.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="mb-6 text-base text-slate-400">No active games yet.</Text>
        </View>
      ) : (
        <FlatList
          data={activeGames}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mb-3 rounded-xl bg-slate-800 p-4"
              onPress={() => router.push(`/game/${item.id}`)}
            >
              <Text className="text-base font-semibold text-white">Game #{item.id}</Text>
              <Text className="text-sm text-slate-400">
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        className="mt-4 items-center rounded-2xl bg-indigo-600 py-4"
        onPress={() => router.push('/new-game')}
      >
        <Text className="text-lg font-bold text-white">+ New Game</Text>
      </TouchableOpacity>

      <Pressable className="mt-3 items-center" onPress={() => router.push('/history')}>
        <Text className="text-base text-indigo-400">View History</Text>
      </Pressable>
    </View>
  );
}
