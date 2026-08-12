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
  if (config.roundCap !== undefined) return false;
  if (config.targetScore === undefined) return false;
  const target = config.targetScore;
  if (config.winCondition === 'highest') {
    return totals.some((p) => p.total >= target);
  }
  return totals.some((p) => p.total >= target);
}

function rank(
  totals: PlayerTotals[],
  winCondition: 'lowest' | 'highest' = 'highest',
): RankedPlayer[] {
  const sorted =
    winCondition === 'highest'
      ? [...totals].sort((a, b) => b.total - a.total)
      : [...totals].sort((a, b) => a.total - b.total);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

export const custom: GameRules = {
  slug: 'custom',
  name: 'Custom',
  defaultTargetScore: 100,
  winCondition: 'highest',
  minPlayers: 2,
  maxPlayers: 8,
  description: 'Custom scoring rules',
  icon: 'settings-outline',
  defaultConfig: {},
  scoreRound,
  isGameOver,
  rank(totals: PlayerTotals[]): RankedPlayer[] {
    return rank(totals, 'highest');
  },
};
