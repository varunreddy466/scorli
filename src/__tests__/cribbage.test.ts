import { cribbage } from '../rules/cribbage';

describe('Cribbage rules', () => {
  describe('isGameOver', () => {
    it('returns true the moment a player reaches 121', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 121 },
        { gamePlayerId: 2, displayName: 'B', total: 80 },
      ];
      expect(cribbage.isGameOver(totals, {})).toBe(true);
    });

    it('returns true even when winner is trailing on display order', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 115 },
        { gamePlayerId: 2, displayName: 'B', total: 121 },
      ];
      expect(cribbage.isGameOver(totals, {})).toBe(true);
    });

    it('returns false when nobody has reached 121', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 120 },
        { gamePlayerId: 2, displayName: 'B', total: 100 },
      ];
      expect(cribbage.isGameOver(totals, {})).toBe(false);
    });
  });

  describe('rank', () => {
    it('ranks highest total first', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 100 },
        { gamePlayerId: 2, displayName: 'B', total: 121 },
      ];
      const ranked = cribbage.rank(totals);
      expect(ranked[0].gamePlayerId).toBe(2);
    });
  });
});
