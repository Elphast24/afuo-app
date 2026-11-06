<script>
  /** { total, considered, atOrBelow, above, sharePct|null } */
  export let balance;

  const SEGMENTS = 30;
  const R_IN = 62;
  const R_OUT = 86;
  // light green -> dark green, like the reference's blue ramp
  const RAMP = ['#cfe6d7', '#a7d3b5', '#6fb58a', '#3f8a62', '#2d6a4f', '#1b4332'];
  const colorAt = (i) => RAMP[Math.min(RAMP.length - 1, Math.floor((i / SEGMENTS) * RAMP.length))];

  $: share = balance.sharePct;
  $: filled = share === null ? 0 : Math.round((share / 100) * SEGMENTS);
  $: ticks = Array.from({ length: SEGMENTS }, (_, i) => {
    const a = Math.PI - (i / (SEGMENTS - 1)) * Math.PI; // left -> right
    return { i, x1: 100 + R_IN * Math.cos(a), y1: 96 - R_IN * Math.sin(a), x2: 100 + R_OUT * Math.cos(a), y2: 96 - R_OUT * Math.sin(a) };
  });
</script>

<figure class="gauge" aria-label={share === null ? 'Not enough comparable listings yet' : `${share} percent of listings are priced at or below their produce's average`}>
  <svg viewBox="0 0 200 104" role="img" aria-hidden="true">
    {#each ticks as t (t.i)}
      <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.i < filled ? colorAt(t.i) : '#ecebe7'} stroke-width="5.5" stroke-linecap="round" />
    {/each}
  </svg>
  <p class="big">{share === null ? '--' : `${share}%`}</p>
</figure>
<p class="cap">{share === null ? 'Not enough listings to compare yet.' : 'of listings are priced at or below the average for their produce.'}</p>

<ul class="legend">
  <li><span class="sw" style="background: var(--ramp-5)"></span> At or below average <strong>{balance.atOrBelow}</strong></li>
  <li><span class="sw" style="background: #ecebe7"></span> Above average <strong>{balance.above}</strong></li>
  <li><span class="sw" style="background: var(--ramp-1)"></span> All active listings <strong>{balance.total}</strong></li>
</ul>

<style>
  .gauge { position: relative; margin: 0; }
  svg { display: block; width: 100%; max-width: 320px; margin: 0 auto; }
  /* The number sits in the empty middle of the arc; the explanation goes underneath so nothing collides */
  .big { position: absolute; inset: auto 0 0; text-align: center; font-family: var(--font-display); font-size: clamp(1.75rem, 5vw, 2.25rem); line-height: 1; }
  .cap { margin-top: var(--space-2); text-align: center; font-size: var(--text-xs); color: var(--color-muted); }
  .legend { display: grid; gap: var(--space-2); margin: var(--space-4) 0 0; padding: 0; list-style: none; font-size: var(--text-xs); color: var(--color-muted); }
  .legend li { display: flex; align-items: center; gap: var(--space-2); }
  .legend strong { margin-left: auto; color: var(--color-ink); font-variant-numeric: tabular-nums; }
  .sw { width: 10px; height: 10px; border-radius: 50%; }
</style>
