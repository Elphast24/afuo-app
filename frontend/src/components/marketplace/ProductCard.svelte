<script>
  import { Link } from 'svelte-navigator';
  import { Heart, MapPin, Sprout } from 'lucide-svelte';
  import { saved, toggleSaved } from '../../lib/saved.js';
  import { categoryMeta, isRecent, listingImage } from '../../lib/marketplace.js';
  import { money, perUnit, unitLabel } from '../../lib/format.js';

  /** a listing DTO (browse item, or a saved snapshot) */
  export let listing;

  $: meta = categoryMeta(listing.category);
  $: isSaved = $saved.some((s) => s.id === listing.id);
  $: farmer = listing.farmer?.name ?? listing.farmerName;
</script>

<article class="product" style="--tint: {meta.tint}">
  <div class="photo">
    <img src={listingImage(listing)} alt="" loading="lazy" />
    <div class="badges">
      {#if isRecent(listing.createdAt)}<span class="pill">New</span>{/if}
      {#if listing.isOrganic}<span class="pill leaf"><Sprout size={12} aria-hidden="true" /> Organic</span>{/if}
    </div>
  </div>

  <div class="info">
    <h3><Link to="/listings/{listing.id}" class="stretch">{listing.produceType}</Link></h3>
    <p class="price">{money(listing.pricePerUnit, listing.currency)} <span>/ {perUnit(listing.unit)}</span></p>
    <p class="meta"><MapPin size={13} aria-hidden="true" /> {listing.location} · {listing.quantity.toLocaleString()} {unitLabel(listing.unit)}</p>
    {#if farmer}<p class="farmer">by {farmer}</p>{/if}
  </div>

  <button type="button" class="heart" class:on={isSaved} aria-pressed={isSaved} aria-label="{isSaved ? 'Remove' : 'Save'} {listing.produceType} {isSaved ? 'from' : 'to'} saved" on:click={() => toggleSaved(listing)}>
    <Heart size={18} aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
  </button>
</article>

<style>
  .product {
    position: relative;
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: 28px;
    background: var(--tint);
    transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
  }
  .product:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
  .product:focus-within { outline: 3px solid var(--color-orange-600); outline-offset: 3px; }

  .photo { position: relative; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 20px; background: rgba(255, 255, 255, 0.6); }
  .photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 400ms var(--ease-out); }
  .product:hover .photo img { transform: scale(1.05); }

  .badges { position: absolute; top: var(--space-2); left: var(--space-2); display: flex; flex-wrap: wrap; gap: var(--space-1); }
  .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: var(--radius-pill); background: rgba(22, 32, 27, 0.78); color: #fff; font-size: var(--text-xs); font-weight: 600; }
  .pill.leaf { background: rgba(255, 255, 255, 0.92); color: var(--color-green-900); }

  .info { display: grid; gap: 2px; padding: 0 var(--space-3) var(--space-3); }
  h3 { font-size: var(--text-base); font-weight: 600; }
  /* The whole card is the link target; the heart button sits above it */
  .info :global(.stretch)::after { content: ''; position: absolute; inset: 0; border-radius: 28px; }
  .price { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; color: var(--color-ink); }
  .price span { font-size: var(--text-xs); font-weight: 500; color: var(--color-muted); }
  .meta { display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); color: var(--color-muted); }
  .farmer { font-size: var(--text-xs); color: var(--color-muted); }

  .heart {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 2;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
    color: var(--color-ink);
    cursor: pointer;
    transition: transform var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
  }
  .heart:hover { transform: scale(1.08); }
  .heart:active { transform: scale(0.94); }
  .heart.on { color: var(--color-orange-600); }

  @media (prefers-reduced-motion: reduce) {
    .product:hover { transform: none; }
    .product:hover .photo img { transform: none; }
  }
</style>
