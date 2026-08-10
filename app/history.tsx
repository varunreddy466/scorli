import { View, Text, FlatList } from 'react-native';
import { useEffect, useState } from 'react';
import { db } from '@/db/client';
import { gamePlayers, scores, rounds, gameTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { useGameStore } from '@/store/gameStore';
import { getGameRules } from '@/rules';
import type { Game, GameType, GamePlayer } from '@/db/schema';

interface GameSummary {
  game: Game;
  gameType: GameType;
  players: GamePlayer[];
  winner: string;
}

export default function HistoryScreen() {
  const completedGames = useGameStore((s) => s.completedGames);
  const [summaries, setSummaries] = useState<GameSummary[]>([]);

  useEffect(() => {
    (async () => {
      const result: GameSummary[] = [];
      for (const g of completedGames) {
        const [gt] = await db.select().from(gameTypes).where(eq(gameTypes.id, g.gameTypeId));
        if (!gt) continue;

        const ps = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, g.id));
        const allScores = await db
          .select()
          .from(scores)
          .innerJoin(rounds, eq(scores.roundId, rounds.id))
          .where(eq(rounds.gameId, g.id));

        const totals = ps.map((p) => ({
          gamePlayerId: p.id,
          displayName: p.displayName,
          total: allScores
            .filter((s) => s.scores.gamePlayerId === p.id)
            .reduce((sum, s) => sum + s.scores.points, 0),
        }));

        const rules = getGameRules(gt.slug);
        const ranked = rules.rank(totals);

        result.push({
          game: g,
          gameType: gt,
          players: ps,
          winner: ranked[0]?.displayName ?? 'Unknown',
        });
      }
      setSummaries(result);
    })();
  }, [completedGames]);

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="mb-4 text-2xl font-bold text-slate-100">History</Text>
      {summaries.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-slate-400">No completed games yet.</Text>
        </View>
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={(item) => String(item.game.id)}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-xl bg-slate-800 p-4">
              <Text className="font-semibold text-white">
                {item.gameType.name} — Game #{item.game.id}
              </Text>
              <Text className="text-sm text-indigo-300">🏆 {item.winner}</Text>
              <Text className="mt-1 text-xs text-slate-400">
                {item.players.map((p) => p.displayName).join(', ')}
              </Text>
              {item.game.endedAt && (
                <Text className="mt-1 text-xs text-slate-500">
                  {new Date(item.game.endedAt).toLocaleDateString()}
                </Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
