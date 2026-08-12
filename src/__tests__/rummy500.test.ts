import { rummy500 } from '../rules/rummy500';

describe('Rummy 500 rules', () => {
  describe('scoreRound', () => {
    it('accepts negative round scores', () => {
      const result = rummy500.scoreRound({ scores: { 1: -25, 2: 40 }, config: {} });
      expect(result.points[1]).toBe(-25);
      expect(result.points[2]).toBe(40);
    });

    it('accepts zero scores', () => {
      const result = rummy500.scoreRound({ scores: { 1: 0 }, config: {} });
      expect(result.points[1]).toBe(0);
    });
  });

  describe('isGameOver', () => {
    it('returns true when any player reaches default 500', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 500 },
        { gamePlayerId: 2, displayName: 'B', total: 200 },
      ];
      expect(rummy500.isGameOver(totals, {})).toBe(true);
    });

    it('returns false when nobody reaches 500', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 499 },
        { gamePlayerId: 2, displayName: 'B', total: -10 },
      ];
      expect(rummy500.isGameOver(totals, {})).toBe(false);
    });

    it('totals can go below zero', () => {
      const totals = [{ gamePlayerId: 1, displayName: 'A', total: -50 }];
      expect(rummy500.isGameOver(totals, {})).toBe(false);
    });
  });

  describe('rank', () => {
    it('ranks highest total first', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 200 },
        { gamePlayerId: 2, displayName: 'B', total: 450 },
      ];
      const ranked = rummy500.rank(totals);
      expect(ranked[0].gamePlayerId).toBe(2);
    });
  });
});
