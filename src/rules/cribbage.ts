import type {
  GameRules,
  RoundInput,
  RoundResult,
  PlayerTotals,
  RankedPlayer,
  GameConfig,
} from './types';

function scoreRound(input: RoundInput): RoundResult {
  const points: Record<number, number> = { ...input.scores };
  const modifiers: Record<number, Record<string, unknown>> = {};
  return { points, modifiers };
}

function isGameOver(totals: PlayerTotals[], config: GameConfig): boolean {
  const threshold = typeof config.targetScore === 'number' ? config.targetScore : 121;
  return totals.some((p) => p.total >= threshold);
}

function rank(totals: PlayerTotals[]): RankedPlayer[] {
  const sorted = [...totals].sort((a, b) => b.total - a.total);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

export const cribbage: GameRules = {
  slug: 'cribbage',
  name: 'Cribbage',
  defaultTargetScore: 121,
  winCondition: 'highest',
  minPlayers: 2,
  maxPlayers: 4,
  description: 'Race to 121 pegging points',
  icon: 'stats-chart-outline',
  scoreRound,
  isGameOver,
  rank,
};
