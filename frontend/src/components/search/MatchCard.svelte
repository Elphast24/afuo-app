<script>
  import { createEventDispatcher } from 'svelte';
  import { Link } from 'svelte-navigator';
  import { MapPin, Package, Calendar, Sprout, ChevronDown, MessageSquare, Navigation } from 'lucide-svelte';
  import { formatDate, money, perUnit, unitLabel } from '../../lib/format.js';

  /** one entry of POST /match results */
  export let match;

  const dispatch = createEventDispatcher();
  let open = false;

  const TIER = {
    EXCELLENT: { label: 'Excellent match', cls: 'excellent', bar: '#2d6a4f' },
    GOOD: { label: 'Good match', cls: 'good', bar: '#52b788' },
    FAIR: { label: 'Fair match', cls: 'fair', bar: '#e9c46a' },
    POOR: { label: 'Weak match', cls: 'poor', bar: '#e76f51' }
  };
  const CRITERIA = [
    ['produceScore', 'Produce'],
    ['quantityScore', 'Quantity'],
    ['locationScore', 'Location'],
    ['priceScore', 'Price'],
    ['availabilityScore', 'Availability']
  ];

  $: l = match.listing;
  $: tier = TIER[match.matchTier];
  const panelId = `why-${Math.random().toString(36).slice(2, 8)}`;
</script>

<article class="match">
  <div class="score">
    <span class="rank" aria-label="Rank {match.rank}">#{match.rank}</span>
    <strong class="pct">{match.matchPercentage}%</strong>
    <span class="tier {tier.cls}">{tier.label}</span>
    <span class="track" aria-hidden="true"><span class="fill" style="width: {match.matchPercentage}%; background: {tier.bar}"></span></span>
  </div>

  <div class="info">
    <div class="top">
      <h3><Link to="/listings/{l.id}">{l.produceType}</Link></h3>
      <p class="price">{money(l.pricePerUnit, l.currency)} <span>/ {perUnit(l.unit)}</span></p>
    </div>
    <p class="farmer">by {l.farmer.name || 'AgriMatch farmer'}</p>

    <ul class="meta">
      <li><Package size={14} aria-hidden="true" /> {l.quantity.toLocaleString()} {unitLabel(l.unit)}</li>
      <li><MapPin size={14} aria-hidden="true" /> {l.location}</li>
      {#if match.distance !== null}<li><Navigation size={14} aria-hidden="true" /> {match.distance} km away</li>{/if}
      <li><Calendar size={14} aria-hidden="true" /> {formatDate(l.availableFrom)} to {formatDate(l.availableTo)}</li>
      {#if l.isOrganic}<li><Sprout size={14} aria-hidden="true" /> Organic</li>{/if}
    </ul>

    <div class="actions">
      <button type="button" class="btn btn-primary btn-sm" on:click={() => dispatch('contact', match)}>
        <MessageSquare size={14} aria-hidden="true" /> Contact seller
      </button>
      <Link to="/listings/{l.id}" class="btn btn-outline btn-sm">View listing</Link>
      <button type="button" class="toggle" aria-expanded={open} aria-controls={panelId} on:click={() => (open = !open)}>
        Why this score <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>

    {#if open}
      <div class="why" id={panelId}>
        {#each CRITERIA as [key, label]}
          <div class="why-row">
            <span>{label}</span>
            <span class="why-track" aria-hidden="true"><span class="why-fill" style="width: {match.breakdown[key]}%"></span></span>
            <span class="why-val">{match.breakdown[key]}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</article>

<style>
  .match {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  @media (min-width: 640px) { .match { grid-template-columns: 130px 1fr; } }

  .score { display: grid; justify-items: start; gap: var(--space-1); align-content: start; }
  @media (min-width: 640px) { .score { justify-items: center; text-align: center; } }
  .rank { font-size: var(--text-xs); font-weight: 600; color: var(--color-muted); }
  .pct { font-size: 2.25rem; font-weight: 600; letter-spacing: -0.03em; line-height: 1; color: var(--color-green-900); }

  .tier { padding: 2px var(--space-3); border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: 600; }
  .excellent { background: var(--color-green-100); color: var(--color-green-900); }
  .good { background: #d6f0ea; color: #0b4d44; }
  .fair { background: #fbebc4; color: #6b4a00; }
  .poor { background: var(--color-danger-bg); color: var(--color-danger); }

  .track { width: 100%; max-width: 130px; height: 6px; margin-top: var(--space-1); border-radius: 3px; background: var(--color-bg); overflow: hidden; }
  .fill { display: block; height: 100%; border-radius: 3px; }

  .top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
  h3 { font-size: var(--text-lg); }
  h3 :global(a:hover) { text-decoration: underline; }
  .price { font-size: var(--text-xl); font-weight: 600; color: var(--color-green-700); }
  .price span { font-size: var(--text-sm); font-weight: 400; color: var(--color-muted); }
  .farmer { font-size: var(--text-sm); color: var(--color-muted); }

  .meta { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); margin: var(--space-3) 0; padding: 0; list-style: none; font-size: var(--text-sm); color: var(--color-muted); }
  .meta li { display: inline-flex; align-items: center; gap: var(--space-1); }

  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .toggle {
    display: inline-flex; align-items: center; gap: var(--space-1); min-height: 44px; margin-left: auto; padding: 0 var(--space-2);
    border: 0; background: transparent; color: var(--color-green-700); font: inherit; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  }
  .toggle :global(svg) { transition: transform var(--dur-fast) var(--ease-out); }
  .toggle[aria-expanded='true'] :global(svg) { transform: rotate(180deg); }

  .why { display: grid; gap: var(--space-2); margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-line); }
  .why-row { display: grid; grid-template-columns: 6.5rem 1fr 2.25rem; align-items: center; gap: var(--space-3); font-size: var(--text-sm); }
  .why-track { height: 8px; border-radius: 4px; background: var(--color-bg); overflow: hidden; }
  .why-fill { display: block; height: 100%; background: var(--color-green-700); border-radius: 4px; }
  .why-val { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
