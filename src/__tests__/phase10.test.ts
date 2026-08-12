import { phase10 } from '../rules/phase10';
import type { GameConfig, PlayerTotals } from '../rules/types';

describe('Phase 10 rules', () => {
  describe('scoreRound', () => {
    it('records advancedPhase true when config flag set', () => {
      const result = phase10.scoreRound({
        scores: { 1: 15, 2: 30 },
        config: { phase_advance_1: true } as GameConfig,
      });
      expect(result.points[1]).toBe(15);
      expect((result.modifiers[1] as Record<string, unknown>).advancedPhase).toBe(true);
      expect((result.modifiers[2] as Record<string, unknown>).advancedPhase).toBe(false);
    });

    it('records advancedPhase false when config flag not set', () => {
      const result = phase10.scoreRound({ scores: { 1: 20 }, config: {} });
      expect((result.modifiers[1] as Record<string, unknown>).advancedPhase).toBe(false);
    });
  });

  describe('isGameOver', () => {
    it('returns false when no phases in config', () => {
      const totals: PlayerTotals[] = [{ gamePlayerId: 1, displayName: 'A', total: 100 }];
      expect(phase10.isGameOver(totals, {})).toBe(false);
    });

    it('returns false when no player has reached phase 10', () => {
      const totals: PlayerTotals[] = [{ gamePlayerId: 1, displayName: 'A', total: 50 }];
      expect(phase10.isGameOver(totals, { phases: { 1: 9 } } as GameConfig)).toBe(false);
    });

    it('returns true when any player has completed phase 10', () => {
      const totals: PlayerTotals[] = [
        { gamePlayerId: 1, displayName: 'A', total: 50 },
        { gamePlayerId: 2, displayName: 'B', total: 30 },
      ];
      expect(phase10.isGameOver(totals, { phases: { 1: 9, 2: 10 } } as GameConfig)).toBe(true);
    });
  });

  describe('rank', () => {
    it('ranks by lowest total (points-as-tiebreaker)', () => {
      const totals: PlayerTotals[] = [
        { gamePlayerId: 1, displayName: 'A', total: 80 },
        { gamePlayerId: 2, displayName: 'B', total: 30 },
        { gamePlayerId: 3, displayName: 'C', total: 50 },
      ];
      const ranked = phase10.rank(totals);
      expect(ranked[0].gamePlayerId).toBe(2);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[2].gamePlayerId).toBe(1);
    });
  });
});
