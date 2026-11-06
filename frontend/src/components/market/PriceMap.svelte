<script>
  import { money, perUnit } from '../../lib/format.js';

  /** { towns: string[], rows: [{ produce, unit, avgPrice, cells: [{ location, avgPrice|null, count }] }] } */
  export let matrix;

  // Shade each dot against its own row: cheapest third, middle third, dearest third
  const level = (value, prices) => {
    if (value === null) return 'none';
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    if (hi === lo) return 'mid';
    const t = (value - lo) / (hi - lo);
    return t < 1 / 3 ? 'low' : t < 2 / 3 ? 'mid' : 'high';
  };

  const LABEL = { low: 'lower', mid: 'mid-range', high: 'higher', none: 'no listings' };
  $: rows = matrix.rows.map((r) => {
    const prices = r.cells.filter((c) => c.avgPrice !== null).map((c) => c.avgPrice);
    return { ...r, cells: r.cells.map((c) => ({ ...c, level: level(c.avgPrice, prices) })) };
  });
</script>

{#if rows.length === 0 || matrix.towns.length === 0}
  <p class="muted">The map appears once farmers list produce.</p>
{:else}
  <div class="scroller">
    <table class="map" style="--cols: {matrix.towns.length}">
      <caption class="sr-only">Average asking price by produce and town. Darker dots are dearer, lighter dots are cheaper, grey means nothing is listed there.</caption>
      <thead>
        <tr>
          <td></td>
          {#each matrix.towns as t}<th scope="col"><abbr title={t}>{t.slice(0, 3)}</abbr></th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.produce + r.unit)}
          <tr>
            <th scope="row" class="rowhead"><span>{r.produce}</span><small>per {perUnit(r.unit)}</small></th>
            {#each r.cells as c (c.location)}
              <td>
                <span
                  class="dot {c.level}"
                  role="img"
                  aria-label="{r.produce} in {c.location}: {c.avgPrice === null ? 'no listings' : `${money(c.avgPrice)} per ${perUnit(r.unit)}, ${LABEL[c.level]}, ${c.count} ${c.count === 1 ? 'listing' : 'listings'}`}"
                  title={c.avgPrice === null ? `${c.location}: no listings` : `${c.location}: ${money(c.avgPrice)}`}
                ></span>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <ul class="legend" aria-hidden="true">
    <li><span class="dot low"></span> Lower</li>
    <li><span class="dot mid"></span> Mid</li>
    <li><span class="dot high"></span> Higher</li>
    <li><span class="dot none"></span> None listed</li>
  </ul>
{/if}

<style>
  .scroller { overflow-x: auto; }
  .map { width: 100%; border-collapse: separate; border-spacing: 0 var(--space-2); }
  th, td { padding: 0; text-align: center; }
  thead th { padding-bottom: var(--space-1); font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted); }
  abbr { text-decoration: none; cursor: help; }
  .rowhead { display: grid; gap: 0; width: clamp(5.5rem, 22vw, 8rem); padding-right: var(--space-3); text-align: left; font-size: var(--text-sm); font-weight: 500; }
  .rowhead span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rowhead small { font-size: var(--text-xs); font-weight: 400; color: var(--color-muted); }

  .dot { display: block; width: clamp(24px, 6.2vw, 40px); aspect-ratio: 1; margin: 0 auto; border-radius: 50%; }
  .dot.none { background: #ecebe7; }
  .dot.low { background: var(--ramp-1); }
  .dot.mid { background: var(--ramp-4); }
  /* Dearest: dark with the diagonal stripe texture from the reference */
  .dot.high { background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0 2px, transparent 2px 6px), var(--color-ink); }

  .legend { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin: var(--space-4) 0 0; padding: 0; list-style: none; font-size: var(--text-xs); color: var(--color-muted); }
  .legend li { display: inline-flex; align-items: center; gap: var(--space-2); }
  .legend .dot { width: 12px; margin: 0; }
</style>
