import type {
  GameRules,
  RoundInput,
  RoundResult,
  PlayerTotals,
  RankedPlayer,
  GameConfig,
} from './types';

const MOON_TOTAL = 26;

function scoreRound(input: RoundInput): RoundResult {
  const { scores } = input;
  const playerIds = Object.keys(scores).map(Number);
  const roundTotal = playerIds.reduce((sum, id) => sum + scores[id], 0);

  const points: Record<number, number> = {};
  const modifiers: Record<number, Record<string, unknown>> = {};

  if (roundTotal !== MOON_TOTAL) {
    // Record mismatch but don't throw; pass through scores as-is
    for (const id of playerIds) {
      points[id] = scores[id];
      modifiers[id] = { roundTotalMismatch: true, roundTotal };
    }
    return { points, modifiers };
  }

  const moonShooter = playerIds.find((id) => scores[id] === MOON_TOTAL);

  if (moonShooter !== undefined) {
    // Moon shooter scores 0; everyone else gets 26
    for (const id of playerIds) {
      if (id === moonShooter) {
        points[id] = 0;
        modifiers[id] = { shotTheMoon: true };
      } else {
        points[id] = MOON_TOTAL;
        modifiers[id] = { moonPenalty: true };
      }
    }
  } else {
    for (const id of playerIds) {
      points[id] = scores[id];
      modifiers[id] = {};
    }
  }

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

export const hearts: GameRules = {
  slug: 'hearts',
  name: 'Hearts',
  defaultTargetScore: 100,
  winCondition: 'lowest',
  minPlayers: 3,
  maxPlayers: 6,
  description: 'Avoid penalty cards; lowest total wins',
  icon: 'heart-outline',
  scoreRound,
  isGameOver,
  rank,
};
