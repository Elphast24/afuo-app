<script>
  import { createEventDispatcher } from 'svelte';
  import { Heart, MapPin, MessageSquare } from 'lucide-svelte';
  import { saved, toggleSaved } from '../../lib/saved.js';
  import { viewed } from '../../lib/viewed.js';
  import { session } from '../../lib/auth.js';
  import { categoryMeta, isRecent, listingImage } from '../../lib/marketplace.js';
  import { money, perUnit, unitLabel } from '../../lib/format.js';

  /** a listing DTO (browse item, or a saved snapshot) */
  export let listing;
  /** the listing currently open in the side panel */
  export let active = false;

  const dispatch = createEventDispatcher();

  $: meta = categoryMeta(listing.category);
  $: isSaved = $saved.some((s) => s.id === listing.id);
  $: seen = $viewed.includes(listing.id);
  $: farmer = listing.farmer?.name ?? listing.farmerName;
  $: mine = listing.farmerId ? listing.farmerId === $session?.id : false;
  $: canContact = !mine && $session?.role !== 'ADMIN';
  $: stats = [`${listing.quantity.toLocaleString()} ${unitLabel(listing.unit)}`, meta.label, listing.isOrganic ? 'Organic' : null].filter(Boolean);

  // Plain clicks open the panel; ctrl/cmd/middle-click keep the normal link behaviour
  function open(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    dispatch('open', { listing, trigger: e.currentTarget });
  }
</script>

<article class="product" class:active>
  {#if farmer}<p class="by">Listed by {farmer}</p>{/if}

  <div class="photo">
    <img src={listingImage(listing)} alt="" loading="lazy" />
    <div class="badges">
      {#if isRecent(listing.createdAt)}<span class="pill new">New</span>{/if}
      {#if seen}<span class="pill">Viewed</span>{/if}
    </div>
    <button type="button" class="heart" class:on={isSaved} aria-pressed={isSaved} aria-label="{isSaved ? 'Remove' : 'Save'} {listing.produceType} {isSaved ? 'from' : 'to'} saved" on:click={() => toggleSaved(listing)}>
      <Heart size={20} aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
    </button>
  </div>

  <div class="info">
    <p class="status"><span class="dot" aria-hidden="true"></span> Available{listing.isOrganic ? ' · Organic' : ''}</p>
    <p class="price">{money(listing.pricePerUnit, listing.currency)} <span>/ {perUnit(listing.unit)}</span></p>
    <h3><a class="stretch" href="/marketplace?listing={listing.id}" aria-label="{listing.produceType}, view details" on:click={open}>{listing.produceType}</a></h3>
    <p class="stats">{stats.join(' · ')}</p>
    <p class="where"><MapPin size={14} aria-hidden="true" /> {listing.location}</p>
  </div>

  {#if canContact}
    <button type="button" class="contact" aria-label="Contact {farmer || 'the farmer'} about {listing.produceType}" on:click={() => dispatch('contact', listing)}>
      <MessageSquare size={16} aria-hidden="true" /> Contact farmer
    </button>
  {/if}
</article>

<style>
  .product {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: var(--space-3);
    row-gap: var(--space-2);
    align-content: start;
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background: #fff;
    transition: box-shadow var(--dur-base) var(--ease-out), background-color var(--dur-base) var(--ease-out);
  }
  .product:hover { box-shadow: var(--shadow-md); }
  .product.active { background: var(--tint-peach); }
  .product:focus-within { outline: 3px solid var(--color-orange-600); outline-offset: 2px; }

  .by { grid-column: 1 / -1; padding: 0 var(--space-1); font-size: var(--text-xs); color: var(--color-muted); }

  .photo { grid-column: 1 / -1; position: relative; aspect-ratio: 4 / 3; overflow: hidden; border-radius: var(--radius-md); background: var(--tint-gray); }
  .photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 400ms var(--ease-out); }
  .product:hover .photo img { transform: scale(1.04); }

  .badges { position: absolute; top: var(--space-3); left: var(--space-3); display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .pill { padding: 4px 12px; border-radius: var(--radius-pill); background: #fff; color: var(--color-ink); font-size: var(--text-xs); font-weight: 600; box-shadow: var(--shadow-sm); }
  .pill.new { background: #1d4ed8; color: #fff; }

  .heart {
    position: absolute;
    right: var(--space-3);
    bottom: var(--space-3);
    z-index: 2;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: var(--color-ink);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: transform var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
  }
  .heart:hover { transform: scale(1.08); }
  .heart:active { transform: scale(0.94); }
  .heart.on { color: var(--color-orange-600); }

  .info { display: grid; gap: 2px; padding: var(--space-1); min-width: 0; }
  .status { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-muted); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #16a34a; }
  .price { font-size: 1.625rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: var(--color-ink); }
  .price span { font-size: var(--text-xs); font-weight: 500; letter-spacing: 0; color: var(--color-muted); }
  h3 { font-size: var(--text-base); font-weight: 600; }
  /* The whole card is the link target; heart and contact sit above it */
  .stretch::after { content: ''; position: absolute; inset: 0; z-index: 1; border-radius: var(--radius-lg); }
  .stats { font-size: var(--text-sm); color: var(--color-ink); }
  .where { display: flex; align-items: center; gap: 4px; font-size: var(--text-sm); color: var(--color-muted); }

  .contact {
    position: relative;
    z-index: 2;
    align-self: end;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 48px;
    margin-bottom: var(--space-1);
    padding: 0 var(--space-4);
    border: 2px solid var(--color-ink);
    border-radius: var(--radius-pill);
    background: #fff;
    color: var(--color-ink);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
  }
  .contact:hover { background: var(--color-ink); color: #fff; }

  /* Narrow cards: the contact button drops under the details at full width */
  @media (max-width: 420px) {
    .contact { grid-column: 1 / -1; justify-content: center; margin-top: var(--space-2); }
  }

  @media (prefers-reduced-motion: reduce) {
    .product:hover .photo img { transform: none; }
    .heart:hover { transform: none; }
  }
</style>
