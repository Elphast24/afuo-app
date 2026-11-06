<script>
  import { onMount } from 'svelte';
  import { Link, useParams } from 'svelte-navigator';
  import { Package, MapPin, Calendar, Eye, Sprout, Phone, MessageSquare, Pencil, Star, Package as Box } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import ContactDialog from '../components/messages/ContactDialog.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api, assetUrl } from '../lib/api.js';
  import { session } from '../lib/auth.js';
  import { CATEGORIES, formatDate, initials, money, perUnit, unitLabel } from '../lib/format.js';

  const params = useParams();

  let status = 'loading';
  let error = '';
  let listing = null;
  let rating = null;
  let selected = 0;
  let showPhone = false;
  let contacting = false;

  $: isOwner = listing && listing.farmerId === $session.id;
  $: images = listing?.images ?? [];
  $: farmer = listing?.farmer;

  async function load() {
    status = 'loading';
    try {
      ({ listing } = await api.listings.get($params.id));
      selected = Math.max(0, images.findIndex((i) => i.isPrimary));
      status = 'ready';
      api.reviews.forUser(listing.farmer.id).then((r) => (rating = r)).catch(() => {});
    } catch (e) {
      error = e.code === 'NOT_FOUND' ? 'This listing no longer exists.' : e.message;
      status = 'error';
    }
  }

  onMount(load);
</script>

<PageLayout
  current={$session.role === 'BUYER' ? 'search' : 'listings'}
  kicker={listing ? CATEGORIES[listing.category] : 'Listing'}
  title={listing ? listing.produceType : 'Listing'}
  lead={listing ? `${listing.location} · ${money(listing.pricePerUnit, listing.currency)} per ${perUnit(listing.unit)}` : ''}
>
  {#if status === 'loading'}
    <div class="card"><span class="skeleton sk-big"></span></div>
  {:else if status === 'error'}
    <section class="card"><ErrorState message={error} retry={error !== 'This listing no longer exists.'} on:retry={load} /></section>
  {:else}
    <div class="layout">
      <section class="card gallery" aria-label="Photos">
        {#if images.length}
          <img class="main" src={assetUrl(images[selected]?.url)} alt="{listing.produceType} from {listing.location}, photo {selected + 1} of {images.length}" />
          {#if images.length > 1}
            <ul class="thumbs">
              {#each images as img, i (img.id)}
                <li>
                  <button type="button" class:on={i === selected} aria-label="Show photo {i + 1}" aria-pressed={i === selected} on:click={() => (selected = i)}>
                    <img src={assetUrl(img.url)} alt="" loading="lazy" />
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          <div class="no-photo"><Box size={40} aria-hidden="true" /><p>No photos yet</p></div>
        {/if}
      </section>

      <div class="stack side">
        <section class="card" aria-labelledby="facts-title">
          <div class="head">
            <h2 id="facts-title" class="price">{money(listing.pricePerUnit, listing.currency)} <span>/ {perUnit(listing.unit)}</span></h2>
            <span class="badge" class:badge-warm={listing.status !== 'ACTIVE'}>{listing.status.toLowerCase()}</span>
          </div>
          <ul class="facts">
            <li><Package size={16} aria-hidden="true" /> <span><strong>{listing.quantity.toLocaleString()}</strong> {unitLabel(listing.unit)} available</span></li>
            <li><MapPin size={16} aria-hidden="true" /> {listing.location}</li>
            <li><Calendar size={16} aria-hidden="true" /> {formatDate(listing.availableFrom)} to {formatDate(listing.availableTo)}</li>
            {#if listing.isOrganic}<li><Sprout size={16} aria-hidden="true" /> Organic</li>{/if}
            <li><Eye size={16} aria-hidden="true" /> {listing.viewCount} {listing.viewCount === 1 ? 'view' : 'views'}</li>
          </ul>
          {#if listing.description}<p class="desc">{listing.description}</p>{/if}
        </section>

        <section class="card" aria-labelledby="seller-title">
          <h2 id="seller-title" class="sr-only">Seller</h2>
          <div class="seller">
            <span class="avatar" aria-hidden="true">{initials(farmer.name)}</span>
            <div>
              <strong>{farmer.name || 'AgriMatch farmer'}</strong>
              <p class="muted rate">
                <Star size={14} aria-hidden="true" />
                {#if rating && rating.count}{rating.averageRating.toFixed(1)} ({rating.count} {rating.count === 1 ? 'review' : 'reviews'}){:else}No reviews yet{/if}
              </p>
            </div>
          </div>

          {#if isOwner}
            <div class="actions"><Link to="/listings/{listing.id}/edit" class="btn btn-primary"><Pencil size={16} aria-hidden="true" /> Edit listing</Link></div>
          {:else}
            <div class="actions">
              <button type="button" class="btn btn-primary" on:click={() => (contacting = true)} disabled={listing.status !== 'ACTIVE'}>
                <MessageSquare size={16} aria-hidden="true" /> Message seller
              </button>
              {#if showPhone}
                <a class="btn btn-outline" href="tel:{farmer.phone}"><Phone size={16} aria-hidden="true" /> {farmer.phone}</a>
              {:else}
                <button type="button" class="btn btn-outline" on:click={() => (showPhone = true)}><Phone size={16} aria-hidden="true" /> Show phone number</button>
              {/if}
            </div>
            {#if listing.status !== 'ACTIVE'}<p class="muted note">This listing is {listing.status.toLowerCase()}, so messaging is turned off.</p>{/if}
          {/if}
        </section>
      </div>
    </div>
  {/if}
</PageLayout>

<ContactDialog open={contacting} target={listing ? { id: listing.id, produceType: listing.produceType, farmerName: listing.farmer.name } : null} on:close={() => (contacting = false)} />

<style>
  .layout { display: grid; gap: var(--space-6); align-items: start; }
  @media (min-width: 900px) { .layout { grid-template-columns: 1.3fr 1fr; } }

  .gallery { display: grid; gap: var(--space-3); padding: var(--space-3); }
  .main { width: 100%; max-height: 520px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radius-sm); background: var(--color-bg); }
  .thumbs { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
  .thumbs button { width: 64px; height: 64px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: var(--radius-sm); background: none; cursor: pointer; }
  .thumbs button.on { border-color: var(--color-green-700); }
  .thumbs img { width: 100%; height: 100%; object-fit: cover; }
  .no-photo { display: grid; place-items: center; gap: var(--space-2); min-height: 260px; color: var(--color-muted); background: var(--color-green-50); border-radius: var(--radius-sm); }

  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .price { font-size: 1.75rem; font-weight: 600; color: var(--color-green-700); }
  .price span { font-size: var(--text-sm); font-weight: 400; color: var(--color-muted); }

  .facts { display: grid; gap: var(--space-2); margin: var(--space-4) 0 0; padding: 0; list-style: none; font-size: var(--text-sm); }
  .facts li { display: flex; align-items: center; gap: var(--space-2); }
  .desc { margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-line); white-space: pre-wrap; }

  .seller { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
  .avatar { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 50%; background: var(--color-green-900); color: #fff; font-weight: 600; font-size: var(--text-sm); }
  .rate { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .note { margin-top: var(--space-3); font-size: var(--text-sm); }
  .sk-big { height: 320px; border-radius: var(--radius-md); }
</style>
