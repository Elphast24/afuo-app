<script>
  import { onMount } from 'svelte';
  import { useLocation } from 'svelte-navigator';
  import { Search, Leaf, Package, Banknote, MapPin, Calendar, Sprout, RotateCcw, LoaderCircle, SlidersHorizontal } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import WeightSliders from '../components/search/WeightSliders.svelte';
  import MatchCard from '../components/search/MatchCard.svelte';
  import ContactDialog from '../components/messages/ContactDialog.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api } from '../lib/api.js';
  import { session } from '../lib/auth.js';
  import { ALL_PRODUCE, CITIES } from '../lib/format.js';

  const location = useLocation();
  const DEFAULT_WEIGHTS = { produce: 30, quantity: 20, location: 25, price: 15, availability: 10 };

  let produce = '';
  let quantity = '';
  let maxPrice = '';
  let town = $session?.location && CITIES.includes($session.location) ? $session.location : '';
  let requiredBy = '';
  let organicOnly = false;
  let weights = { ...DEFAULT_WEIGHTS };

  let status = 'loading';
  let error = '';
  let results = [];
  let total = 0;
  let searched = false;
  let contact = null;

  async function run() {
    status = 'loading';
    const query = { organicOnly, limit: 30, weights };
    if (produce.trim()) query.produce = produce.trim();
    if (Number(quantity) > 0) query.quantity = Number(quantity);
    if (Number(maxPrice) > 0) query.maxPrice = Number(maxPrice);
    if (town) query.location = town;
    if (requiredBy) query.requiredBy = requiredBy;

    try {
      const data = await api.match(query);
      results = data.results;
      total = data.totalMatches;
      searched = true;
      status = 'ready';
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  function reset() {
    produce = quantity = maxPrice = requiredBy = '';
    town = '';
    organicOnly = false;
    weights = { ...DEFAULT_WEIGHTS };
    run();
  }

  onMount(() => {
    produce = new URLSearchParams($location.search).get('produce') ?? '';
    run();
  });
</script>

<PageLayout current="search" kicker="For buyers" title="Find produce" lead="Describe what you need. We rank every listing by how well it fits, and show you why.">
  <div class="layout">
    <section class="card form-card" aria-labelledby="search-title">
      <div class="card-header">
        <span class="icon-chip"><Search size={20} aria-hidden="true" /></span>
        <h2 id="search-title">What do you need?</h2>
      </div>

      <form on:submit|preventDefault={run} class="stack" novalidate>
        <div class="field">
          <label for="produce"><Leaf size={16} aria-hidden="true" /> Produce</label>
          <input id="produce" type="text" list="produce-options" bind:value={produce} placeholder="e.g. Maize" autocomplete="off" />
          <datalist id="produce-options">{#each ALL_PRODUCE as p}<option value={p}></option>{/each}</datalist>
        </div>

        <div class="two">
          <div class="field">
            <label for="qty"><Package size={16} aria-hidden="true" /> Quantity needed</label>
            <input id="qty" type="number" inputmode="decimal" min="1" bind:value={quantity} placeholder="e.g. 200" />
          </div>
          <div class="field">
            <label for="price"><Banknote size={16} aria-hidden="true" /> Budget / unit (GHS)</label>
            <input id="price" type="number" inputmode="decimal" min="1" bind:value={maxPrice} placeholder="e.g. 25" />
          </div>
        </div>

        <div class="two">
          <div class="field">
            <label for="town"><MapPin size={16} aria-hidden="true" /> Where are you?</label>
            <select id="town" bind:value={town}>
              <option value="">Anywhere</option>
              {#each CITIES as c}<option value={c}>{c}</option>{/each}
            </select>
          </div>
          <div class="field">
            <label for="when"><Calendar size={16} aria-hidden="true" /> Needed by</label>
            <input id="when" type="date" bind:value={requiredBy} />
          </div>
        </div>

        <label class="check" for="organic"><input id="organic" type="checkbox" bind:checked={organicOnly} /> <Sprout size={16} aria-hidden="true" /> Organic only</label>

        <details class="priorities">
          <summary><SlidersHorizontal size={16} aria-hidden="true" /> Adjust what matters most</summary>
          <WeightSliders bind:weights />
        </details>

        <div class="actions">
          <button type="submit" class="btn btn-primary" disabled={status === 'loading'}>
            {#if status === 'loading'}<span class="spin"><LoaderCircle size={16} aria-hidden="true" /></span> Searching...{:else}<Search size={16} aria-hidden="true" /> Find matches{/if}
          </button>
          <button type="button" class="btn btn-outline" on:click={reset}><RotateCcw size={16} aria-hidden="true" /> Reset</button>
        </div>
      </form>
    </section>

    <section class="results" aria-labelledby="results-title" aria-busy={status === 'loading'}>
      <h2 id="results-title" class="count" aria-live="polite">
        {#if status === 'ready'}{total} {total === 1 ? 'match' : 'matches'}{#if total > results.length} <span class="muted">(showing the top {results.length})</span>{/if}{:else}Matches{/if}
      </h2>

      {#if status === 'loading' && !searched}
        <div class="stack"><span class="skeleton sk"></span><span class="skeleton sk"></span><span class="skeleton sk"></span></div>
      {:else if status === 'error'}
        <div class="card"><ErrorState message={error} on:retry={run} /></div>
      {:else if results.length === 0}
        <div class="card empty-state">
          <span class="icon-chip"><Search size={24} aria-hidden="true" /></span>
          <p>Nothing matches yet. Try a different produce name, or loosen the filters.</p>
          <button type="button" class="btn btn-outline btn-sm" on:click={reset}>Clear everything</button>
        </div>
      {:else}
        <div class="stack" class:dim={status === 'loading'}>
          {#each results as match (match.listing.id)}
            <MatchCard {match} on:contact={(e) => (contact = { id: e.detail.listing.id, produceType: e.detail.listing.produceType, farmerName: e.detail.listing.farmer.name })} />
          {/each}
        </div>
      {/if}
    </section>
  </div>
</PageLayout>

<ContactDialog open={!!contact} target={contact} on:close={() => (contact = null)} />

<style>
  .layout { display: grid; gap: var(--space-6); align-items: start; }
  @media (min-width: 1000px) {
    .layout { grid-template-columns: 380px 1fr; }
    .form-card { position: sticky; top: var(--space-4); }
  }

  .two { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .spin { display: inline-flex; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .priorities { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: 0 var(--space-4); }
  .priorities summary {
    display: flex; align-items: center; gap: var(--space-2); min-height: 48px; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  }
  .priorities[open] { padding-bottom: var(--space-4); }
  .priorities[open] summary { margin-bottom: var(--space-2); }

  .count { margin-bottom: var(--space-4); font-size: var(--text-xl); }
  .sk { height: 180px; border-radius: var(--radius-md); }
  .dim { opacity: 0.55; transition: opacity var(--dur-fast); }
</style>
