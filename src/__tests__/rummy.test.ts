import { rummy } from '../rules/rummy';

describe('Rummy rules', () => {
  describe('isGameOver', () => {
    it('returns true when player reaches default 200 threshold', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 200 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      expect(rummy.isGameOver(totals, {})).toBe(true);
    });

    it('returns false when nobody reaches 200', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 199 },
        { gamePlayerId: 2, displayName: 'B', total: 150 },
      ];
      expect(rummy.isGameOver(totals, {})).toBe(false);
    });

    it('respects custom eliminationThreshold', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 100 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      expect(rummy.isGameOver(totals, { eliminationThreshold: 100 })).toBe(true);
    });
  });

  describe('scoreRound', () => {
    it('passes through scores as-is', () => {
      const result = rummy.scoreRound({
        scores: { 1: 30, 2: 0, 3: 15 },
        config: {},
      });
      expect(result.points[1]).toBe(30);
      expect(result.points[2]).toBe(0);
      expect(result.points[3]).toBe(15);
    });
  });

  describe('rank', () => {
    it('ranks by ascending total', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 100 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      const ranked = rummy.rank(totals);
      expect(ranked[0].gamePlayerId).toBe(2);
    });
  });
});
