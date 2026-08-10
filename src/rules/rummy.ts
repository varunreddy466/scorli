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
  const threshold =
    typeof config.eliminationThreshold === 'number' ? config.eliminationThreshold : 200;
  return totals.some((p) => p.total >= threshold);
}

function rank(totals: PlayerTotals[]): RankedPlayer[] {
  const sorted = [...totals].sort((a, b) => a.total - b.total);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

export const rummy: GameRules = {
  slug: 'rummy',
  name: 'Rummy',
  defaultTargetScore: 200,
  winCondition: 'lowest',
  minPlayers: 2,
  maxPlayers: 6,
  scoreRound,
  isGameOver,
  rank,
};
