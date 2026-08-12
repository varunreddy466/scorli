import { View, Text, FlatList, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import { getAllGameTypes } from '@/rules';
import type { GameRules } from '@/rules';

export default function HomeScreen() {
  const router = useRouter();
  const activeGames = useGameStore((s) => s.activeGames);
  const initialized = useGameStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);
  const gameTypes = getAllGameTypes();

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-lg text-white">Loading…</Text>
      </View>
    );
  }

  const renderGameTile = ({ item }: { item: GameRules }) => (
    <TouchableOpacity
      className="m-2 flex-1 items-center justify-center rounded-2xl bg-slate-800 p-4"
      style={{ minHeight: 100 }}
      onPress={() => router.push(`/new-game?type=${item.slug}`)}
    >
      {item.icon ? (
        <Ionicons
          name={item.icon as 'list'}
          size={32}
          color="#818cf8"
          style={{ marginBottom: 8 }}
        />
      ) : null}
      <Text className="text-center text-sm font-bold text-white">{item.name}</Text>
      {item.description ? (
        <Text className="mt-1 text-center text-xs text-slate-400">{item.description}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-slate-900 p-4">
      {/* Auth section */}
      {!user ? (
        <TouchableOpacity
          className="mb-4 items-center rounded-2xl bg-indigo-600 py-3"
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text className="text-base font-bold text-white">Sign In to Sync Games</Text>
        </TouchableOpacity>
      ) : (
        <View className="mb-4 flex-row items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
          <Text className="text-sm text-slate-300">{user.email}</Text>
          <Pressable onPress={() => router.push('/profile')}>
            <Text className="text-sm text-indigo-400">Profile</Text>
          </Pressable>
        </View>
      )}

      {/* Game type tiles */}
      <Text className="mb-3 text-xl font-bold text-slate-100">Choose a Game</Text>
      <FlatList
        data={gameTypes}
        keyExtractor={(item) => item.slug}
        numColumns={2}
        renderItem={renderGameTile}
        style={{ flexGrow: 0 }}
      />

      {/* Active games */}
      {activeGames.length > 0 && (
        <>
          <Text className="mb-3 mt-5 text-xl font-bold text-slate-100">In Progress</Text>
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
        </>
      )}

      <Pressable className="mt-3 items-center" onPress={() => router.push('/history')}>
        <Text className="text-base text-indigo-400">View History</Text>
      </Pressable>
    </View>
  );
}
