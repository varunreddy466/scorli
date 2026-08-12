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
  const threshold = typeof config.targetScore === 'number' ? config.targetScore : 500;
  return totals.some((p) => p.total >= threshold);
}

function rank(totals: PlayerTotals[]): RankedPlayer[] {
  const sorted = [...totals].sort((a, b) => b.total - a.total);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

export const rummy500: GameRules = {
  slug: 'rummy-500',
  name: 'Rummy 500',
  defaultTargetScore: 500,
  winCondition: 'highest',
  minPlayers: 2,
  maxPlayers: 8,
  description: 'First to 500 meld points wins',
  icon: 'albums-outline',
  scoreRound,
  isGameOver,
  rank,
};
