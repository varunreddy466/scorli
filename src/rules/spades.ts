import type {
  GameRules,
  RoundInput,
  RoundResult,
  PlayerTotals,
  RankedPlayer,
  GameConfig,
} from './types';

const BAG_PENALTY_THRESHOLD = 10;
const BAG_PENALTY = -100;
const NIL_BID = 0;
const NIL_SUCCESS_BONUS = 100;
const NIL_FAIL_PENALTY = -100;
const BID_MULTIPLIER = 10;
const FAIL_MULTIPLIER = -10;

function scoreRound(input: RoundInput): RoundResult {
  const { entries, config } = input;
  const points: Record<number, number> = {};
  const modifiers: Record<number, Record<string, unknown>> = {};

  if (!entries) {
    // Fallback: pass through scores
    for (const [k, v] of Object.entries(input.scores)) {
      points[Number(k)] = v;
      modifiers[Number(k)] = {};
    }
    return { points, modifiers };
  }

  const cumulativeBags = (config.cumulativeBags as Record<number, number> | undefined) ?? {};

  for (const [key, entry] of Object.entries(entries)) {
    const id = Number(key);
    const { bid, tricks } = entry;

    let roundPoints = 0;
    let bags = 0;
    let nilSuccess = false;
    let nilFail = false;
    let madeBid = false;
    let failedBid = false;
    let bagPenaltyFired = false;

    if (bid === NIL_BID) {
      if (tricks === 0) {
        roundPoints = NIL_SUCCESS_BONUS;
        nilSuccess = true;
      } else {
        roundPoints = NIL_FAIL_PENALTY;
        nilFail = true;
      }
    } else if (tricks >= bid) {
      bags = tricks - bid;
      roundPoints = BID_MULTIPLIER * bid + bags;
      madeBid = true;
    } else {
      roundPoints = FAIL_MULTIPLIER * bid;
      failedBid = true;
    }

    const prevBags = cumulativeBags[id] ?? 0;
    const newBags = prevBags + bags;
    const bagPenalties =
      Math.floor(newBags / BAG_PENALTY_THRESHOLD) - Math.floor(prevBags / BAG_PENALTY_THRESHOLD);
    if (bagPenalties > 0) {
      roundPoints += bagPenalties * BAG_PENALTY;
      bagPenaltyFired = true;
    }

    points[id] = roundPoints;
    modifiers[id] = {
      bid,
      tricks,
      bags,
      cumulativeBags: newBags,
      madeBid,
      failedBid,
      nilSuccess,
      nilFail,
      bagPenaltyFired,
    };
  }

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

export const spades: GameRules = {
  slug: 'spades',
  name: 'Spades',
  defaultTargetScore: 500,
  winCondition: 'highest',
  minPlayers: 4,
  maxPlayers: 4,
  description: 'Bid and win tricks; first to 500 wins',
  icon: 'navigate-outline',
  scoreRound,
  isGameOver,
  rank,
};
