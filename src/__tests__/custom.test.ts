import { custom } from '../rules/custom';

describe('Custom rules', () => {
  describe('isGameOver', () => {
    it('returns false when no targetScore configured', () => {
      const totals = [{ gamePlayerId: 1, displayName: 'A', total: 999 }];
      expect(custom.isGameOver(totals, {})).toBe(false);
    });

    it('returns true when player reaches targetScore (highest)', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 100 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      expect(custom.isGameOver(totals, { targetScore: 100, winCondition: 'highest' })).toBe(true);
    });
  });

  describe('scoreRound', () => {
    it('passes scores through unchanged', () => {
      const result = custom.scoreRound({ scores: { 1: 10, 2: 20 }, config: {} });
      expect(result.points[1]).toBe(10);
      expect(result.points[2]).toBe(20);
    });
  });

  describe('rank', () => {
    it('ranks highest score first by default', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 30 },
        { gamePlayerId: 2, displayName: 'B', total: 80 },
      ];
      const ranked = custom.rank(totals);
      expect(ranked[0].gamePlayerId).toBe(2);
    });
  });
});
