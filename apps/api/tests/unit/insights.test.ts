import { describe, expect, it } from 'vitest';
import {
  buildBalance,
  buildInsights,
  buildMatrix,
  weekChangePct,
  type ListingRow,
  type MonthRow,
  type Pulse,
} from '../../src/services/insights.js';

const row = (produceType: string, location: string, pricePerUnit: number, over: Partial<ListingRow> = {}): ListingRow => ({
  produceType,
  unit: 'KG',
  location,
  pricePerUnit,
  isOrganic: false,
  ...over,
});

const quiet: Pulse = { newToday: 0, newYesterday: 0, newThisWeek: 0, newLastWeek: 0 };

describe('buildMatrix', () => {
  const rows = [
    row('Tomatoes', 'Accra', 20),
    row('Tomatoes', 'Accra', 30),
    row('Tomatoes', 'Kumasi', 10),
    row('Maize', 'Kumasi', 5),
  ];

  it('averages price per produce and town, with null where nothing is listed', () => {
    const m = buildMatrix(rows);
    expect(m.towns).toEqual(['Accra', 'Kumasi']); // Accra has 2 listings, Kumasi 2: tie broken by name
    const tomatoes = m.rows[0];
    expect(tomatoes).toMatchObject({ produce: 'Tomatoes', unit: 'KG', avgPrice: 20 });
    expect(tomatoes.cells).toEqual([
      { location: 'Accra', avgPrice: 25, count: 2 },
      { location: 'Kumasi', avgPrice: 10, count: 1 },
    ]);
    expect(m.rows[1].cells[0]).toEqual({ location: 'Accra', avgPrice: null, count: 0 });
  });

  it('keeps different units of the same produce apart', () => {
    const m = buildMatrix([row('Tomatoes', 'Accra', 20), row('Tomatoes', 'Accra', 300, { unit: 'CRATES' })]);
    expect(m.rows).toHaveLength(2);
  });

  it('limits rows and towns', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F'].map((p, i) => row(p, `Town${i}`, 1));
    const m = buildMatrix(many, 4, 3);
    expect(m.rows).toHaveLength(4);
    expect(m.towns).toHaveLength(3);
  });
});

describe('buildBalance', () => {
  it('counts listings at or below their own produce average; singles cannot be compared', () => {
    const b = buildBalance([row('Tomatoes', 'Accra', 10), row('Tomatoes', 'Accra', 20), row('Tomatoes', 'Accra', 30), row('Okra', 'Accra', 99)]);
    expect(b).toEqual({ total: 4, considered: 3, atOrBelow: 2, above: 1, sharePct: 67 });
  });

  it('has no share when nothing is comparable', () => {
    expect(buildBalance([row('Okra', 'Accra', 5)]).sharePct).toBeNull();
    expect(buildBalance([]).sharePct).toBeNull();
  });
});

describe('buildInsights', () => {
  it('names the cheapest town when it is 10%+ under the average (3+ listings, 2+ towns)', () => {
    const rows = [row('Tomatoes', 'Kumasi', 8), row('Tomatoes', 'Accra', 14), row('Tomatoes', 'Accra', 14)];
    const i = buildInsights(rows, [], quiet).find((x) => x.kind === 'cheapest-town')!;
    expect(i.title).toBe('Tomatoes is cheapest in Kumasi');
    expect(i.tone).toBe('good');
    expect(i.detail).toContain('GHS 8 per kg');
    expect(i.detail).toContain('33% under'); // avg is 12, Kumasi is 8
  });

  it('does not claim a cheapest town from too little data', () => {
    const rows = [row('Tomatoes', 'Kumasi', 8), row('Tomatoes', 'Accra', 14)];
    expect(buildInsights(rows, [], quiet).some((x) => x.kind === 'cheapest-town')).toBe(false);
  });

  it('reports the biggest month-on-month move and ignores small ones', () => {
    const months: MonthRow[] = [
      { produceType: 'Maize', unit: 'KG', month: 'previous', avgPrice: 10, listings: 2 },
      { produceType: 'Maize', unit: 'KG', month: 'current', avgPrice: 12, listings: 3 },
      { produceType: 'Okra', unit: 'KG', month: 'previous', avgPrice: 10, listings: 2 },
      { produceType: 'Okra', unit: 'KG', month: 'current', avgPrice: 7, listings: 2 },
      { produceType: 'Yam', unit: 'KG', month: 'previous', avgPrice: 10, listings: 2 },
      { produceType: 'Yam', unit: 'KG', month: 'current', avgPrice: 10.2, listings: 2 },
    ];
    const i = buildInsights([row('Maize', 'Accra', 12)], months, quiet).find((x) => x.kind === 'mover')!;
    expect(i).toMatchObject({ produce: 'Okra', trend: 'down', tone: 'good', title: 'Okra down 30% this month' });
    const small = buildInsights([], months.filter((m) => m.produceType === 'Yam'), quiet);
    expect(small.some((x) => x.kind === 'mover')).toBe(false);
  });

  it('flags a rising price as something to watch', () => {
    const months: MonthRow[] = [
      { produceType: 'Maize', unit: 'KG', month: 'previous', avgPrice: 10, listings: 2 },
      { produceType: 'Maize', unit: 'KG', month: 'current', avgPrice: 15, listings: 2 },
    ];
    expect(buildInsights([], months, quiet)[0]).toMatchObject({ trend: 'up', tone: 'watch', title: 'Maize up 50% this month' });
  });

  it('compares organic with conventional only where both exist', () => {
    const rows = [row('Maize', 'Accra', 10), row('Maize', 'Accra', 12, { isOrganic: true }), row('Okra', 'Accra', 5, { isOrganic: true })];
    const i = buildInsights(rows, [], quiet).find((x) => x.kind === 'organic')!;
    expect(i.title).toBe('Organic costs about 20% more');
    expect(i.detail).toContain('Based on 1 produce with both');
    expect(buildInsights([row('Okra', 'Accra', 5, { isOrganic: true })], [], quiet).some((x) => x.kind === 'organic')).toBe(false);
  });

  it('warns about wide spreads and reports weekly activity', () => {
    const rows = [row('Okra', 'Accra', 5), row('Okra', 'Accra', 6), row('Okra', 'Tema', 14)];
    const out = buildInsights(rows, [], { newToday: 1, newYesterday: 0, newThisWeek: 6, newLastWeek: 4 });
    expect(out.find((x) => x.kind === 'spread')).toMatchObject({ tone: 'watch', produce: 'Okra' });
    expect(out.find((x) => x.kind === 'activity')).toMatchObject({ title: '6 new listings this week', trend: 'up' });
    expect(out.find((x) => x.kind === 'activity')!.detail).toContain('Up 50%');
  });

  it('is empty with no data and never longer than the limit', () => {
    expect(buildInsights([], [], quiet)).toEqual([]);
    const rows = Array.from({ length: 12 }, (_, i) => row(`P${i}`, 'Accra', 10 + i));
    expect(buildInsights(rows, [], { ...quiet, newThisWeek: 3 }, 2).length).toBeLessThanOrEqual(2);
  });
});

describe('weekChangePct', () => {
  it('is a rounded percentage, or null with no previous week', () => {
    expect(weekChangePct({ ...quiet, newThisWeek: 5, newLastWeek: 4 })).toBe(25);
    expect(weekChangePct({ ...quiet, newThisWeek: 1, newLastWeek: 3 })).toBe(-67);
    expect(weekChangePct({ ...quiet, newThisWeek: 5, newLastWeek: 0 })).toBeNull();
  });
});
