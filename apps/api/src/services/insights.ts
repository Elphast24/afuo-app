/*
  Market insights, computed from listing rows. Pure functions (no database) so they are easy to test.

  A "group" is one produce sold in one unit (tomatoes per kg are not comparable with tomatoes per crate).
  Rules of thumb: a group needs 3+ listings before we say anything about towns or spread, and a change
  has to be 5% or more before it is called a move.
*/

export interface ListingRow {
  produceType: string;
  unit: string;
  location: string;
  pricePerUnit: number;
  isOrganic: boolean;
}

export interface MonthRow {
  produceType: string;
  unit: string;
  month: 'current' | 'previous';
  avgPrice: number;
  listings: number;
}

export interface Pulse {
  newToday: number;
  newYesterday: number;
  newThisWeek: number;
  newLastWeek: number;
}

export interface Insight {
  id: string;
  kind: 'mover' | 'cheapest-town' | 'activity' | 'organic' | 'spread' | 'top';
  /** good = worth acting on, watch = be careful, info = context */
  tone: 'good' | 'watch' | 'info';
  trend?: 'up' | 'down';
  title: string;
  detail: string;
  produce?: string;
}

const UNIT_WORD: Record<string, string> = {
  KG: 'kg',
  TONS: 'ton',
  CRATES: 'crate',
  BAGS_90KG: 'bag',
  PIECES: 'piece',
  LITRES: 'litre',
  BUNCHES: 'bunch',
};

export const unitWord = (u: string) => UNIT_WORD[u] ?? u.toLowerCase();
const money = (n: number) => `GHS ${Number(n.toFixed(2)).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${Math.round(Math.abs(n))}%`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

interface Group {
  key: string;
  produce: string;
  unit: string;
  rows: ListingRow[];
  avg: number;
}

export function groupListings(rows: ListingRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = `${r.produceType.trim().toLowerCase()}|${r.unit}`;
    let g = map.get(key);
    if (!g) map.set(key, (g = { key, produce: r.produceType.trim(), unit: r.unit, rows: [], avg: 0 }));
    g.rows.push(r);
  }
  for (const g of map.values()) g.avg = mean(g.rows.map((r) => r.pricePerUnit));
  return [...map.values()].sort((a, b) => b.rows.length - a.rows.length || a.produce.localeCompare(b.produce));
}

/** Average price per produce (rows) and town (columns), for the heat map */
export function buildMatrix(rows: ListingRow[], maxProduce = 4, maxTowns = 7) {
  const groups = groupListings(rows).slice(0, maxProduce);

  const townCount = new Map<string, number>();
  for (const r of rows) townCount.set(r.location, (townCount.get(r.location) ?? 0) + 1);
  const towns = [...townCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxTowns)
    .map(([t]) => t);

  return {
    towns,
    rows: groups.map((g) => ({
      produce: g.produce,
      unit: g.unit,
      avgPrice: round2(g.avg),
      cells: towns.map((location) => {
        const here = g.rows.filter((r) => r.location === location);
        return { location, avgPrice: here.length ? round2(mean(here.map((r) => r.pricePerUnit))) : null, count: here.length };
      }),
    })),
  };
}

/** How many listings sit at or below their own produce's average (only groups with 2+ listings can be compared) */
export function buildBalance(rows: ListingRow[]) {
  let considered = 0;
  let atOrBelow = 0;
  for (const g of groupListings(rows)) {
    if (g.rows.length < 2) continue;
    for (const r of g.rows) {
      considered++;
      if (r.pricePerUnit <= g.avg + 1e-9) atOrBelow++;
    }
  }
  return {
    total: rows.length,
    considered,
    atOrBelow,
    above: considered - atOrBelow,
    sharePct: considered ? Math.round((atOrBelow / considered) * 100) : null,
  };
}

const change = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

export function weekChangePct(p: Pulse) {
  return p.newLastWeek > 0 ? Math.round(change(p.newThisWeek, p.newLastWeek)!) : null;
}

