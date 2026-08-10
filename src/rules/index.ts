import { skyjo } from './skyjo';
import { rummy } from './rummy';
import { custom } from './custom';
import type { GameRules } from './types';

export type {
  GameRules,
  RoundInput,
  RoundResult,
  PlayerTotals,
  RankedPlayer,
  GameConfig,
} from './types';

const registry: Record<string, GameRules> = {
  skyjo,
  rummy,
  custom,
};

export function getGameRules(slug: string): GameRules {
  const rules = registry[slug];
  if (!rules) throw new Error(`Unknown game type: ${slug}`);
  return rules;
}

export function getAllGameTypes(): GameRules[] {
  return Object.values(registry);
}

export { skyjo, rummy, custom };
