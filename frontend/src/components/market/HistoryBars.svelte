<script>
  import { money, monthLabel, perUnit } from '../../lib/format.js';

  /** API price-history response: { produce, currency, history: [{ month, avgPrice, listings }] } */
  export let data;
  /** unit the produce is mostly sold in (for the caption) */
  export let unit = '';

  $: rows = data?.history ?? [];
  $: max = Math.max(1, ...rows.map((r) => r.avgPrice));
  $: last = rows.at(-1);
  $: before = rows.length > 1 ? rows.at(-2) : null;
  $: delta = before && before.avgPrice > 0 ? ((last.avgPrice - before.avgPrice) / before.avgPrice) * 100 : null;
  $: up = delta !== null && delta >= 0;
  const fmt = (n) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}%`;
</script>

{#if rows.length === 0}
  <p class="muted">No {data?.produce ?? 'produce'} listings in this period.</p>
{:else}
  <div class="head">
    {#if delta !== null}
      <p class="delta" class:up class:down={!up}>{fmt(delta)}</p>
      <p class="sub">{up ? 'higher' : 'lower'} than last month</p>
    {:else}
      <p class="delta">{money(last.avgPrice)}</p>
      <p class="sub">average {unit ? `per ${perUnit(unit)}` : ''} · only one month of listings so far</p>
    {/if}
  </div>

  <ol class="bars" aria-label="Average {data.produce} price by month">
    {#each rows as r, i (r.month)}
      {@const isLast = i === rows.length - 1}
      <li aria-label="{monthLabel(r.month)}: {money(r.avgPrice)}, {r.listings} {r.listings === 1 ? 'listing' : 'listings'}" title="{monthLabel(r.month)}: {money(r.avgPrice)} ({r.listings} {r.listings === 1 ? 'listing' : 'listings'})">
        <span class="col">
          <span class="bar" class:now={isLast} class:prev={i === rows.length - 2} style="height: {Math.max(8, (r.avgPrice / max) * 100)}%">
            {#if isLast || i === rows.length - 2}<span class="chip">{money(r.avgPrice).replace('GHS ', '')}</span>{/if}
          </span>
        </span>
        <span class="m">{monthLabel(r.month)}</span>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .head { margin-bottom: var(--space-4); }
  .delta { font-family: var(--font-display); font-size: clamp(2.25rem, 7vw, 3.25rem); line-height: 1; letter-spacing: 0.01em; }
  .delta.up { color: var(--color-orange-600); }
  .delta.down { color: var(--color-green-700); }
  .sub { margin-top: var(--space-1); font-size: var(--text-sm); color: var(--color-muted); }

  .bars { display: flex; align-items: flex-end; gap: clamp(6px, 2vw, 16px); height: 220px; margin: 0; padding: 0; list-style: none; }
  .bars li { display: grid; grid-template-rows: 1fr auto; flex: 1; min-width: 0; height: 100%; gap: var(--space-2); }
  .col { display: flex; align-items: flex-end; min-height: 0; }
  .bar {
    position: relative; display: block; width: 100%; border-radius: 16px 16px 8px 8px; background: var(--ramp-1);
    transform-origin: bottom; animation: grow 600ms var(--ease-out) both; transition: filter var(--dur-fast) var(--ease-out);
  }
  .bar.prev { background: var(--ramp-3); }
  .bar.now { background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0 2px, transparent 2px 7px), var(--color-green-900); }
  li:hover .bar { filter: brightness(0.92); }
  .chip {
    position: absolute; top: var(--space-2); left: 50%; transform: translateX(-50%); padding: 2px 8px; border-radius: var(--radius-pill);
    background: #fff; color: var(--color-ink); font-size: var(--text-xs); font-weight: 700; white-space: nowrap; box-shadow: var(--shadow-sm);
  }
  .m { text-align: center; font-size: var(--text-xs); color: var(--color-muted); }

  @keyframes grow { from { transform: scaleY(0.2); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
</style>
