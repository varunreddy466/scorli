import { hearts } from '../rules/hearts';

describe('Hearts rules', () => {
  describe('scoreRound - normal play', () => {
    it('passes through valid scores summing to 26', () => {
      const result = hearts.scoreRound({ scores: { 1: 5, 2: 10, 3: 11 }, config: {} });
      expect(result.points[1]).toBe(5);
      expect(result.points[2]).toBe(10);
      expect(result.points[3]).toBe(11);
    });

    it('records mismatch when total != 26', () => {
      const result = hearts.scoreRound({ scores: { 1: 5, 2: 10, 3: 5 }, config: {} });
      expect((result.modifiers[1] as Record<string, unknown>).roundTotalMismatch).toBe(true);
      // Still passes through the original scores
      expect(result.points[1]).toBe(5);
    });
  });

  describe('scoreRound - shooting the moon', () => {
    it('shooter scores 0 and everyone else gets 26', () => {
      const result = hearts.scoreRound({ scores: { 1: 26, 2: 0, 3: 0, 4: 0 }, config: {} });
      expect(result.points[1]).toBe(0);
      expect(result.points[2]).toBe(26);
      expect(result.points[3]).toBe(26);
      expect(result.points[4]).toBe(26);
      expect((result.modifiers[1] as Record<string, unknown>).shotTheMoon).toBe(true);
      expect((result.modifiers[2] as Record<string, unknown>).moonPenalty).toBe(true);
    });
  });

  describe('isGameOver', () => {
    it('returns true when any player reaches 100', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 100 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      expect(hearts.isGameOver(totals, {})).toBe(true);
    });

    it('returns false when nobody reaches 100', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 99 },
        { gamePlayerId: 2, displayName: 'B', total: 60 },
      ];
      expect(hearts.isGameOver(totals, {})).toBe(false);
    });
  });

  describe('rank', () => {
    it('ranks lowest total first', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 40 },
        { gamePlayerId: 2, displayName: 'B', total: 15 },
      ];
      const ranked = hearts.rank(totals);
      expect(ranked[0].gamePlayerId).toBe(2);
    });
  });
});
