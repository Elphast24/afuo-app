import { describe, it, expect } from 'vitest';
import { MatchingService, DEFAULT_WEIGHTS } from '../../src/services/matching.service.js';
import { haversine } from '../../src/utils/haversine.js';
import { levenshtein } from '../../src/utils/levenshtein.js';

const service = new MatchingService();
// The scoring functions are private; tests reach them by bracket access (as in the project docs)
const s = service as any;

describe('calcProduceScore', () => {
  it('1.0 for an exact match, ignoring case and spaces', () => {
    expect(s.calcProduceScore('Tomatoes', 'tomatoes ')).toBe(1.0);
  });
  it('0.5 for a partial match either way round', () => {
    expect(s.calcProduceScore('Tomato', 'Tomatoes')).toBe(0.5);
    expect(s.calcProduceScore('Garden Eggs Fresh', 'Garden Eggs')).toBe(0.5);
  });
  it('0.3 for a near miss (edit distance <= 2)', () => {
    expect(s.calcProduceScore('Tomatos', 'Tomatoes')).toBe(0.3);
  });
  it('0.0 for no match', () => {
    expect(s.calcProduceScore('Mangoes', 'Tomatoes')).toBe(0.0);
  });
  it('0.5 when the buyer gave no produce', () => {
    expect(s.calcProduceScore(undefined, 'Tomatoes')).toBe(0.5);
  });
  it('0.3 for a typo that is not a substring', () => {
    expect(s.calcProduceScore('Maiz', 'Mais')).toBe(0.3);
  });
});

describe('calcQuantityScore', () => {
  it('neutral 0.7 when no quantity is requested', () => {
    expect(s.calcQuantityScore(undefined, 100)).toBe(0.7);
  });
  it('1.0 when supply equals demand', () => {
    expect(s.calcQuantityScore(200, 200)).toBe(1.0);
  });
  it('penalises large surpluses down to a floor of 0.3', () => {
    expect(s.calcQuantityScore(100, 200)).toBeCloseTo(0.85, 5);
    expect(s.calcQuantityScore(10, 10_000)).toBe(0.3);
  });
  it('is the fraction supplied when supply is short', () => {
    expect(s.calcQuantityScore(200, 50)).toBe(0.25);
  });
});

describe('calcLocationScore (Haversine tiers)', () => {
  it('1.0 for the same place', () => {
    expect(s.calcLocationScore(5.6037, -0.187, 5.6037, -0.187)).toBe(1.0);
  });
  it('0.5 when the buyer location is unknown', () => {
    expect(s.calcLocationScore(undefined, undefined, 5.6, -0.18)).toBe(0.5);
  });
  it('Accra to Tema (about 20 km) is the 0.9 tier', () => {
    expect(s.calcLocationScore(5.6037, -0.187, 5.6698, -0.0166)).toBe(0.9);
  });
  it('Accra to Kumasi (about 200 km) is in the 0.35 or 0.15 tier', () => {
    const score = s.calcLocationScore(5.6037, -0.187, 6.6885, -1.6244);
    expect([0.35, 0.15]).toContain(score);
  });
  it('Accra to Tamale (about 500 km) is 0.15 or 0.05', () => {
    const score = s.calcLocationScore(5.6037, -0.187, 9.4034, -0.8424);
    expect([0.15, 0.05]).toContain(score);
  });
  it('treats a longitude of 0 as a real coordinate', () => {
    expect(s.calcLocationScore(5.6, 0, 5.6, 0)).toBe(1.0);
  });
});

describe('calcPriceScore', () => {
  it('neutral when no budget', () => {
    expect(s.calcPriceScore(undefined, 50)).toBe(0.7);
  });
  it('scores 1.0 at budget, easing to a floor of 0.5 as the price falls well below it (per the documented formula)', () => {
    expect(s.calcPriceScore(100, 100)).toBe(1.0);
    expect(s.calcPriceScore(100, 50)).toBeCloseTo(0.875, 5);
    expect(s.calcPriceScore(100, 0.01)).toBeGreaterThanOrEqual(0.5);
  });
  it('drops quickly over budget and bottoms out at 0', () => {
    expect(s.calcPriceScore(100, 110)).toBeCloseTo(0.85, 5);
    expect(s.calcPriceScore(100, 200)).toBe(0);
  });
});

describe('calcAvailabilityScore', () => {
  const from = new Date('2026-03-10');
  const to = new Date('2026-03-31');
  it('neutral without a needed-by date', () => {
    expect(s.calcAvailabilityScore(null, from, to)).toBe(0.7);
  });
  it('1.0 inside the window', () => {
    expect(s.calcAvailabilityScore(new Date('2026-03-15'), from, to)).toBe(1.0);
  });
  it('decays with the gap in days', () => {
    expect(s.calcAvailabilityScore(new Date('2026-03-08'), from, to)).toBe(0.85); // 2 days before
    expect(s.calcAvailabilityScore(new Date('2026-04-05'), from, to)).toBe(0.65); // 5 days after
    expect(s.calcAvailabilityScore(new Date('2026-06-01'), from, to)).toBe(0.05);
  });
});

describe('classifyTier', () => {
  it('maps scores to the documented tiers', () => {
    expect(s.classifyTier(0.8)).toBe('EXCELLENT');
    expect(s.classifyTier(0.79)).toBe('GOOD');
    expect(s.classifyTier(0.6)).toBe('GOOD');
    expect(s.classifyTier(0.59)).toBe('FAIR');
    expect(s.classifyTier(0.4)).toBe('FAIR');
    expect(s.classifyTier(0.39)).toBe('POOR');
  });
});

describe('normalizeWeights', () => {
  it('defaults sum to 1', () => {
    const w = service.normalizeWeights();
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
    expect(w.produce).toBeCloseTo(0.3, 3);
  });
  it('rescales any scale to sum 1', () => {
    const w = service.normalizeWeights({ produce: 1, quantity: 1, location: 1, price: 1, availability: 1 });
    expect(w.produce).toBeCloseTo(0.2, 3);
  });
  it('merges a partial override with defaults', () => {
    const w = service.normalizeWeights({ price: 100 });
    expect(w.price).toBeGreaterThan(w.produce);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
  });
  it('treats negatives as 0 and falls back to defaults when all are 0', () => {
    expect(service.normalizeWeights({ produce: -5 }).produce).toBe(0);
    const zero = service.normalizeWeights({ produce: 0, quantity: 0, location: 0, price: 0, availability: 0 });
    expect(zero.produce).toBeCloseTo(DEFAULT_WEIGHTS.produce / 100, 3);
  });
});

describe('utils', () => {
  it('haversine: Accra to Kumasi is roughly 200 km', () => {
    const d = haversine(5.6037, -0.187, 6.6885, -1.6244);
    expect(d).toBeGreaterThan(190);
    expect(d).toBeLessThan(210);
  });
  it('levenshtein', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
});
