<script>
  import { onMount } from 'svelte';
  import { Link } from 'svelte-navigator';
  import { Search, Trash2 } from 'lucide-svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Pagination from '../ui/Pagination.svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import { api } from '../../lib/api.js';
  import { showToast } from '../../lib/toast.js';
  import { formatDate, money, perUnit, unitLabel } from '../../lib/format.js';

  let status = 'loading';
  let error = '';
  let items = [];
  let pagination = { page: 1, totalPages: 1, total: 0 };

  let search = '';
  let filter = '';
  let busyId = null;
  let toDelete = null;
  let deleting = false;
  let timer;

  async function load(page = 1) {
    status = items.length && status === 'ready' ? 'refreshing' : 'loading';
    try {
      const data = await api.admin.listings({ search: search.trim() || undefined, status: filter || undefined, page, limit: 15 });
      items = data.items;
      pagination = data.pagination;
      status = 'ready';
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  onMount(() => {
    load();
    return () => clearTimeout(timer);
  });

  const onSearch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(1), 300);
  };

  async function setStatus(listing, next) {
    busyId = listing.id;
    try {
      const { listing: updated } = await api.admin.setListingStatus(listing.id, next);
      items = items.map((l) => (l.id === listing.id ? { ...l, ...updated } : l));
      showToast(`Listing set to ${next.toLowerCase()}.`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
      await load(pagination.page);
    } finally {
      busyId = null;
    }
  }

  async function confirmDelete() {
    deleting = true;
    try {
      await api.admin.deleteListing(toDelete.id);
      showToast('Listing deleted.', 'success');
      toDelete = null;
      await load(items.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      deleting = false;
    }
  }
</script>

<section class="card" aria-labelledby="listings-title">
  <div class="card-header"><h2 id="listings-title">Listings</h2></div>

  <form class="filters" on:submit|preventDefault={() => load(1)} role="search">
    <div class="field">
      <label for="l-search" class="sr-only">Search listings</label>
      <div class="search"><Search size={16} aria-hidden="true" /><input id="l-search" type="search" bind:value={search} on:input={onSearch} placeholder="Search produce, town or farmer" /></div>
    </div>
    <div class="field">
      <label for="l-status" class="sr-only">Status</label>
      <select id="l-status" bind:value={filter} on:change={() => load(1)}>
        <option value="">Any status</option><option value="ACTIVE">Active</option><option value="SOLD">Sold</option><option value="DEACTIVATED">Paused</option><option value="EXPIRED">Expired</option>
      </select>
    </div>
  </form>

  {#if status === 'error'}
    <ErrorState message={error} on:retry={() => load(pagination.page)} />
  {:else if status === 'loading'}
    <div class="stack"><span class="skeleton sk"></span><span class="skeleton sk"></span><span class="skeleton sk"></span></div>
  {:else if items.length === 0}
    <div class="empty-state"><p>No listings match these filters.</p></div>
  {:else}
    <div class="table-wrap" class:dim={status === 'refreshing'}>
      <table>
        <caption class="sr-only">All listings</caption>
        <thead>
          <tr><th scope="col">Produce</th><th scope="col">Farmer</th><th scope="col">Price</th><th scope="col" class="num">Quantity</th><th scope="col">Town</th><th scope="col">Posted</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {#each items as l (l.id)}
            <tr>
              <th scope="row"><Link to="/listings/{l.id}" class="link">{l.produceType}</Link></th>
              <td>{l.farmer.name || l.farmer.phone}</td>
              <td>{money(l.pricePerUnit, l.currency)}/{perUnit(l.unit)}</td>
              <td class="num">{l.quantity.toLocaleString()} {unitLabel(l.unit)}</td>
              <td>{l.location}</td>
              <td>{formatDate(l.createdAt.slice(0, 10))}</td>
              <td>
                <label class="sr-only" for="status-{l.id}">Status of {l.produceType}</label>
                <select id="status-{l.id}" class="mini" value={l.status} disabled={busyId === l.id} on:change={(e) => setStatus(l, e.currentTarget.value)}>
                  <option value="ACTIVE">Active</option><option value="SOLD">Sold</option><option value="DEACTIVATED">Paused</option><option value="EXPIRED">Expired</option>
                </select>
              </td>
              <td class="act"><button type="button" class="btn btn-danger btn-sm" on:click={() => (toDelete = l)}><Trash2 size={14} aria-hidden="true" /> Delete</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Pagination {...pagination} disabled={status === 'refreshing'} on:page={(e) => load(e.detail)} />
  {/if}
</section>

<Dialog open={!!toDelete} title="Delete this listing?" on:close={() => !deleting && (toDelete = null)}>
  <p><strong>{toDelete?.produceType}</strong> by {toDelete?.farmer.name || toDelete?.farmer.phone} will be removed for good, with its photos and conversations. To hide it instead, set its status to Paused.</p>
  <svelte:fragment slot="actions">
    <button type="button" class="btn btn-outline" on:click={() => (toDelete = null)} disabled={deleting}>Keep it</button>
    <button type="button" class="btn btn-primary" on:click={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete listing'}</button>
  </svelte:fragment>
</Dialog>

<style>
  .filters { display: grid; gap: var(--space-3); margin-bottom: var(--space-4); }
  @media (min-width: 760px) { .filters { grid-template-columns: 1fr auto; } }
  .search { position: relative; }
  .search :global(svg) { position: absolute; left: 14px; top: 16px; color: var(--color-muted); }
  .search input { padding-left: 40px; }

  .table-wrap { overflow-x: auto; }
  .dim { opacity: 0.55; }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  th, td { padding: var(--space-3); border-bottom: 1px solid var(--color-line); text-align: left; white-space: nowrap; vertical-align: middle; }
  thead th { font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); }
  tbody th { font-weight: 600; }
  tbody th :global(.link):hover { text-decoration: underline; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .act { text-align: right; }
  .mini { min-height: 44px; width: auto; padding: 0 var(--space-2); }
  .sk { height: 48px; }
</style>