export function buildInsights(rows: ListingRow[], months: MonthRow[], pulse: Pulse, limit = 6): Insight[] {
  const out: Insight[] = [];
  const groups = groupListings(rows);

  // 1. Biggest price move since last month
  const prev = new Map(months.filter((m) => m.month === 'previous').map((m) => [`${m.produceType.trim().toLowerCase()}|${m.unit}`, m]));
  let mover: { m: MonthRow; pctChange: number; before: number } | null = null;
  for (const m of months.filter((x) => x.month === 'current')) {
    const p = prev.get(`${m.produceType.trim().toLowerCase()}|${m.unit}`);
    const c = p ? change(m.avgPrice, p.avgPrice) : null;
    if (p && c !== null && Math.abs(c) >= 5 && (!mover || Math.abs(c) > Math.abs(mover.pctChange))) mover = { m, pctChange: c, before: p.avgPrice };
  }
  if (mover) {
    const up = mover.pctChange > 0;
    out.push({
      id: `mover-${mover.m.produceType}`,
      kind: 'mover',
      tone: up ? 'watch' : 'good',
      trend: up ? 'up' : 'down',
      produce: mover.m.produceType,
      title: `${mover.m.produceType} ${up ? 'up' : 'down'} ${pct(mover.pctChange)} this month`,
      detail: `Average asking price is ${money(mover.m.avgPrice)} per ${unitWord(mover.m.unit)}, from ${money(mover.before)} last month.`,
    });
  }

  // 2. Cheapest town for a produce (needs 3+ listings in 2+ towns)
  let best: { g: Group; town: string; townAvg: number; gap: number; towns: number } | null = null;
  for (const g of groups) {
    if (g.rows.length < 3) continue;
    const byTown = new Map<string, number[]>();
    for (const r of g.rows) byTown.set(r.location, [...(byTown.get(r.location) ?? []), r.pricePerUnit]);
    if (byTown.size < 2) continue;
    for (const [town, prices] of byTown) {
      const townAvg = mean(prices);
      const gap = ((g.avg - townAvg) / g.avg) * 100;
      if (gap >= 10 && (!best || gap > best.gap)) best = { g, town, townAvg, gap, towns: byTown.size };
    }
  }
  if (best) {
    out.push({
      id: `cheapest-${best.g.produce}`,
      kind: 'cheapest-town',
      tone: 'good',
      produce: best.g.produce,
      title: `${best.g.produce} is cheapest in ${best.town}`,
      detail: `${money(best.townAvg)} per ${unitWord(best.g.unit)} there, ${pct(best.gap)} under the ${money(best.g.avg)} average across ${best.towns} towns.`,
    });
  }

  // 3. New listings this week vs last week
  if (pulse.newThisWeek > 0) {
    const c = weekChangePct(pulse);
    out.push({
      id: 'activity',
      kind: 'activity',
      tone: 'info',
      trend: c === null ? undefined : c >= 0 ? 'up' : 'down',
      title: `${pulse.newThisWeek} new ${pulse.newThisWeek === 1 ? 'listing' : 'listings'} this week`,
      detail: c === null ? 'Nothing was posted the week before, so there is nothing to compare with yet.' : `${c >= 0 ? 'Up' : 'Down'} ${Math.abs(c)}% on last week (${pulse.newLastWeek}). ${c >= 0 ? 'More choice for buyers.' : 'Supply is slowing.'}`,
    });
  }

  // 4. Organic premium, over produce that has both kinds listed
  const premiums: number[] = [];
  for (const g of groups) {
    const org = g.rows.filter((r) => r.isOrganic).map((r) => r.pricePerUnit);
    const con = g.rows.filter((r) => !r.isOrganic).map((r) => r.pricePerUnit);
    if (org.length && con.length) premiums.push(change(mean(org), mean(con))!);
  }
  if (premiums.length) {
    const p = mean(premiums);
    out.push({
      id: 'organic',
      kind: 'organic',
      tone: 'info',
      title: Math.abs(p) < 2 ? 'Organic costs about the same' : `Organic costs about ${pct(p)} ${p > 0 ? 'more' : 'less'}`,
      detail: `Based on ${premiums.length} ${premiums.length === 1 ? 'produce' : 'produce types'} with both organic and conventional listings.`,
    });
  }

  // 5. Widest price spread (3+ listings, high at least 1.5x the low)
  let wide: { g: Group; lo: number; hi: number } | null = null;
  for (const g of groups) {
    if (g.rows.length < 3) continue;
    const prices = g.rows.map((r) => r.pricePerUnit);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    if (lo > 0 && hi / lo >= 1.5 && (!wide || hi / lo > wide.hi / wide.lo)) wide = { g, lo, hi };
  }
  if (wide) {
    out.push({
      id: `spread-${wide.g.produce}`,
      kind: 'spread',
      tone: 'watch',
      produce: wide.g.produce,
      title: `Prices for ${wide.g.produce} vary a lot`,
      detail: `From ${money(wide.lo)} to ${money(wide.hi)} per ${unitWord(wide.g.unit)} across ${wide.g.rows.length} listings. Compare before you buy or set your price.`,
    });
  }

  // 6. Most listed produce
  if (groups.length) {
    const top = groups[0];
    out.push({
      id: `top-${top.produce}`,
      kind: 'top',
      tone: 'info',
      produce: top.produce,
      title: `${top.produce} has the most listings`,
      detail: `${top.rows.length} active ${top.rows.length === 1 ? 'listing' : 'listings'}, averaging ${money(top.avg)} per ${unitWord(top.unit)}.`,
    });
  }

  return out.slice(0, limit);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
