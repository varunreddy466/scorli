import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { db } from '@/db/client';
import { gamePlayers, gameTypes, games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { useGameStore } from '@/store/gameStore';
import { getGameRules } from '@/rules';
import type { GamePlayer } from '@/db/schema';

export default function RoundEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const addRound = useGameStore((s) => s.addRound);

  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [scoreInputs, setScoreInputs] = useState<Record<number, string>>({});
  const [closerId, setCloserId] = useState<number | undefined>();
  const [isSkyjo, setIsSkyjo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Record<number, number>>({});

  useEffect(() => {
    const gameId = Number(id);
    (async () => {
      const ps = await db
        .select()
        .from(gamePlayers)
        .where(eq(gamePlayers.gameId, gameId))
        .orderBy(gamePlayers.seatOrder);
      const [g] = await db.select().from(games).where(eq(games.id, gameId));
      const [gt] = g
        ? await db.select().from(gameTypes).where(eq(gameTypes.id, g.gameTypeId))
        : [null];
      setPlayers(ps);
      setIsSkyjo(gt?.slug === 'skyjo');
      const init: Record<number, string> = {};
      ps.forEach((p) => {
        init[p.id] = '';
      });
      setScoreInputs(init);
      setLoading(false);
    })();
  }, [id]);

  const updatePreview = (inputs: Record<number, string>, closer: number | undefined) => {
    if (Object.values(inputs).some((v) => v === '')) {
      setPreview({});
      return;
    }
    const raw: Record<number, number> = {};
    players.forEach((p) => {
      raw[p.id] = Number(inputs[p.id]);
    });
    const rules = getGameRules(isSkyjo ? 'skyjo' : 'custom');
    const result = rules.scoreRound({ scores: raw, closerId: closer, config: {} });
    setPreview(result.points);
  };

  const handleScoreChange = (playerId: number, val: string) => {
    const next = { ...scoreInputs, [playerId]: val };
    setScoreInputs(next);
    updatePreview(next, closerId);
  };

  const handleCloserChange = (pid: number) => {
    const next = closerId === pid ? undefined : pid;
    setCloserId(next);
    updatePreview(scoreInputs, next);
  };

  const handleSave = async () => {
    if (Object.values(scoreInputs).some((v) => v === '')) {
      Alert.alert('Error', 'Enter a score for every player.');
      return;
    }
    const raw: Record<number, number> = {};
    players.forEach((p) => {
      raw[p.id] = Number(scoreInputs[p.id]);
    });
    await addRound({ gameId: Number(id), scores: raw, closerId });
    router.back();
  };

  if (loading) return null;

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-4 text-xl font-bold text-slate-100">Enter Scores</Text>

      {players.map((p) => (
        <View key={p.id} className="mb-4">
          <View className="mb-1 flex-row items-center gap-2">
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            <Text className="font-semibold text-slate-200">{p.displayName}</Text>
            {preview[p.id] !== undefined && preview[p.id] !== Number(scoreInputs[p.id]) && (
              <Text className="ml-1 text-xs text-red-400">→ {preview[p.id]} (doubled)</Text>
            )}
          </View>
          <TextInput
            className="rounded-xl bg-slate-800 px-4 py-3 text-white"
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#64748b"
            value={scoreInputs[p.id]}
            onChangeText={(v) => handleScoreChange(p.id, v)}
          />
          {isSkyjo && (
            <TouchableOpacity
              className={`mt-2 self-start rounded-full border px-3 py-1 ${
                closerId === p.id
                  ? 'border-amber-500 bg-amber-500'
                  : 'border-slate-600 bg-slate-800'
              }`}
              onPress={() => handleCloserChange(p.id)}
            >
              <Text
                className={
                  closerId === p.id ? 'text-xs font-bold text-white' : 'text-xs text-slate-400'
                }
              >
                Closed round
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity
        className="mt-2 items-center rounded-2xl bg-indigo-600 py-4"
        onPress={() => void handleSave()}
      >
        <Text className="text-lg font-bold text-white">Save Round</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
