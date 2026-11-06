<script>
  import { onMount } from 'svelte';
  import { Link } from 'svelte-navigator';
  import { Plus, Pencil, Trash2, CircleCheck, EyeOff, RotateCcw, Package } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import ListingCard from '../components/listings/ListingCard.svelte';
  import Dialog from '../components/ui/Dialog.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api } from '../lib/api.js';
  import { showToast } from '../lib/toast.js';

  let status = 'loading';
  let error = '';
  let listings = [];
  let filter = 'ALL';
  let busyId = null;
  let toDelete = null;
  let deleting = false;

  const FILTERS = [
    ['ALL', 'All'],
    ['ACTIVE', 'Active'],
    ['SOLD', 'Sold'],
    ['DEACTIVATED', 'Paused']
  ];

  $: shown = filter === 'ALL' ? listings : listings.filter((l) => l.status === filter);
  $: counts = Object.fromEntries(FILTERS.map(([k]) => [k, k === 'ALL' ? listings.length : listings.filter((l) => l.status === k).length]));

  async function load() {
    status = 'loading';
    try {
      ({ listings } = await api.listings.mine());
      status = 'ready';
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  onMount(load);

  async function setStatus(listing, next, message) {
    busyId = listing.id;
    try {
      const { listing: updated } = await api.listings.update(listing.id, { status: next });
      listings = listings.map((l) => (l.id === listing.id ? { ...l, ...updated } : l));
      showToast(message, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      busyId = null;
    }
  }

  async function confirmDelete() {
    deleting = true;
    try {
      await api.listings.remove(toDelete.id);
      listings = listings.filter((l) => l.id !== toDelete.id);
      showToast('Listing deleted.', 'success');
      toDelete = null;
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      deleting = false;
    }
  }
</script>

<PageLayout current="listings" kicker="For farmers" title="My listings" lead="Everything you have listed, and how it is doing.">
  <section class="card" aria-labelledby="list-title">
    <div class="page-actions head">
      <h2 id="list-title" class="sr-only">Your listings</h2>
      <div class="chips" role="group" aria-label="Filter by status">
        {#each FILTERS as [key, label]}
          <button type="button" class="chip" aria-pressed={filter === key} on:click={() => (filter = key)}>{label} ({counts[key]})</button>
        {/each}
      </div>
      <Link to="/listings/new" class="btn btn-primary"><Plus size={16} aria-hidden="true" /> New listing</Link>
    </div>

    {#if status === 'loading'}
      <div class="stack"><span class="skeleton sk"></span><span class="skeleton sk"></span></div>
    {:else if status === 'error'}
      <ErrorState message={error} on:retry={load} />
    {:else if listings.length === 0}
      <div class="empty-state">
        <span class="icon-chip"><Package size={24} aria-hidden="true" /></span>
        <p>No produce listed yet. Add your first listing so buyers can find you.</p>
        <Link to="/listings/new" class="btn btn-primary">Add your first listing</Link>
      </div>
    {:else if shown.length === 0}
      <div class="empty-state">
        <p>No {FILTERS.find(([k]) => k === filter)[1].toLowerCase()} listings.</p>
        <button type="button" class="btn btn-outline btn-sm" on:click={() => (filter = 'ALL')}>Show all</button>
      </div>
    {:else}
      <div class="stack">
        {#each shown as listing (listing.id)}
          <ListingCard {listing}>
            <svelte:fragment slot="actions">
              <Link to="/listings/{listing.id}/edit" class="btn btn-outline btn-sm"><Pencil size={14} aria-hidden="true" /> Edit</Link>
              {#if listing.status === 'ACTIVE'}
                <button type="button" class="btn btn-outline btn-sm" disabled={busyId === listing.id} on:click={() => setStatus(listing, 'SOLD', 'Marked as sold.')}><CircleCheck size={14} aria-hidden="true" /> Mark sold</button>
                <button type="button" class="btn btn-outline btn-sm" disabled={busyId === listing.id} on:click={() => setStatus(listing, 'DEACTIVATED', 'Listing paused. Buyers will not see it.')}><EyeOff size={14} aria-hidden="true" /> Pause</button>
              {:else}
                <button type="button" class="btn btn-outline btn-sm" disabled={busyId === listing.id} on:click={() => setStatus(listing, 'ACTIVE', 'Listing is live again.')}><RotateCcw size={14} aria-hidden="true" /> Reactivate</button>
              {/if}
              <button type="button" class="btn btn-danger btn-sm" on:click={() => (toDelete = listing)}><Trash2 size={14} aria-hidden="true" /> Delete</button>
            </svelte:fragment>
          </ListingCard>
        {/each}
      </div>
    {/if}
  </section>
</PageLayout>

<Dialog open={!!toDelete} title="Delete this listing?" on:close={() => !deleting && (toDelete = null)}>
  <p>
    <strong>{toDelete?.produceType}</strong> in {toDelete?.location} will be removed for good, together with its photos and any
    conversations about it. To hide it without deleting, use Pause instead.
  </p>
  <svelte:fragment slot="actions">
    <button type="button" class="btn btn-outline" on:click={() => (toDelete = null)} disabled={deleting}>Keep it</button>
    <button type="button" class="btn btn-primary" on:click={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete listing'}</button>
  </svelte:fragment>
</Dialog>

<style>
  .head { margin-bottom: var(--space-6); }
  .sk { height: 150px; border-radius: var(--radius-md); }
</style>
