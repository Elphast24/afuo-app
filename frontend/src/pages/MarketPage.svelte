<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
  import { ClipboardList, Sprout, MapPin, Banknote, TrendingUp, Layers, Table2 } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import StatsCards from '../components/market/StatsCards.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api } from '../lib/api.js';
  import { money, monthLabel, perUnit } from '../lib/format.js';

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

  let summary = null;
  let prices = [];
  let locations = [];
  let status = 'loading';
  let error = '';

  let produce = '';
  let history = null;
  let historyStatus = 'idle';
  let canvas;
  let chart;

  $: produceOptions = [...new Set(prices.map((p) => p.produce))];
  $: cards = summary
    ? [
        { icon: ClipboardList, value: summary.totalListings.toLocaleString(), label: 'Active listings' },
        { icon: Sprout, value: summary.uniqueProduce, label: 'Produce types' },
        { icon: MapPin, value: summary.uniqueLocations, label: 'Towns' },
        { icon: Banknote, value: money(summary.avgPrice), label: 'Avg price / unit' }
      ]
    : [];
  $: maxCount = summary ? Math.max(1, ...summary.priceDistribution.map((b) => b.count)) : 1;

  async function load() {
    status = 'loading';
    try {
      const [s, p, l] = await Promise.all([api.analytics.summary(), api.analytics.prices(), api.analytics.locations()]);
      summary = s;
      prices = p.prices;
      locations = l.locations;
      status = 'ready';
      if (!produce && prices.length) {
        produce = prices[0].produce;
        loadHistory();
      }
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  async function loadHistory() {
    if (!produce) return;
    historyStatus = 'loading';
    try {
      history = await api.analytics.priceHistory(produce, 6);
      historyStatus = 'ready';
      draw();
    } catch (e) {
      historyStatus = 'error';
    }
  }

  async function draw() {
    await tick();
    if (!canvas || !history) return;
    const css = getComputedStyle(document.documentElement);
    const color = (t) => css.getPropertyValue(t).trim();

    chart?.destroy();
    if (!history.history.length) return;
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: history.history.map((h) => monthLabel(h.month)),
        datasets: [
          {
            label: `${history.produce} (avg ${history.currency} per unit)`,
            data: history.history.map((h) => h.avgPrice),
            borderColor: color('--series-1'),
            backgroundColor: color('--series-1'),
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: {
          y: { title: { display: true, text: 'GHS per unit' }, grid: { color: color('--color-line') } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  onMount(load);
  onDestroy(() => chart?.destroy());
</script>

<PageLayout current="market" kicker="Market analytics" title="Know the market before you trade" lead="Live listing counts, price ranges and six-month price trends from AgriMatch listings.">
  {#if status === 'error'}
    <section class="card"><ErrorState message={error} on:retry={load} /></section>
  {:else}
    <StatsCards loading={status === 'loading'} {cards} />

    {#if status === 'ready'}
      <section class="card" aria-labelledby="dist-title">
        <div class="card-header"><span class="icon-chip"><Layers size={20} aria-hidden="true" /></span><h2 id="dist-title">Price distribution</h2></div>
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

      <section class="card" aria-labelledby="hist-title">
        <div class="card-header">
          <span class="icon-chip"><TrendingUp size={20} aria-hidden="true" /></span>
          <h2 id="hist-title">Price history</h2>
          {#if produceOptions.length}
            <div class="pick">
              <label for="produce" class="sr-only">Produce</label>
              <select id="produce" bind:value={produce} on:change={loadHistory}>
                {#each produceOptions as p}<option value={p}>{p}</option>{/each}
              </select>
            </div>
          {/if}
        </div>

        {#if produceOptions.length === 0}
          <p class="muted">Price history appears once farmers list produce.</p>
        {:else if historyStatus === 'loading'}
          <span class="skeleton chart-sk"></span>
        {:else if historyStatus === 'error'}
          <ErrorState message="Could not load the price history." on:retry={loadHistory} />
        {:else if history && history.history.length === 0}
          <p class="muted">No {history.produce} listings in the last 6 months.</p>
        {:else if history}
          <div class="chart" role="img" aria-label="Line chart of the average {history.produce} price per month, {history.history.map((h) => `${monthLabel(h.month)} ${h.avgPrice}`).join(', ')} Ghana cedis">
            <canvas bind:this={canvas} aria-hidden="true"></canvas>
          </div>
        {/if}
      </section>

      <section class="card" aria-labelledby="table-title">
        <div class="card-header"><span class="icon-chip"><Table2 size={20} aria-hidden="true" /></span><h2 id="table-title">Average prices</h2></div>
        {#if prices.length === 0}
          <p class="muted">No active listings yet.</p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead><tr><th scope="col">Produce</th><th scope="col">Unit</th><th scope="col" class="num">Average</th><th scope="col" class="num">Lowest</th><th scope="col" class="num">Highest</th><th scope="col" class="num">Listings</th></tr></thead>
              <tbody>
                {#each prices as p (p.produce + p.unit)}
                  <tr><th scope="row">{p.produce}</th><td>{perUnit(p.unit)}</td><td class="num strong">{money(p.avgPrice)}</td><td class="num">{money(p.minPrice)}</td><td class="num">{money(p.maxPrice)}</td><td class="num">{p.count}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>

      <section class="card" aria-labelledby="loc-title">
        <div class="card-header"><span class="icon-chip"><MapPin size={20} aria-hidden="true" /></span><h2 id="loc-title">Listings by town</h2></div>
        {#if locations.length === 0}
          <p class="muted">No active listings yet.</p>
        {:else}
          <ul class="towns">
            {#each locations as l (l.location)}<li><span>{l.location}</span><strong>{l.count}</strong></li>{/each}
          </ul>
        {/if}
      </section>
    {/if}
  {/if}
</PageLayout>

<style>
  .bar-row { display: grid; grid-template-columns: 6.5rem 1fr 3rem; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
  .range { font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
  .track { height: 28px; overflow: hidden; border-radius: var(--radius-pill); background: var(--color-bg); }
  .fill { height: 100%; min-width: 4px; border-radius: var(--radius-pill); transition: width 600ms var(--ease-out); }
  .n { text-align: right; font-size: var(--text-sm); font-weight: 600; color: var(--color-muted); }

  .pick { margin-left: auto; }
  .pick select { min-width: 160px; }
  .chart { position: relative; height: clamp(240px, 45vw, 340px); }
  .chart-sk { height: 300px; }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  th, td { padding: var(--space-3) var(--space-3); border-bottom: 1px solid var(--color-line); text-align: left; white-space: nowrap; }
  thead th { font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); }
  tbody th { font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 600; }

  .towns { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr)); }
  .towns li { display: flex; justify-content: space-between; padding: var(--space-3) var(--space-4); border: 1px solid var(--color-line); border-radius: var(--radius-sm); }

  @media (max-width: 520px) { .bar-row { grid-template-columns: 5.5rem 1fr 2.5rem; } }
</style>
