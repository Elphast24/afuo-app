<script>
  import { Link } from 'svelte-navigator';
  import { Package, MapPin, Calendar, Eye, Sprout } from 'lucide-svelte';
  import { assetUrl } from '../../lib/api.js';
  import { formatDate, money, perUnit, unitLabel } from '../../lib/format.js';

  /** a listing DTO from the API; `images` (my listings) or `imageUrl` (browse) supply the cover */
  export let listing;

  $: cover = assetUrl(listing.imageUrl ?? listing.images?.find((i) => i.isPrimary)?.url ?? listing.images?.[0]?.url);
  $: inactive = listing.status !== 'ACTIVE';
</script>

<article class="card-listing" class:inactive>
  <Link to="/listings/{listing.id}" class="media" aria-label="View {listing.produceType} listing">
    {#if cover}
      <img src={cover} alt="" loading="lazy" />
    {:else}
      <span class="placeholder"><Package size={28} aria-hidden="true" /></span>
    {/if}
  </Link>

  <div class="body">
    <div class="top">
      <h3><Link to="/listings/{listing.id}">{listing.produceType}</Link></h3>
      <span class="badge" class:badge-warm={inactive}>{listing.status.toLowerCase()}</span>
    </div>

    <p class="price">{money(listing.pricePerUnit, listing.currency)} <span>/ {perUnit(listing.unit)}</span></p>

    <ul class="meta">
      <li><Package size={14} aria-hidden="true" /> {listing.quantity.toLocaleString()} {unitLabel(listing.unit)}</li>
      <li><MapPin size={14} aria-hidden="true" /> {listing.location}</li>
      <li><Calendar size={14} aria-hidden="true" /> {formatDate(listing.availableFrom)} to {formatDate(listing.availableTo)}</li>
      {#if listing.isOrganic}<li><Sprout size={14} aria-hidden="true" /> Organic</li>{/if}
      {#if listing.viewCount !== undefined}<li><Eye size={14} aria-hidden="true" /> {listing.viewCount} {listing.viewCount === 1 ? 'view' : 'views'}</li>{/if}
    </ul>

    {#if $$slots.actions}<div class="actions"><slot name="actions" /></div>{/if}
  </div>
</article>

<style>
  .card-listing {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  @media (min-width: 560px) {
    .card-listing { grid-template-columns: 180px 1fr; }
  }

  .card-listing :global(.media) {
    display: block;
    min-height: 140px;
    background: var(--color-green-50);
  }
  img { width: 100%; height: 100%; min-height: 140px; max-height: 220px; object-fit: cover; }
  @media (min-width: 560px) { img { max-height: none; } }
  .placeholder { display: grid; place-items: center; height: 100%; min-height: 140px; color: var(--color-green-700); }

  .body { display: grid; gap: var(--space-2); align-content: start; padding: var(--space-4) var(--space-6); }
  .top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  h3 { font-size: var(--text-lg); }
  h3 :global(a:hover) { text-decoration: underline; }

  .price { font-size: var(--text-xl); font-weight: 600; color: var(--color-green-700); }
  .price span { font-size: var(--text-sm); font-weight: 400; color: var(--color-muted); }

  .meta { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); color: var(--color-muted); }
  .meta li { display: inline-flex; align-items: center; gap: var(--space-1); }

  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }

  .inactive .price { color: var(--color-muted); }
</style>
