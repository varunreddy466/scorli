import { skyjo } from '../rules/skyjo';
import type { RoundInput } from '../rules/types';

describe('Skyjo rules', () => {
  describe('scoreRound', () => {
    it('does not double when closer has strictly lowest score', () => {
      const input: RoundInput = {
        scores: { 1: 3, 2: 7, 3: 10 },
        closerId: 1,
        config: {},
      };
      const result = skyjo.scoreRound(input);
      expect(result.points[1]).toBe(3);
      expect((result.modifiers[1] as Record<string, unknown>).doubled).toBe(false);
    });

    it('doubles closer score when NOT strictly lowest and > 0', () => {
      const input: RoundInput = {
        scores: { 1: 5, 2: 3, 3: 10 },
        closerId: 1,
        config: {},
      };
      const result = skyjo.scoreRound(input);
      expect(result.points[1]).toBe(10);
      expect((result.modifiers[1] as Record<string, unknown>).doubled).toBe(true);
    });

    it('does NOT double when closer score is 0', () => {
      const input: RoundInput = {
        scores: { 1: 0, 2: 5, 3: 8 },
        closerId: 1,
        config: {},
      };
      const result = skyjo.scoreRound(input);
      expect(result.points[1]).toBe(0);
      expect((result.modifiers[1] as Record<string, unknown>).doubled).toBe(false);
    });

    it('does NOT double when closer score is negative', () => {
      const input: RoundInput = {
        scores: { 1: -2, 2: 5, 3: 8 },
        closerId: 1,
        config: {},
      };
      const result = skyjo.scoreRound(input);
      expect(result.points[1]).toBe(-2);
      expect((result.modifiers[1] as Record<string, unknown>).doubled).toBe(false);
    });

    it('does NOT double when closer ties for lowest', () => {
      const input: RoundInput = {
        scores: { 1: 3, 2: 3, 3: 10 },
        closerId: 1,
        config: {},
      };
      const result = skyjo.scoreRound(input);
      expect(result.points[1]).toBe(6);
      expect((result.modifiers[1] as Record<string, unknown>).doubled).toBe(true);
    });

    it('does not affect non-closer players', () => {
      const input: RoundInput = {
        scores: { 1: 5, 2: 3, 3: 10 },
        closerId: 1,
        config: {},
      };
      const result = skyjo.scoreRound(input);
      expect(result.points[2]).toBe(3);
      expect(result.points[3]).toBe(10);
    });

    it('works without closerId', () => {
      const input: RoundInput = {
        scores: { 1: 5, 2: 3 },
        config: {},
      };
      const result = skyjo.scoreRound(input);
      expect(result.points[1]).toBe(5);
      expect(result.points[2]).toBe(3);
    });
  });

  describe('isGameOver', () => {
    it('returns true when any player reaches default 100', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 100 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      expect(skyjo.isGameOver(totals, {})).toBe(true);
    });

    it('returns false when nobody reaches 100', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 99 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      expect(skyjo.isGameOver(totals, {})).toBe(false);
    });

    it('respects custom targetScore', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 80 },
        { gamePlayerId: 2, displayName: 'B', total: 50 },
      ];
      expect(skyjo.isGameOver(totals, { targetScore: 75 })).toBe(true);
    });
  });

  describe('rank', () => {
    it('ranks by ascending total (lowest wins)', () => {
      const totals = [
        { gamePlayerId: 1, displayName: 'A', total: 50 },
        { gamePlayerId: 2, displayName: 'B', total: 20 },
        { gamePlayerId: 3, displayName: 'C', total: 80 },
      ];
      const ranked = skyjo.rank(totals);
      expect(ranked[0].gamePlayerId).toBe(2);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[2].gamePlayerId).toBe(3);
    });
  });
});
