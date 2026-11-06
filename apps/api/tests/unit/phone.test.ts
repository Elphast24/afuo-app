import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../../src/utils/phone.js';
import { durationToSeconds } from '../../src/config/index.js';
import { findCity } from '../../src/utils/ghana.js';
import { inferCategory } from '../../src/utils/categories.js';

describe('normalizePhone (Ghana)', () => {
  it.each([
    ['0241234567', '+233241234567'],
    ['024 123 4567', '+233241234567'],
    ['24-123-4567', '+233241234567'],
    ['233241234567', '+233241234567'],
    ['+233 24 123 4567', '+233241234567'],
    ['00233241234567', '+233241234567'],
    ['(050) 123 4567', '+233501234567'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['0712345678', '+254712345678', '12345', '02412345', '0241234567890', 'abcdefghij'])(
    'rejects %s',
    (input) => {
      expect(() => normalizePhone(input)).toThrow(/Invalid phone number/);
    }
  );
});

describe('helpers', () => {
  it('durationToSeconds', () => {
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('7d')).toBe(604800);
    expect(durationToSeconds('30')).toBe(30);
    expect(() => durationToSeconds('soon')).toThrow();
  });
  it('findCity is case-insensitive and Ghana only', () => {
    expect(findCity('kumasi')?.region).toBe('Ashanti');
    expect(findCity('Nairobi')).toBeUndefined();
  });
  it('inferCategory', () => {
    expect(inferCategory('Tomatoes')).toBe('VEGETABLES');
    expect(inferCategory(' maize ')).toBe('GRAINS');
    expect(inferCategory('Dragon fruit')).toBe('OTHER');
  });
});
