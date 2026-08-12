import type {
  GameRules,
  RoundInput,
  RoundResult,
  PlayerTotals,
  RankedPlayer,
  GameConfig,
} from './types';

function scoreRound(input: RoundInput): RoundResult {
  const { scores } = input;
  const points: Record<number, number> = { ...scores };
  const modifiers: Record<number, Record<string, unknown>> = {};

  for (const id of Object.keys(scores).map(Number)) {
    const advancedPhase = (input.config[`phase_advance_${id}`] as boolean) ?? false;
    modifiers[id] = { advancedPhase };
  }

  return { points, modifiers };
}

function isGameOver(_totals: PlayerTotals[], config: GameConfig): boolean {
  const phases = config.phases as Record<number, number> | undefined;
  if (!phases) return false;
  return Object.values(phases).some((p) => p >= 10);
}

function rank(totals: PlayerTotals[]): RankedPlayer[] {
  // Primary: higher phase first (from config.phases stored externally).
  // In the base rank call we only have totals; sort by lowest points as tiebreaker.
  const sorted = [...totals].sort((a, b) => a.total - b.total);
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

export const phase10: GameRules = {
  slug: 'phase-10',
  name: 'Phase 10',
  defaultTargetScore: 0,
  winCondition: 'lowest',
  minPlayers: 2,
  maxPlayers: 6,
  description: 'Complete all 10 phases; lowest points breaks ties',
  icon: 'list-outline',
  scoreRound,
  isGameOver,
  rank,
};
