<script>
  import { onMount } from 'svelte';
  import { Link } from 'svelte-navigator';
  import { ArrowUpRight, ArrowDownRight, ChevronDown, Download, Printer, Layers, MapPin, Table2, Lightbulb, CalendarPlus, Sparkles } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import PriceMap from '../components/market/PriceMap.svelte';
  import HistoryBars from '../components/market/HistoryBars.svelte';
  import BalanceGauge from '../components/market/BalanceGauge.svelte';
  import InsightCard from '../components/market/InsightCard.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api } from '../lib/api.js';
  import { session } from '../lib/auth.js';
  import { money, perUnit } from '../lib/format.js';

  let summary = null;
  let prices = [];
  let locations = [];
  let status = 'loading';
  let error = '';

  let insights = null; // { pulse, balance, matrix, insights }
  let insightsStatus = 'loading';
  let mine = [];

  let produce = '';
  let months = 6;
  let history = null;
  let historyStatus = 'idle';
  let sortBy = 'produce';
  let histSeq = 0;

  $: role = $session?.role;
  $: produceOptions = [...new Set(prices.map((p) => p.produce))];
  $: historyUnit = prices.filter((p) => p.produce === produce).sort((a, b) => b.count - a.count)[0]?.unit ?? '';
  $: maxCount = summary ? Math.max(1, ...summary.priceDistribution.map((b) => b.count)) : 1;
  $: sortedPrices = [...prices].sort((a, b) =>
    sortBy === 'price' ? b.avgPrice - a.avgPrice : sortBy === 'listings' ? b.count - a.count : a.produce.localeCompare(b.produce)
  );
  $: pulse = insights?.pulse;
  $: weekUp = pulse?.weekChangePct !== null && pulse?.weekChangePct >= 0;

  // Farmers also get a read on their own prices against the market
  $: personal = role === 'FARMER' ? ownPriceInsights(mine, prices) : [];
  $: allInsights = [...personal, ...(insights?.insights ?? [])];

  function ownPriceInsights(listings, market) {
    const out = [];
    for (const l of listings.filter((x) => x.status === 'ACTIVE')) {
      const m = market.find((p) => p.produce.toLowerCase() === l.produceType.toLowerCase() && p.unit === l.unit);
      if (!m || m.count < 2) continue; // nothing to compare with
      const diff = ((l.pricePerUnit - m.avgPrice) / m.avgPrice) * 100;
      const where = `${money(l.pricePerUnit)} against a ${money(m.avgPrice)} average per ${perUnit(l.unit)}`;
      if (diff >= 15) out.push({ id: `own-${l.id}`, kind: 'yours', tone: 'watch', personal: true, title: `${l.produceType} is ${Math.round(diff)}% above market`, detail: `${where}. A lower price may sell it faster.` });
      else if (diff <= -15) out.push({ id: `own-${l.id}`, kind: 'yours', tone: 'good', personal: true, title: `${l.produceType} is ${Math.round(-diff)}% below market`, detail: `${where}. You may have room to raise it.` });
      else out.push({ id: `own-${l.id}`, kind: 'yours', tone: 'info', personal: true, title: `${l.produceType} is priced in line with the market`, detail: `${where}.` });
    }
    return out.slice(0, 2);
  }

  async function load() {
    status = 'loading';
    insightsStatus = 'loading';
    try {
      const [s, p, l] = await Promise.all([api.analytics.summary(), api.analytics.prices(), api.analytics.locations()]);
      summary = s;
      prices = p.prices;
      locations = l.locations;
      status = 'ready';
      if (!produce && prices.length) {
        produce = [...prices].sort((a, b) => b.count - a.count)[0].produce; // most listed produce first
      }
      loadHistory();
    } catch (e) {
      error = e.message;
      status = 'error';
      return;
    }
    // The insights are extra: if they fail the rest of the page still works
    try {
      insights = await api.analytics.insights();
      insightsStatus = 'ready';
    } catch {
      insightsStatus = 'error';
    }
    if (role === 'FARMER') api.listings.mine().then((r) => (mine = r.listings)).catch(() => {});
  }

  async function loadHistory() {
    if (!produce) return;
    const mineSeq = ++histSeq;
    historyStatus = 'loading';
    try {
      const data = await api.analytics.priceHistory(produce, months);
      if (mineSeq !== histSeq) return;
      history = data;
      historyStatus = 'ready';
    } catch {
      if (mineSeq === histSeq) historyStatus = 'error';
    }
  }

  // Spreadsheet apps run text that starts with = + - @ as a formula, and produce names are typed by users
  const csvCell = (v) => {
    const s = String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  function downloadCsv() {
    const head = ['Produce', 'Unit', 'Average price (GHS)', 'Lowest (GHS)', 'Highest (GHS)', 'Active listings'];
    const lines = [head, ...sortedPrices.map((p) => [p.produce, perUnit(p.unit), p.avgPrice, p.minPrice, p.maxPrice, p.count])];
    const blob = new Blob(['﻿' + lines.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `agrimatch-prices-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  onMount(load);
</script>

<PageLayout current="market" kicker="Prices" title="Know the market before you trade" lead="Live asking prices, price trends and plain-language insights from AgriMatch listings.">
  {#if status === 'error'}
    <section class="tile"><ErrorState message={error} on:retry={load} /></section>
  {:else}
    <div class="bento">
      <!-- Price map (heat map of produce x town) -->
      <section class="tile map" aria-labelledby="map-title">
        <div class="tile-head">
          <h2 id="map-title">Price map</h2>
          <span class="pill-static">Average per unit</span>
        </div>
        {#if status === 'loading' || insightsStatus === 'loading'}
          <span class="skeleton sk" style="height: 52px; width: 60%"></span>
          <span class="skeleton sk" style="height: 200px"></span>
        {:else}
          <p class="kpi">{summary.totalListings.toLocaleString()}</p>
          <p class="kpi-sub">active {summary.totalListings === 1 ? 'listing' : 'listings'} · {summary.uniqueProduce} produce · {summary.uniqueLocations} {summary.uniqueLocations === 1 ? 'town' : 'towns'}</p>
          {#if insights}
            <PriceMap matrix={insights.matrix} />
          {:else}
            <p class="muted">The map could not be loaded.</p>
          {/if}
        {/if}
      </section>

      <!-- Call to action (dark) -->
      <section class="tile dark promo" aria-labelledby="promo-title">
        <div class="promo-copy">
          {#if role === 'FARMER'}
            <h2 id="promo-title">Price your next <span class="accent">harvest</span></h2>
            <p>Compare your asking price with the market before you list.</p>
            <Link to="/listings/new" class="btn-pill">List produce <ArrowUpRight size={18} aria-hidden="true" /></Link>
          {:else if role === 'ADMIN'}
            <h2 id="promo-title">Keep the market <span class="accent">honest</span></h2>
            <p>Review listings and accounts from the admin dashboard.</p>
            <Link to="/admin" class="btn-pill">Open admin <ArrowUpRight size={18} aria-hidden="true" /></Link>
          {:else}
            <h2 id="promo-title">Find your <span class="accent">best match</span></h2>
            <p>Rank every listing by price, distance and freshness.</p>
            <Link to="/search" class="btn-pill">Smart match <ArrowUpRight size={18} aria-hidden="true" /></Link>
          {/if}
          {#if pulse && pulse.weekChangePct !== null && pulse.weekChangePct > 0}
            <span class="badge-up">+{pulse.weekChangePct}% new listings this week</span>
          {/if}
        </div>
      </section>

      <div class="pair">
        <!-- Posted today -->
        <section class="tile today" aria-labelledby="today-title">
          <span class="ring"><CalendarPlus size={20} aria-hidden="true" /></span>
          <h2 id="today-title" class="small-title">Posted today</h2>
          {#if insightsStatus === 'loading'}
            <span class="skeleton sk" style="height: 44px"></span>
          {:else if pulse}
            <p class="kpi">{pulse.newToday.toLocaleString()}</p>
            <p class="kpi-sub">new {pulse.newToday === 1 ? 'listing' : 'listings'} · {pulse.newYesterday} yesterday</p>
            <p class="week" class:up={weekUp}>
              {#if pulse.weekChangePct === null}
                {pulse.newThisWeek} this week
              {:else}
                {#if weekUp}<ArrowUpRight size={16} aria-hidden="true" />{:else}<ArrowDownRight size={16} aria-hidden="true" />{/if}
                {Math.abs(pulse.weekChangePct)}% vs last week
              {/if}
            </p>
          {:else}
            <p class="muted">Unavailable</p>
          {/if}
        </section>

        <!-- Report (dark) -->
        <section class="tile dark report" aria-labelledby="report-title">
          <p class="eyebrow-tag">Track and print</p>
          <h2 id="report-title" class="report-title">Market report</h2>
          <div class="report-actions">
            <button type="button" class="icon-btn" on:click={downloadCsv} disabled={!prices.length} aria-label="Download average prices as a CSV file"><Download size={18} aria-hidden="true" /></button>
            <button type="button" class="icon-btn" on:click={() => window.print()} aria-label="Print this page"><Printer size={18} aria-hidden="true" /></button>
          </div>
        </section>
      </div>
    </div>

    <!-- Insights -->
    <section class="insights" aria-labelledby="insights-title">
      <div class="section-title">
        <span class="chip-ico"><Lightbulb size={18} aria-hidden="true" /></span>
        <h2 id="insights-title">Insights</h2>
      </div>
      {#if insightsStatus === 'loading'}
        <div class="insight-grid">{#each Array(3) as _}<span class="skeleton sk" style="height: 130px"></span>{/each}</div>
      {:else if insightsStatus === 'error'}
        <div class="tile"><ErrorState message="Could not load the insights." on:retry={load} /></div>
      {:else if allInsights.length === 0}
        <div class="tile empty"><Sparkles size={22} aria-hidden="true" /><p>Insights appear as soon as there are enough listings to compare.</p></div>
      {:else}
        <div class="insight-grid">
          {#each allInsights as insight (insight.id)}<InsightCard {insight} />{/each}
        </div>
      {/if}
    </section>

    <div class="bento two">
      <!-- Price history bars -->
      <section class="tile history" aria-labelledby="hist-title">
        <div class="tile-head">
          <h2 id="hist-title">Price trend</h2>
          <div class="pills">
            {#if produceOptions.length}
              <label class="pill-select">
                <span class="sr-only">Produce</span>
                <select bind:value={produce} on:change={loadHistory}>
                  {#each produceOptions as p}<option value={p}>{p}</option>{/each}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
              <label class="pill-select">
                <span class="sr-only">Period</span>
                <select bind:value={months} on:change={loadHistory}>
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={12}>12 months</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
            {/if}
          </div>
        </div>
        {#if status === 'loading' || historyStatus === 'loading' || historyStatus === 'idle'}
          {#if produceOptions.length === 0 && status === 'ready'}
            <p class="muted">Price history appears once farmers list produce.</p>
          {:else}
            <span class="skeleton sk" style="height: 260px"></span>
          {/if}
        {:else if historyStatus === 'error'}
          <ErrorState message="Could not load the price trend." on:retry={loadHistory} />
        {:else}
          <HistoryBars data={history} unit={historyUnit} />
        {/if}
      </section>

      <!-- Balance gauge -->
      <section class="tile balance" aria-labelledby="bal-title">
        <div class="tile-head"><h2 id="bal-title">Market balance</h2></div>
        {#if insightsStatus === 'loading'}
          <span class="skeleton sk" style="height: 200px"></span>
        {:else if insights}
          <BalanceGauge balance={insights.balance} />
        {:else}
          <p class="muted">Unavailable</p>
        {/if}
      </section>
    </div>

    {#if status === 'ready'}
      <!-- Table -->
      <section class="tile" aria-labelledby="table-title">
        <div class="tile-head">
          <h2 id="table-title"><span class="chip-ico"><Table2 size={18} aria-hidden="true" /></span> Average prices</h2>
          <div class="pills">
            <label class="pill-select">
              <span class="sr-only">Sort by</span>
              <select bind:value={sortBy}>
                <option value="produce">Sort by produce</option>
                <option value="price">Highest price</option>
                <option value="listings">Most listings</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
          </div>
        </div>
        {#if prices.length === 0}
          <p class="muted">No active listings yet.</p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead><tr><th scope="col">Produce</th><th scope="col">Unit</th><th scope="col" class="num">Average</th><th scope="col" class="num">Lowest</th><th scope="col" class="num">Highest</th><th scope="col" class="num">Listings</th></tr></thead>
              <tbody>
                {#each sortedPrices as p (p.produce + p.unit)}
                  <tr><th scope="row">{p.produce}</th><td>{perUnit(p.unit)}</td><td class="num strong">{money(p.avgPrice)}</td><td class="num">{money(p.minPrice)}</td><td class="num">{money(p.maxPrice)}</td><td class="num">{p.count}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>

      <div class="bento two even">
        <section class="tile" aria-labelledby="dist-title">
          <div class="tile-head"><h2 id="dist-title"><span class="chip-ico"><Layers size={18} aria-hidden="true" /></span> Price distribution</h2></div>
          {#if summary.totalListings === 0}
            <p class="muted">No active listings yet.</p>
          {:else}
            <div class="bars">
              {#each summary.priceDistribution as b, i (b.range)}
                <div class="bar-row">
                  <span class="range">GHS {b.range}</span>
                  <div class="track" role="presentation"><div class="fill" style="width: {(b.count / maxCount) * 100}%; background: var(--ramp-{i + 1})"></div></div>
                  <span class="n">{b.count}</span>
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <section class="tile" aria-labelledby="loc-title">
          <div class="tile-head"><h2 id="loc-title"><span class="chip-ico"><MapPin size={18} aria-hidden="true" /></span> Listings by town</h2></div>
          {#if locations.length === 0}
            <p class="muted">No active listings yet.</p>
          {:else}
            <ul class="towns">
              {#each locations as l (l.location)}<li><span>{l.location}</span><strong>{l.count}</strong></li>{/each}
            </ul>
          {/if}
        </section>
      </div>
    {/if}
  {/if}
</PageLayout>

<style>
  /* ─── Tiles ─── */
  .tile { display: grid; align-content: start; gap: var(--space-3); min-width: 0; padding: var(--space-6); border-radius: var(--radius-lg); background: #fff; box-shadow: var(--shadow-sm); }
  .tile.dark {
    position: relative; overflow: hidden; color: #fff; box-shadow: none;
    background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0 2px, transparent 2px 9px), var(--color-ink);
  }
  .tile-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .tile-head h2 { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-lg); font-weight: 600; }
  .small-title { font-size: var(--text-sm); font-weight: 500; color: var(--color-muted); }
  .sk { display: block; border-radius: var(--radius-md); }
  .chip-ico { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--tint-green); color: var(--color-green-700); }

  .kpi { font-family: var(--font-display); font-size: clamp(2.25rem, 7vw, 3.25rem); line-height: 1; letter-spacing: 0.01em; }
  .kpi-sub { margin-top: calc(var(--space-1) * -1); font-size: var(--text-sm); color: var(--color-muted); }

  /* ─── Pills (selects and labels, as in the reference) ─── */
  .pills { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .pill-static { display: inline-flex; align-items: center; min-height: 40px; padding: 0 var(--space-4); border: 1px solid var(--color-line); border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: 600; color: var(--color-muted); }
  .pill-select { position: relative; display: inline-flex; align-items: center; }
  .pill-select select {
    appearance: none; -webkit-appearance: none; min-height: 44px; min-width: 0; max-width: 100%; padding: 0 var(--space-8) 0 var(--space-4);
    border: 1px solid var(--color-line-strong); border-radius: var(--radius-pill); background: #fff; color: var(--color-ink); font: inherit; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  }
  .pill-select :global(svg) { position: absolute; right: var(--space-3); pointer-events: none; }

  /* ─── Bento grid ─── */
  .bento { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  @media (max-width: 460px) { .pair { grid-template-columns: minmax(0, 1fr); } }
  @media (min-width: 1000px) {
    .bento:not(.two) { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .map { grid-column: 1 / span 7; grid-row: 1 / span 2; }
    .promo { grid-column: 8 / span 5; }
    .pair { grid-column: 8 / span 5; }
    .bento.two { grid-template-columns: 2fr 1fr; }
    .bento.two.even { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 700px) and (max-width: 999px) { .bento.two.even { grid-template-columns: 1fr 1fr; } }

  .tile.dark.promo { min-height: 200px; background: linear-gradient(90deg, rgba(22, 32, 27, 0.96) 25%, rgba(22, 32, 27, 0.55)), url('/images/market/tomatoes.jpg') center / cover; }
  .promo-copy { display: grid; justify-items: start; gap: var(--space-3); max-width: 30ch; }
  .promo h2 { font-size: clamp(1.5rem, 4vw, 1.875rem); font-weight: 600; letter-spacing: -0.01em; }
  .promo p { font-size: var(--text-sm); color: var(--color-on-dark-muted); }
  .accent { color: #f4a98b; }
  .promo :global(.btn-pill) {
    display: inline-flex; align-items: center; gap: var(--space-2); min-height: 48px; padding: 0 var(--space-4) 0 var(--space-6); border-radius: var(--radius-pill);
    background: var(--color-orange-600); color: #fff; font-size: var(--text-sm); font-weight: 700; text-decoration: none; transition: background-color var(--dur-fast) var(--ease-out);
  }
  .promo :global(.btn-pill:hover) { background: var(--color-orange-700); }
  .badge-up { padding: 4px 12px; border-radius: var(--radius-pill); background: #1f7a4d; color: #fff; font-size: var(--text-xs); font-weight: 700; }

  .today { align-content: space-between; }
  .ring { display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid var(--color-line-strong); border-radius: 50%; color: var(--color-ink); }
  .week { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); font-weight: 600; color: var(--color-muted); }
  .week.up { color: var(--color-green-700); }

  .report { align-content: space-between; min-height: 160px; }
  .eyebrow-tag { justify-self: start; padding: 4px 12px; border-radius: var(--radius-pill); background: rgba(255, 255, 255, 0.14); font-size: var(--text-xs); }
  .report-title { font-size: clamp(1.5rem, 3.4vw, 1.875rem); font-weight: 500; line-height: 1.1; }
  .report-actions { display: flex; gap: var(--space-2); }
  .icon-btn { display: grid; place-items: center; width: 48px; height: 48px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.16); color: #fff; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out); }
  .icon-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.28); }
  .icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .tile.dark :global(a:focus-visible), .tile.dark button:focus-visible { outline-color: #fff; }

  /* ─── Insights ─── */
  .insights { display: grid; gap: var(--space-4); }
  .section-title { display: flex; align-items: center; gap: var(--space-2); }
  .section-title h2 { font-size: var(--text-xl); font-weight: 600; }
  .insight-grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
  .empty { display: flex; align-items: center; gap: var(--space-3); color: var(--color-muted); }

  /* ─── Table, distribution, towns ─── */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  th, td { padding: var(--space-3); border-bottom: 1px solid var(--color-line); text-align: left; white-space: nowrap; }
  thead th { font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); }
  tbody th { font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 600; }

  .bar-row { display: grid; grid-template-columns: 6.5rem 1fr 3rem; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
  .range { font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
  .track { height: 28px; overflow: hidden; border-radius: var(--radius-pill); background: var(--color-bg); }
  .fill { height: 100%; min-width: 4px; border-radius: var(--radius-pill); transition: width 600ms var(--ease-out); }
  .n { text-align: right; font-size: var(--text-sm); font-weight: 600; color: var(--color-muted); }
  @media (max-width: 520px) { .bar-row { grid-template-columns: 5.5rem 1fr 2.5rem; } .tile { padding: var(--space-4); } }

  .towns { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); }
  .towns li { display: flex; justify-content: space-between; padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); background: var(--tint-gray); }

  @media print {
    :global(.site-header), :global(.footer), .icon-btn, .pills { display: none !important; }
    .tile { box-shadow: none; border: 1px solid #ccc; break-inside: avoid; }
  }
</style>
