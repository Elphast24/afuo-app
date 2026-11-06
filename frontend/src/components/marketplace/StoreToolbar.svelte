<script>
  import { createEventDispatcher } from 'svelte';
  import { Search, SlidersHorizontal, Heart, X } from 'lucide-svelte';
  import { saved } from '../../lib/saved.js';

  /** current search text (bindable) */
  export let query = '';
  export let activeFilters = 0;
  export let showingSaved = false;

  const dispatch = createEventDispatcher();
</script>

<!-- Lives in the page banner under the shared site header, so it is styled for a dark background -->
<div class="toolbar">
  <form class="search" role="search" on:submit|preventDefault={() => dispatch('search', query.trim())}>
    <Search size={18} aria-hidden="true" />
    <label for="store-search" class="sr-only">Search produce</label>
    <input id="store-search" type="search" bind:value={query} placeholder="Search tomatoes, maize, plantain..." autocomplete="off" />
    {#if query}
      <button type="button" class="clear" aria-label="Clear search" on:click={() => { query = ''; dispatch('search', ''); }}><X size={16} aria-hidden="true" /></button>
    {/if}
  </form>

  <button type="button" class="pill-btn" aria-label="Filters{activeFilters ? `, ${activeFilters} active` : ''}" on:click={() => dispatch('filters')}>
    <SlidersHorizontal size={18} aria-hidden="true" />
    <span class="label">Filters</span>
    {#if activeFilters}<span class="dot">{activeFilters}</span>{/if}
  </button>

  <button type="button" class="pill-btn" class:on={showingSaved} aria-pressed={showingSaved} aria-label="Saved listings, {$saved.length}" on:click={() => dispatch('saved')}>
    <Heart size={18} aria-hidden="true" fill={showingSaved ? 'currentColor' : 'none'} />
    <span class="label">Saved</span>
    {#if $saved.length}<span class="dot soft">{$saved.length}</span>{/if}
  </button>
</div>

<style>
  .toolbar {
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-template-areas: 'search search search' 'filters saved .';
    justify-content: start;
    gap: var(--space-3);
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 var(--gutter);
  }
  @media (min-width: 640px) {
    .toolbar { grid-template-columns: minmax(0, 640px) auto auto; grid-template-areas: 'search filters saved'; }
  }
  .toolbar :global(button:focus-visible), .search input:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }

  .search {
    grid-area: search;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 52px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    background: #fff;
    color: var(--color-muted);
    box-shadow: var(--shadow-md);
  }
  .search input { flex: 1; min-width: 0; min-height: 48px; padding: 0; border: 0; background: transparent; color: var(--color-ink); font-size: 1rem; }
  .search input:focus-visible { outline: none; box-shadow: none; border: 0; }
  .search:focus-within { box-shadow: 0 0 0 3px var(--color-orange-600), var(--shadow-md); }
  .search input::-webkit-search-cancel-button { display: none; }
  .clear { display: grid; place-items: center; width: 44px; height: 44px; margin-right: -12px; border: 0; border-radius: 50%; background: transparent; color: var(--color-muted); cursor: pointer; }
  .clear:hover { background: rgba(0, 0, 0, 0.06); }

  .pill-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 52px;
    padding: 0 var(--space-6);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-pill);
    background: rgba(15, 32, 24, 0.55);
    color: #fff;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  }
  .pill-btn:nth-of-type(1) { grid-area: filters; }
  .pill-btn:nth-of-type(2) { grid-area: saved; }
  .pill-btn:hover { background: rgba(255, 255, 255, 0.16); }
  .pill-btn:active { transform: scale(0.97); }
  .pill-btn.on { background: #fff; color: var(--color-orange-700); border-color: #fff; }

  .dot {
    display: grid;
    place-items: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--color-orange-600);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 700;
  }
  .dot.soft { background: #fff; color: var(--color-ink); }
  .pill-btn.on .dot.soft { background: var(--color-orange-600); color: #fff; }
</style>
