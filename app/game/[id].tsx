import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { db } from '@/db/client';
import { games, gamePlayers, rounds, scores, gameTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { useGameStore } from '@/store/gameStore';
import { resolveGameConfig } from '@/store/gameStore';
import { getGameRules } from '@/rules';
import type { GamePlayer, Round, Score, Game, GameType } from '@/db/schema';

interface ScoreRow {
  round: Round;
  scoresByPlayer: Record<number, Score>;
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const deleteLastRound = useGameStore((s) => s.deleteLastRound);
  const finishGame = useGameStore((s) => s.finishGame);
  const updateScore = useGameStore((s) => s.updateScore);

  const [game, setGame] = useState<Game | null>(null);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const gameId = Number(id);
    const [g] = await db.select().from(games).where(eq(games.id, gameId));
    if (!g) return;
    const [gt] = await db.select().from(gameTypes).where(eq(gameTypes.id, g.gameTypeId));
    const ps = await db
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(gamePlayers.seatOrder);
    const rs = await db
      .select()
      .from(rounds)
      .where(eq(rounds.gameId, gameId))
      .orderBy(rounds.roundNumber);

    const allScores = await db
      .select()
      .from(scores)
      .innerJoin(rounds, eq(scores.roundId, rounds.id))
      .where(eq(rounds.gameId, gameId));

    const rows: ScoreRow[] = rs.map((r) => ({
      round: r,
      scoresByPlayer: Object.fromEntries(
        allScores
          .filter((s) => s.scores.roundId === r.id)
          .map((s) => [s.scores.gamePlayerId, s.scores]),
      ),
    }));

    setGame(g);
    setGameType(gt ?? null);
    setPlayers(ps);
    setScoreRows(rows);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (!game || !gameType) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-white">Game not found.</Text>
      </View>
    );
  }

  const rules = getGameRules(gameType.slug);

  const totals = players.map((p) => ({
    gamePlayerId: p.id,
    displayName: p.displayName,
    total: scoreRows.reduce((sum, row) => sum + (row.scoresByPlayer[p.id]?.points ?? 0), 0),
  }));

  const ranked = rules.rank(totals);
  const config = resolveGameConfig(gameType, game);
  const gameOver = game.status === 'completed' || rules.isGameOver(totals, config);

  const handleDeleteLast = () => {
    Alert.alert('Undo Last Round', 'Delete the last round?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLastRound(Number(id));
          void loadData();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-slate-900">
      {gameOver && (
        <View className="mx-4 mt-4 items-center rounded-xl bg-indigo-700 px-4 py-3">
          <Text className="text-lg font-bold text-white">
            🏆 {ranked[0]?.displayName ?? 'Unknown'} wins!
          </Text>
        </View>
      )}

      <View className="mb-2 mt-4 px-4">
        <Text className="mb-2 text-xs font-semibold uppercase text-slate-400">Standings</Text>
        {ranked.map((p) => (
          <View key={p.gamePlayerId} className="flex-row justify-between py-1">
            <Text className="text-white">
              {p.rank}. {p.displayName}
            </Text>
            <Text className="font-bold text-indigo-300">{p.total}</Text>
          </View>
        ))}
      </View>

      <ScrollView className="flex-1 px-2" horizontal>
        <ScrollView>
          <View className="flex-row">
            <View className="w-12 border-b border-slate-700 bg-slate-800 px-1 py-2">
              <Text className="text-xs font-bold text-slate-400">#</Text>
            </View>
            {players.map((p) => (
              <View
                key={p.id}
                className="w-20 items-center border-b border-slate-700 bg-slate-800 px-1 py-2"
              >
                <View className="mb-1 h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                  {p.displayName}
                </Text>
              </View>
            ))}
          </View>

          {scoreRows.map((row) => (
            <View key={row.round.id} className="flex-row border-b border-slate-800">
              <View className="w-12 justify-center px-1 py-3">
                <Text className="text-xs text-slate-400">{row.round.roundNumber}</Text>
              </View>
              {players.map((p) => {
                const s = row.scoresByPlayer[p.id];
                return (
                  <TouchableOpacity
                    key={p.id}
                    className="w-20 items-center py-3"
                    onPress={() => {
                      if (!s) return;
                      Alert.prompt(
                        'Edit Score',
                        `New score for ${p.displayName} in round ${row.round.roundNumber}:`,
                        (text) => {
                          const parsed = Number(text);
                          if (!text || isNaN(parsed)) return;
                          void updateScore(s.id, parsed).then(() => loadData());
                        },
                        'plain-text',
                        String(s.points),
                        'numeric',
                      );
                    }}
                  >
                    <Text className="text-sm text-white">{s ? s.points : '–'}</Text>
                    {s?.modifiers && (s.modifiers as Record<string, unknown>).doubled === true && (
                      <Text className="text-xs text-red-400">×2</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View className="flex-row bg-slate-800">
            <View className="w-12 justify-center px-1 py-3">
              <Text className="text-xs font-bold text-slate-400">Σ</Text>
            </View>
            {totals.map((t) => (
              <View key={t.gamePlayerId} className="w-20 items-center py-3">
                <Text className="text-sm font-bold text-indigo-300">{t.total}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {!gameOver && (
        <View className="gap-3 p-4">
          <TouchableOpacity
            className="items-center rounded-2xl bg-indigo-600 py-4"
            onPress={() => router.push(`/game/${id}/round`)}
          >
            <Text className="text-base font-bold text-white">+ Add Round</Text>
          </TouchableOpacity>
          {scoreRows.length > 0 && (
            <TouchableOpacity
              className="items-center rounded-2xl border border-slate-600 bg-slate-800 py-3"
              onPress={handleDeleteLast}
            >
              <Text className="text-sm text-slate-300">↩ Undo Last Round</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {gameOver && game.status !== 'completed' && (
        <View className="p-4">
          <TouchableOpacity
            className="items-center rounded-2xl border border-indigo-500 bg-slate-800 py-3"
            onPress={() => void finishGame(Number(id))}
          >
            <Text className="font-semibold text-indigo-300">Mark Complete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
