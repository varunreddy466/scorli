import { skyjo } from './skyjo';
import { rummy } from './rummy';
import { custom } from './custom';
import { phase10 } from './phase10';
import { rummy500 } from './rummy500';
import { hearts } from './hearts';
import { spades } from './spades';
import { canasta } from './canasta';
import { cribbage } from './cribbage';
import type { GameRules } from './types';

export type {
  GameRules,
  RoundInput,
  RoundResult,
  PlayerTotals,
  RankedPlayer,
  GameConfig,
  SpadesBidEntry,
} from './types';

const registry: Record<string, GameRules> = {
  skyjo,
  rummy,
  custom,
  'phase-10': phase10,
  'rummy-500': rummy500,
  hearts,
  spades,
  canasta,
  cribbage,
};

export function getGameRules(slug: string): GameRules {
  const rules = registry[slug];
  if (!rules) throw new Error(`Unknown game type: ${slug}`);
  return rules;
}

export function getAllGameTypes(): GameRules[] {
  return Object.values(registry);
}

export { skyjo, rummy, custom, phase10, rummy500, hearts, spades, canasta, cribbage };
