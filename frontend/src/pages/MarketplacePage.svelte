<script>
  import { onMount, tick } from 'svelte';
  import { Link, useLocation } from 'svelte-navigator';
  import { ArrowRight, X, LoaderCircle, Search, Heart } from 'lucide-svelte';
  import StoreHeader from '../components/marketplace/StoreHeader.svelte';
  import ProductCard from '../components/marketplace/ProductCard.svelte';
  import FilterDialog from '../components/marketplace/FilterDialog.svelte';
  import SiteFooter from '../components/SiteFooter.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api } from '../lib/api.js';
  import { session } from '../lib/auth.js';
  import { saved } from '../lib/saved.js';
  import { CATEGORY_META, CATEGORY_KEYS, categoryMeta, isRecent } from '../lib/marketplace.js';

  const location = useLocation();
  const PAGE_SIZE = 12;
  const EMPTY_FILTERS = { minQuantity: '', maxPrice: '', location: '', organic: false };

  let query = '';
  let category = '';
  let filters = { ...EMPTY_FILTERS };
  let showSaved = false;
  let filtersOpen = false;

  let status = 'loading';
  let error = '';
  let items = [];
  let pagination = { page: 1, total: 0, totalPages: 1 };
  let loadingMore = false;
  let catStats = {};
  let resultsEl;
  let seq = 0; // ignore responses from superseded requests

  $: activeFilters = [filters.location, filters.minQuantity, filters.maxPrice, filters.organic].filter(Boolean).length;
  $: buyer = $session?.role === 'BUYER';

  function buildQuery(page) {
    return {
      produce: query || undefined,
      category: category || undefined,
      location: filters.location || undefined,
      minQuantity: filters.minQuantity || undefined,
      maxPrice: filters.maxPrice || undefined,
      organic: filters.organic || undefined,
      page,
      limit: PAGE_SIZE
    };
  }

  async function load() {
    if (showSaved) return;
    const mine = ++seq;
    status = 'loading';
    try {
      const data = await api.listings.list(buildQuery(1));
      if (mine !== seq) return;
      items = data.items;
      pagination = data.pagination;
      status = 'ready';
    } catch (e) {
      if (mine !== seq) return;
      error = e.message;
      status = 'error';
    }
  }

  async function loadMore() {
    loadingMore = true;
    try {
      const data = await api.listings.list(buildQuery(pagination.page + 1));
      items = [...items, ...data.items.filter((n) => !items.some((i) => i.id === n.id))];
      pagination = data.pagination;
    } catch (e) {
      error = e.message;
    } finally {
      loadingMore = false;
    }
  }

  async function loadCategoryStats() {
    const rows = await Promise.allSettled(CATEGORY_KEYS.map((c) => api.listings.list({ category: c, limit: 1 })));
    catStats = Object.fromEntries(
      rows.map((r, i) => [CATEGORY_KEYS[i], r.status === 'fulfilled' ? { total: r.value.pagination.total, newest: r.value.items[0]?.createdAt } : { total: 0 }])
    );
  }

  onMount(() => {
    const params = new URLSearchParams($location.search);
    category = CATEGORY_KEYS.includes(params.get('category')) ? params.get('category') : '';
    query = params.get('q') ?? '';
    load();
    loadCategoryStats();
  });

  const toResults = async () => {
    await tick();
    resultsEl?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  function pickCategory(key, scroll = true) {
    category = key;
    showSaved = false;
    load();
    if (scroll) toResults();
  }

  function search(e) {
    query = e.detail;
    showSaved = false;
    load();
    toResults();
  }

  function applyFilters(e) {
    filters = e.detail;
    filtersOpen = false;
    load();
    if (showSaved) return;
    toResults();
  }

  function toggleSavedView() {
    showSaved = !showSaved;
    if (!showSaved) load();
    else toResults();
  }

  function shopOrganic() {
    filters = { ...filters, organic: true };
    showSaved = false;
    load();
    toResults();
  }

  function removeChip(kind) {
    if (kind === 'category') category = '';
    else if (kind === 'query') query = '';
    else if (kind === 'organic') filters = { ...filters, organic: false };
    else filters = { ...filters, [kind]: '' };
    load();
  }

  function resetAll() {
    query = '';
    category = '';
    filters = { ...EMPTY_FILTERS };
    showSaved = false;
    load();
  }

  $: chips = [
    category && ['category', categoryMeta(category).label],
    query && ['query', `"${query}"`],
    filters.location && ['location', filters.location],
    filters.minQuantity && ['minQuantity', `${filters.minQuantity}+ units`],
    filters.maxPrice && ['maxPrice', `up to GHS ${filters.maxPrice}`],
    filters.organic && ['organic', 'Organic']
  ].filter(Boolean);

  // Saved listings are filtered here (they live on this device, not on the server)
  $: savedShown = $saved.filter(
    (s) =>
      (!category || s.category === category) &&
      (!query || s.produceType.toLowerCase().includes(query.toLowerCase())) &&
      (!filters.location || s.location === filters.location) &&
      (!filters.organic || s.isOrganic) &&
      (!filters.maxPrice || s.pricePerUnit <= Number(filters.maxPrice)) &&
      (!filters.minQuantity || s.quantity >= Number(filters.minQuantity))
  );
  $: shown = showSaved ? savedShown : items;
  $: heading = showSaved ? 'Saved listings' : category ? categoryMeta(category).label : query ? 'Search results' : 'Fresh from the farm';
  $: total = showSaved ? savedShown.length : pagination.total;
</script>

<svelte:head><title>Marketplace · AgriMatch</title></svelte:head>

<div class="store">
  <StoreHeader bind:query {activeFilters} showingSaved={showSaved} on:search={search} on:filters={() => (filtersOpen = true)} on:saved={toggleSavedView} />

  <div class="shell">
    <aside class="sidebar" aria-label="Categories">
      <h2 class="display">Categories</h2>
      <ul>
        <li><button type="button" class:active={!category && !showSaved} aria-pressed={!category && !showSaved} on:click={() => pickCategory('')}>All produce</button></li>
        {#each CATEGORY_KEYS as key}
          <li>
            <button type="button" class:active={category === key} aria-pressed={category === key} on:click={() => pickCategory(key)}>
              {CATEGORY_META[key].label}
              {#if catStats[key]}<span class="count">{catStats[key].total}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </aside>

    <main class="main">
      <!-- Hero -->
      <section class="hero" aria-label="Featured">
        <div class="banner">
          <img src="/images/market/hero.jpg" alt="Women selling fresh tomatoes at a market in Ghana" fetchpriority="high" />
          <div class="copy">
            <h1 class="display big">Fresh from<br />the farm!</h1>
            <p>Straight from Ghanaian farmers, at fair prices.</p>
            <button type="button" class="btn btn-primary" on:click={() => pickCategory('VEGETABLES')}>Shop vegetables</button>
          </div>
        </div>

        <div class="tiles">
          <div class="tile peach">
            <h2 class="display">Find your <span class="accent">best match</span></h2>
            <p>Tell us what you need and we rank every listing for you.</p>
            {#if buyer}
              <Link to="/search" class="btn btn-dark btn-sm">Smart match <ArrowRight size={14} aria-hidden="true" /></Link>
            {:else}
              <Link to="/market" class="btn btn-dark btn-sm">Price trends <ArrowRight size={14} aria-hidden="true" /></Link>
            {/if}
          </div>
          <div class="tile sky">
            <div class="tile-copy">
              <h2 class="display">Organic<br />produce</h2>
              <button type="button" class="btn btn-dark btn-sm" on:click={shopOrganic}>Shop organic</button>
            </div>
            <img src="/images/market/organic.jpg" alt="" loading="lazy" />
          </div>
        </div>
      </section>

      <!-- Categories -->
      <section aria-labelledby="explore-title">
        <div class="section-head">
          <h2 id="explore-title" class="display">Explore popular categories</h2>
          <button type="button" class="see-all" on:click={() => pickCategory('')}>See all <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
        <ul class="cats">
          {#each CATEGORY_KEYS.slice(0, 4) as key}
            {@const m = CATEGORY_META[key]}
            <li>
              <button type="button" class="cat" style="--tint: {m.tint}" on:click={() => pickCategory(key)}>
                <span class="cat-photo">
                  <img src={m.image} alt="" loading="lazy" />
                  {#if catStats[key]?.newest && isRecent(catStats[key].newest, 7)}<span class="pill">New</span>
                  {:else if catStats[key]}<span class="pill">{catStats[key].total} {catStats[key].total === 1 ? 'listing' : 'listings'}</span>{/if}
                </span>
                <span class="cat-name">{m.label}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>

      <!-- Results -->
      <section class="results" bind:this={resultsEl} aria-labelledby="results-title" aria-busy={status === 'loading'}>
        <div class="section-head">
          <h2 id="results-title" class="display">{heading}</h2>
          <p class="muted total" aria-live="polite">{status === 'ready' || showSaved ? `${total} ${total === 1 ? 'listing' : 'listings'}` : ''}</p>
        </div>

        {#if chips.length}
          <ul class="chips" aria-label="Active filters">
            {#each chips as [kind, label]}
              <li><button type="button" class="chip on" on:click={() => removeChip(kind)} aria-label="Remove filter: {label}">{label} <X size={14} aria-hidden="true" /></button></li>
            {/each}
            <li><button type="button" class="link-btn" on:click={resetAll}>Clear all</button></li>
          </ul>
        {/if}

        {#if showSaved && shown.length === 0}
          <div class="empty">
            <span class="icon-chip"><Heart size={24} aria-hidden="true" /></span>
            <p>{$saved.length ? 'None of your saved listings match these filters.' : 'Tap the heart on a listing to save it here for later.'}</p>
            <button type="button" class="btn btn-outline btn-sm" on:click={toggleSavedView}>Browse the marketplace</button>
          </div>
        {:else if !showSaved && status === 'loading'}
          <div class="grid">{#each Array(8) as _}<span class="skeleton card-sk"></span>{/each}</div>
        {:else if !showSaved && status === 'error'}
          <ErrorState message={error} on:retry={load} />
        {:else if shown.length === 0}
          <div class="empty">
            <span class="icon-chip"><Search size={24} aria-hidden="true" /></span>
            <p>Nothing matches yet. Try another category or loosen the filters.</p>
            <button type="button" class="btn btn-outline btn-sm" on:click={resetAll}>Clear filters</button>
          </div>
        {:else}
          <div class="grid">
            {#each shown as listing (listing.id)}<ProductCard {listing} />{/each}
          </div>
          {#if !showSaved && pagination.page < pagination.totalPages}
            <div class="more">
              <button type="button" class="btn btn-outline" on:click={loadMore} disabled={loadingMore}>
                {#if loadingMore}<span class="spin"><LoaderCircle size={16} aria-hidden="true" /></span> Loading...{:else}Show more ({pagination.total - items.length} left){/if}
              </button>
            </div>
          {/if}
        {/if}
      </section>
    </main>
  </div>

  <SiteFooter />
</div>

<FilterDialog open={filtersOpen} {filters} on:apply={applyFilters} on:close={() => (filtersOpen = false)} />

<style>
  .store { min-height: 100dvh; background: #fff; }
  .display { font-family: var(--font-display); font-weight: 400; letter-spacing: 0.01em; line-height: 1.1; }

  .shell { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-6); max-width: 1440px; margin: 0 auto; padding: var(--space-2) var(--gutter) var(--space-16); }
  @media (min-width: 1000px) { .shell { grid-template-columns: 190px minmax(0, 1fr); gap: var(--space-8); } }

  /* ─── Sidebar ─── */
  .sidebar { min-width: 0; }
  .sidebar h2 { margin-bottom: var(--space-4); font-size: 1.75rem; }
  .sidebar ul { display: flex; gap: var(--space-2); margin: 0; padding: 0 0 var(--space-1); list-style: none; overflow-x: auto; scrollbar-width: none; }
  .sidebar ul::-webkit-scrollbar { display: none; }
  .sidebar button {
    display: inline-flex; align-items: center; gap: var(--space-2); width: 100%; min-height: 44px; padding: 0 var(--space-4);
    border: 0; border-radius: var(--radius-pill); background: var(--tint-gray); color: var(--color-ink);
    font: inherit; font-size: var(--text-sm); white-space: nowrap; cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out);
  }
  .sidebar button:hover { background: #e8e6e1; }
  .sidebar button.active { background: var(--color-green-900); color: #fff; font-weight: 600; }
  .count { margin-left: auto; font-size: var(--text-xs); opacity: 0.7; }
  @media (min-width: 1000px) {
    .sidebar { position: sticky; top: 96px; align-self: start; }
    .sidebar h2 { margin-top: var(--space-4); }
    .sidebar ul { flex-direction: column; gap: 2px; overflow: visible; }
    .sidebar button { border-radius: var(--radius-sm); background: transparent; padding: 0 var(--space-3); }
    .sidebar button:hover { background: var(--tint-gray); }
    .sidebar button.active { background: var(--tint-green); color: var(--color-green-900); box-shadow: inset 3px 0 0 var(--color-orange-600); }
  }

  .main { display: grid; gap: var(--space-8); min-width: 0; }

  /* ─── Hero ─── */
  .hero { display: grid; gap: var(--space-4); }
  @media (min-width: 1100px) { .hero { grid-template-columns: 2fr 1fr; } }

  .banner {
    position: relative; display: flex; align-items: flex-end; overflow: hidden; min-height: 420px; border-radius: 28px;
    background: linear-gradient(115deg, var(--tint-butter) 0%, var(--tint-peach) 50%, var(--tint-sky) 100%);
  }
  .banner img {
    position: absolute; inset: 0 0 auto 0; width: 100%; height: 62%; object-fit: cover;
    -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent); mask-image: linear-gradient(to bottom, #000 55%, transparent);
  }
  .copy { position: relative; display: grid; justify-items: start; gap: var(--space-3); padding: var(--space-6); }
  .big { font-size: clamp(2.25rem, 7vw, 3.75rem); text-transform: uppercase; }
  .copy p { max-width: 30ch; color: var(--color-muted); font-size: var(--text-sm); }
  @media (min-width: 700px) {
    .banner { align-items: center; min-height: 340px; }
    .banner img { inset: 0 0 0 auto; width: 58%; height: 100%; -webkit-mask-image: linear-gradient(to right, transparent, #000 45%); mask-image: linear-gradient(to right, transparent, #000 45%); }
    .copy { padding: var(--space-8) var(--space-12); max-width: 55%; }
  }

  .tiles { display: grid; gap: var(--space-4); }
  @media (min-width: 700px) and (max-width: 1099px) { .tiles { grid-template-columns: 1fr 1fr; } }
  .tile { position: relative; display: grid; align-content: center; gap: var(--space-3); justify-items: start; overflow: hidden; padding: var(--space-6); border-radius: 28px; }
  .tile h2 { font-size: 1.75rem; }
  .tile p { max-width: 26ch; font-size: var(--text-sm); color: var(--color-muted); }
  .accent { color: var(--color-orange-600); }
  .peach { background: linear-gradient(120deg, var(--tint-peach), #fff 90%); }
  .sky { grid-template-columns: 1fr 42%; align-items: center; background: linear-gradient(120deg, var(--tint-sky), #fff 95%); }
  .sky img { width: 100%; height: 100%; min-height: 130px; border-radius: 20px; object-fit: cover; }
  .tile-copy { display: grid; gap: var(--space-3); justify-items: start; }
  .tile :global(.btn-dark) { text-decoration: none; }

  /* ─── Categories ─── */
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
  .section-head h2 { font-size: clamp(1.5rem, 3.4vw, 2rem); }
  .see-all {
    display: inline-flex; align-items: center; gap: var(--space-2); min-height: 44px; padding: 0 var(--space-4);
    border: 0; border-radius: var(--radius-pill); background: var(--tint-gray); color: var(--color-ink); font: inherit; font-size: var(--text-xs); font-weight: 600; cursor: pointer;
  }
  .see-all:hover { background: #e8e6e1; }

  .cats { display: grid; gap: var(--space-4); margin: 0; padding: 0; list-style: none; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (min-width: 900px) { .cats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .cat {
    display: grid; gap: var(--space-3); width: 100%; padding: var(--space-3) var(--space-3) var(--space-4); border: 0; border-radius: 28px;
    background: var(--tint); color: var(--color-ink); font: inherit; text-align: center; cursor: pointer;
    transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
  }
  .cat:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
  .cat-photo { position: relative; display: block; aspect-ratio: 1 / 0.82; overflow: hidden; border-radius: 20px; }
  .cat-photo img { width: 100%; height: 100%; object-fit: cover; }
  .pill { position: absolute; top: var(--space-2); left: var(--space-2); padding: 3px 10px; border-radius: var(--radius-pill); background: rgba(22, 32, 27, 0.78); color: #fff; font-size: var(--text-xs); font-weight: 600; }
  .cat-name { font-size: var(--text-sm); font-weight: 500; }

  /* ─── Results ─── */
  .total { font-size: var(--text-sm); }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-4); padding: 0; list-style: none; }
  .chips .chip { gap: var(--space-2); background: var(--color-green-900); border-color: var(--color-green-900); color: #fff; }
  .link-btn { min-height: 44px; padding: 0 var(--space-2); border: 0; background: transparent; color: var(--color-green-700); font: inherit; font-size: var(--text-sm); font-weight: 600; text-decoration: underline; cursor: pointer; }

  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); }
  .card-sk { aspect-ratio: 4 / 4.2; border-radius: 28px; }
  .more { display: flex; justify-content: center; margin-top: var(--space-6); }
  .empty { display: grid; justify-items: center; gap: var(--space-3); padding: var(--space-12) var(--space-4); border-radius: 28px; background: var(--tint-gray); text-align: center; color: var(--color-muted); }
  .spin { display: inline-flex; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) { .cat:hover { transform: none; } }
</style>
