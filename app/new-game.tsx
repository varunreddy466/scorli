import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { getAllGameTypes } from '@/rules';

const COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

interface PlayerEntry {
  name: string;
  color: string;
}

export default function NewGameScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const createGame = useGameStore((s) => s.createGame);
  const gameTypes = getAllGameTypes();

  const validSlugs = new Set(gameTypes.map((gt) => gt.slug));
  const initialSlug = type && validSlugs.has(type) ? type : 'skyjo';

  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug);
  const [targetScore, setTargetScore] = useState<string>('');
  const [players, setPlayers] = useState<PlayerEntry[]>([
    { name: '', color: COLORS[0] },
    { name: '', color: COLORS[1] },
  ]);

  const addPlayer = () => {
    if (players.length >= 8) return;
    setPlayers((prev) => [...prev, { name: '', color: COLORS[prev.length % COLORS.length] }]);
  };

  const removePlayer = (index: number) => {
    if (players.length <= 2) return;
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateName = (index: number, name: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, name } : p)));
  };

  const handleStart = async () => {
    if (players.some((p) => !p.name.trim())) {
      Alert.alert('Error', 'All players need a name.');
      return;
    }
    try {
      const id = await createGame({
        gameTypeSlug: selectedSlug,
        targetScore: targetScore ? Number(targetScore) : undefined,
        players: players.map((p) => ({ displayName: p.name.trim(), color: p.color })),
      });
      router.replace(`/game/${id}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-3 text-xl font-bold text-slate-100">Game Type</Text>
      <View className="mb-5 flex-row flex-wrap gap-2">
        {gameTypes.map((gt) => (
          <TouchableOpacity
            key={gt.slug}
            className={`rounded-full border px-4 py-2 ${
              selectedSlug === gt.slug
                ? 'border-indigo-600 bg-indigo-600'
                : 'border-slate-600 bg-slate-800'
            }`}
            onPress={() => setSelectedSlug(gt.slug)}
          >
            <Text className={selectedSlug === gt.slug ? 'font-bold text-white' : 'text-slate-300'}>
              {gt.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="mb-2 text-xl font-bold text-slate-100">Target Score (optional)</Text>
      <TextInput
        className="mb-5 rounded-xl bg-slate-800 px-4 py-3 text-white"
        keyboardType="numeric"
        placeholder="e.g. 100"
        placeholderTextColor="#64748b"
        value={targetScore}
        onChangeText={setTargetScore}
      />

      <Text className="mb-3 text-xl font-bold text-slate-100">Players</Text>
      {players.map((p, i) => (
        <View key={i} className="mb-3 flex-row items-center gap-3">
          <View className="h-5 w-5 rounded-full" style={{ backgroundColor: p.color }} />
          <TextInput
            className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-white"
            placeholder={`Player ${i + 1}`}
            placeholderTextColor="#64748b"
            value={p.name}
            onChangeText={(t) => updateName(i, t)}
          />
          {players.length > 2 && (
            <TouchableOpacity onPress={() => removePlayer(i)}>
              <Text className="text-xl font-bold text-red-400">×</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {players.length < 8 && (
        <TouchableOpacity
          className="mb-6 items-center rounded-xl border border-slate-600 bg-slate-800 py-3"
          onPress={addPlayer}
        >
          <Text className="text-slate-300">+ Add Player</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        className="items-center rounded-2xl bg-indigo-600 py-4"
        onPress={() => void handleStart()}
      >
        <Text className="text-lg font-bold text-white">Start Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
