<script>
  import { onMount } from 'svelte';
  import { useNavigate, useParams } from 'svelte-navigator';
  import { ClipboardList } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import ListingForm from '../components/listings/ListingForm.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api } from '../lib/api.js';
  import { session } from '../lib/auth.js';

  /** true on /listings/:id/edit */
  export let editing = false;

  const navigate = useNavigate();
  const params = useParams();

  let status = editing ? 'loading' : 'ready';
  let error = '';
  let listing = null;

  async function load() {
    status = 'loading';
    try {
      const data = await api.listings.get($params.id);
      if (data.listing.farmerId !== $session.id && $session.role !== 'ADMIN') {
        error = 'You can only edit your own listings.';
        status = 'error';
        return;
      }
      listing = data.listing;
      status = 'ready';
    } catch (e) {
      error = e.code === 'NOT_FOUND' ? 'That listing no longer exists.' : e.message;
      status = 'error';
    }
  }

  onMount(() => {
    if (editing) load();
  });

  function saved(e) {
    // If photos failed after the listing saved, open it for editing so they can retry
    navigate(e.detail.photosFailed ? `/listings/${e.detail.id}/edit` : '/listings');
  }
</script>

<PageLayout
  current="listings"
  kicker="For farmers"
  title={editing ? 'Edit listing' : 'New listing'}
  lead={editing ? 'Update the details, price or availability.' : 'List what you have, set your price and let buyers find you.'}
>
  <section class="card" aria-labelledby="form-title">
    <div class="card-header">
      <span class="icon-chip"><ClipboardList size={20} aria-hidden="true" /></span>
      <h2 id="form-title">Produce details</h2>
    </div>

    {#if status === 'loading'}
      <div class="stack"><span class="skeleton sk"></span><span class="skeleton sk"></span><span class="skeleton sk"></span></div>
    {:else if status === 'error'}
      <ErrorState message={error} retry={false} />
    {:else}
      <ListingForm {listing} on:saved={saved} on:cancel={() => navigate('/listings')} />
    {/if}
  </section>
</PageLayout>

<style>
  .sk { height: 48px; }
</style>
