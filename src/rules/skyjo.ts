import type {
  GameRules,
  RoundInput,
  RoundResult,
  PlayerTotals,
  RankedPlayer,
  GameConfig,
} from './types';

function scoreRound(input: RoundInput): RoundResult {
  const { scores, closerId, config } = input;
  const threshold = typeof config.targetScore === 'number' ? config.targetScore : 100;
  const playerIds = Object.keys(scores).map(Number);

  const points: Record<number, number> = { ...scores };
  const modifiers: Record<number, Record<string, unknown>> = {};

  if (closerId !== undefined && closerId !== null) {
    const closerScore = scores[closerId];
    const otherScores = playerIds.filter((id) => id !== closerId).map((id) => scores[id]);

    const closerIsStrictlyLowest =
      otherScores.length > 0 && otherScores.every((s) => closerScore < s);

    if (!closerIsStrictlyLowest && closerScore > 0) {
      points[closerId] = closerScore * 2;
      modifiers[closerId] = {
        doubled: true,
        originalScore: closerScore,
        reason: 'closer_not_lowest',
      };
    } else {
      modifiers[closerId] = { doubled: false, closed: true };
    }
  }

  void threshold;
  return { points, modifiers };
}

function isGameOver(totals: PlayerTotals[], config: GameConfig): boolean {
  const threshold = typeof config.targetScore === 'number' ? config.targetScore : 100;
  return totals.some((p) => p.total >= threshold);
}

function rank(totals: PlayerTotals[]): RankedPlayer[] {
  const sorted = [...totals].sort((a, b) => a.total - b.total);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

export const skyjo: GameRules = {
  slug: 'skyjo',
  name: 'Skyjo',
  defaultTargetScore: 100,
  winCondition: 'lowest',
  minPlayers: 2,
  maxPlayers: 8,
  scoreRound,
  isGameOver,
  rank,
};
