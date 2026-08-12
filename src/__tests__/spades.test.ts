import { spades } from '../rules/spades';
import type { GameConfig } from '../rules/types';

describe('Spades rules', () => {
  describe('scoreRound', () => {
    it('scores a made bid correctly', () => {
      const result = spades.scoreRound({
        scores: {},
        entries: { 1: { bid: 3, tricks: 3 } },
        config: {},
      });
      expect(result.points[1]).toBe(30); // 10 * 3
      expect((result.modifiers[1] as Record<string, unknown>).madeBid).toBe(true);
    });

    it('awards bags for overtricks', () => {
      const result = spades.scoreRound({
        scores: {},
        entries: { 1: { bid: 3, tricks: 5 } },
        config: {},
      });
      expect(result.points[1]).toBe(32); // 10 * 3 + 2 bags
      expect((result.modifiers[1] as Record<string, unknown>).bags).toBe(2);
    });

    it('penalises a failed bid', () => {
      const result = spades.scoreRound({
        scores: {},
        entries: { 1: { bid: 4, tricks: 2 } },
        config: {},
      });
      expect(result.points[1]).toBe(-40); // -10 * 4
      expect((result.modifiers[1] as Record<string, unknown>).failedBid).toBe(true);
    });

    it('awards +100 for a successful nil bid', () => {
      const result = spades.scoreRound({
        scores: {},
        entries: { 1: { bid: 0, tricks: 0 } },
        config: {},
      });
      expect(result.points[1]).toBe(100);
      expect((result.modifiers[1] as Record<string, unknown>).nilSuccess).toBe(true);
    });

    it('penalises -100 for a failed nil bid', () => {
      const result = spades.scoreRound({
        scores: {},
        entries: { 1: { bid: 0, tricks: 2 } },
        config: {},
      });
      expect(result.points[1]).toBe(-100);
      expect((result.modifiers[1] as Record<string, unknown>).nilFail).toBe(true);
    });

    it('fires -100 bag penalty when cumulative bags reach 10', () => {
      const config: GameConfig = { cumulativeBags: { 1: 8 } };
      const result = spades.scoreRound({
        scores: {},
        entries: { 1: { bid: 3, tricks: 5 } }, // 2 bags -> cumulative = 10
        config,
      });
      // 10*3 + 2 bags - 100 bag penalty = -68
      expect(result.points[1]).toBe(-68);
      expect((result.modifiers[1] as Record<string, unknown>).bagPenaltyFired).toBe(true);
    });
  });

  describe('isGameOver', () => {
    it('returns true when any player reaches 500', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 500 },
        { gamePlayerId: 2, displayName: 'B', total: 300 },
      ];
      expect(spades.isGameOver(totals, {})).toBe(true);
    });
  });
});
