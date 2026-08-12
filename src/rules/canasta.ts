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
  const threshold = typeof config.targetScore === 'number' ? config.targetScore : 5000;
  return totals.some((p) => p.total >= threshold);
}

function rank(totals: PlayerTotals[]): RankedPlayer[] {
  const sorted = [...totals].sort((a, b) => b.total - a.total);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

export const canasta: GameRules = {
  slug: 'canasta',
  name: 'Canasta',
  defaultTargetScore: 5000,
  winCondition: 'highest',
  minPlayers: 2,
  maxPlayers: 6,
  description: 'First team to 5000 meld points wins',
  icon: 'shuffle-outline',
  scoreRound,
  isGameOver,
  rank,
};
