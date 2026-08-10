export interface RoundInput {
  scores: Record<number, number>;
  closerId?: number;
  config: GameConfig;
}

export interface RoundResult {
  points: Record<number, number>;
  modifiers: Record<number, Record<string, unknown>>;
}

export interface PlayerTotals {
  gamePlayerId: number;
  displayName: string;
  total: number;
}

export interface RankedPlayer extends PlayerTotals {
  rank: number;
}

export interface GameConfig {
  targetScore?: number;
  eliminationThreshold?: number;
  winCondition?: 'lowest' | 'highest';
  roundCap?: number;
  [key: string]: unknown;
}

export interface GameRules {
  slug: string;
  name: string;
  defaultTargetScore: number;
  winCondition: 'lowest' | 'highest';
  minPlayers: number;
  maxPlayers: number;
  scoreRound(input: RoundInput): RoundResult;
  isGameOver(totals: PlayerTotals[], config: GameConfig): boolean;
  rank(totals: PlayerTotals[]): RankedPlayer[];
}
