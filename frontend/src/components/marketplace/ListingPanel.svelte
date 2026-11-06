<script>
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import { Link } from 'svelte-navigator';
  import { Heart, Share2, X, Package, Sprout, Calendar, Clock, Eye, Layers, Phone, MessageSquare, Pencil, Star } from 'lucide-svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import { api, assetUrl } from '../../lib/api.js';
  import { session } from '../../lib/auth.js';
  import { saved, toggleSaved } from '../../lib/saved.js';
  import { markViewed } from '../../lib/viewed.js';
  import { showToast } from '../../lib/toast.js';
  import { categoryMeta, isRecent, listingImage } from '../../lib/marketplace.js';
  import { formatDate, initials, money, perUnit, timeAgo, unitLabel } from '../../lib/format.js';

  /** id of the listing to show */
  export let id;
  /** what the catalog card already knows, shown instantly while the full listing loads */
  export let seed = null;

  const dispatch = createEventDispatcher();

  let status = 'loading';
  let error = '';
  let detail = null;
  let rating = null;
  let selected = 0;
  let showPhone = false;
  let panelEl;
  let seq = 0;

  $: view = detail ?? seed;
  $: meta = categoryMeta(view?.category);
  $: farmer = detail?.farmer ?? (seed ? { id: seed.farmer?.id, name: seed.farmer?.name ?? seed.farmerName } : null);
  $: photos = detail?.images?.length ? detail.images.map((i) => assetUrl(i.url)) : view ? [listingImage(view)] : [];
  $: isSaved = $saved.some((s) => s.id === id);
  $: isOwner = !!detail && detail.farmerId === $session?.id;
  $: isAdmin = $session?.role === 'ADMIN';
  $: active = (view?.status ?? 'ACTIVE') === 'ACTIVE'; // saved snapshots carry no status until the listing loads
  $: lotValue = view ? view.pricePerUnit * view.quantity : 0;
  $: onMarket = view ? daysOnMarket(view.createdAt) : '';

  function daysOnMarket(createdAt) {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
    return days < 1 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`;
  }

  async function load(listingId) {
    const mine = ++seq;
    status = 'loading';
    detail = null;
    rating = null;
    selected = 0;
    showPhone = false;
    try {
      const data = await api.listings.get(listingId);
      if (mine !== seq) return;
      detail = data.listing;
      const primary = detail.images.findIndex((i) => i.isPrimary);
      selected = Math.max(0, primary);
      status = 'ready';
      markViewed(listingId);
      api.reviews.forUser(detail.farmer.id).then((r) => mine === seq && (rating = r)).catch(() => {});
    } catch (e) {
      if (mine !== seq) return;
      error = e.code === 'NOT_FOUND' ? 'This listing is no longer available.' : e.message;
      status = 'error';
    }
  }

  $: if (id) load(id);

  async function share() {
    const url = `${location.origin}/marketplace?listing=${id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${view?.produceType ?? 'Produce'} on AgriMatch`, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast('Link copied.', 'success');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') showToast('Could not copy the link.', 'error');
    }
  }

  const close = () => dispatch('close');

  // Keep Tab inside the panel while it is open, close on Escape
  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !panelEl) return;
    const items = [...panelEl.querySelectorAll('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  let prevOverflow = '';
  onMount(async () => {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    await tick();
    panelEl?.focus();
    // svelte-navigator moves focus to the page's first heading after every navigation; take it back once that has run
    focusTimer = setTimeout(() => panelEl && !panelEl.contains(document.activeElement) && panelEl.focus(), 80);
  });
  let focusTimer;
  onDestroy(() => {
    clearTimeout(focusTimer);
    if (typeof document !== 'undefined') document.body.style.overflow = prevOverflow;
  });
</script>

<svelte:window on:keydown={onKeydown} />

<div class="scrim" on:click={close} aria-hidden="true"></div>

<aside class="panel" bind:this={panelEl} role="dialog" aria-modal="true" aria-label="{view?.produceType ?? 'Listing'} details" tabindex="-1">
  {#if status === 'error'}
    <div class="top-actions static">
      <button type="button" class="round" aria-label="Close details" on:click={close}><X size={20} aria-hidden="true" /></button>
    </div>
    <div class="state"><ErrorState message={error} retry={error !== 'This listing is no longer available.'} on:retry={() => load(id)} /></div>
  {:else if !view}
    <div class="top-actions static">
      <button type="button" class="round" aria-label="Close details" on:click={close}><X size={20} aria-hidden="true" /></button>
    </div>
    <div class="state" role="status" aria-label="Loading listing"><span class="skeleton sk-hero"></span><span class="skeleton sk"></span></div>
  {:else}
    <div class="scroll">
      <!-- Photo -->
      <div class="hero">
        <img src={photos[selected] ?? photos[0]} alt="{view.produceType} from {view.location}{photos.length > 1 ? `, photo ${selected + 1} of ${photos.length}` : ''}" />
        <div class="top-actions">
          <button type="button" class="round" class:on={isSaved} aria-pressed={isSaved} aria-label="{isSaved ? 'Remove from' : 'Save to'} saved listings" on:click={() => toggleSaved(view)}>
            <Heart size={20} aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
          </button>
          <button type="button" class="round" aria-label="Share this listing" on:click={share}><Share2 size={20} aria-hidden="true" /></button>
          <button type="button" class="round" aria-label="Close details" on:click={close}><X size={20} aria-hidden="true" /></button>
        </div>
        <div class="hero-foot">
          {#if isRecent(view.createdAt, 7)}<span class="pill new">New · {timeAgo(view.createdAt)}</span>{:else}<span></span>{/if}
          {#if photos.length > 1}<span class="pill count" aria-hidden="true">{selected + 1}/{photos.length}</span>{/if}
        </div>
      </div>
      {#if farmer?.name}<p class="by">By {farmer.name}{#if rating?.count} · <Star size={13} aria-hidden="true" /> {rating.averageRating.toFixed(1)} ({rating.count}){/if}</p>{/if}

      {#if photos.length > 1}
        <ul class="thumbs" aria-label="Photos">
          {#each photos as src, i}
            <li><button type="button" class:on={i === selected} aria-pressed={i === selected} aria-label="Show photo {i + 1}" on:click={() => (selected = i)}><img {src} alt="" loading="lazy" /></button></li>
          {/each}
        </ul>
      {/if}

      <!-- Facts -->
      <div class="body">
        <p class="status"><span class="dot" class:off={!active} aria-hidden="true"></span> {active ? 'Available' : view.status === 'SOLD' ? 'Sold' : 'Not available'}</p>
        <h2 class="price">{money(view.pricePerUnit, view.currency)} <span>/ {perUnit(view.unit)}</span></h2>
        <p class="lot">Whole lot about <u>{money(lotValue, view.currency)}</u></p>
        <p class="stats"><strong>{view.produceType}</strong> · <strong>{view.quantity.toLocaleString()}</strong> {unitLabel(view.unit)}{view.isOrganic ? ' · Organic' : ''}</p>
        <p class="addr">{view.location}, Ghana</p>

        <div class="callouts">
          {#if $session?.role === 'BUYER'}
            <p><Link to="/search">Smart match: see which listings fit what you need.</Link></p>
          {:else}
            <p><Link to="/marketplace">Browse more {meta.label.toLowerCase()} on the marketplace.</Link></p>
          {/if}
          <p><Link to="/market">What is a fair price? See the {view.produceType.toLowerCase()} price trend.</Link></p>
        </div>

        <ul class="grid">
          <li><Layers size={22} aria-hidden="true" /><div><strong>{meta.label}</strong><span>Category</span></div></li>
          <li><Package size={22} aria-hidden="true" /><div><strong>{view.quantity.toLocaleString()} {unitLabel(view.unit)}</strong><span>In stock</span></div></li>
          <li><Sprout size={22} aria-hidden="true" /><div><strong>{view.isOrganic ? 'Organic' : 'Conventional'}</strong><span>Farming method</span></div></li>
          <li><Clock size={22} aria-hidden="true" /><div><strong>{onMarket}</strong><span>Time on market</span></div></li>
          {#if detail}
            <li><Calendar size={22} aria-hidden="true" /><div><strong>{formatDate(detail.availableFrom)}</strong><span>Available from</span></div></li>
            <li><Calendar size={22} aria-hidden="true" /><div><strong>{formatDate(detail.availableTo)}</strong><span>Available until</span></div></li>
            <li><Eye size={22} aria-hidden="true" /><div><strong>{detail.viewCount.toLocaleString()}</strong><span>{detail.viewCount === 1 ? 'View' : 'Views'}</span></div></li>
          {/if}
        </ul>

        {#if status === 'loading'}
          <span class="skeleton sk" aria-hidden="true"></span>
          <span class="sr-only" role="status">Loading details</span>
        {:else if detail?.description}
          <section aria-labelledby="about-title">
            <h3 id="about-title">About this produce</h3>
            <p class="desc">{detail.description}</p>
          </section>
        {/if}

        {#if farmer?.name}
          <section class="seller" aria-labelledby="seller-title">
            <h3 id="seller-title" class="sr-only">Seller</h3>
            <span class="avatar" aria-hidden="true">{initials(farmer.name)}</span>
            <div>
              <strong>{farmer.name}</strong>
              <p class="muted rate"><Star size={14} aria-hidden="true" /> {#if rating?.count}{rating.averageRating.toFixed(1)} ({rating.count} {rating.count === 1 ? 'review' : 'reviews'}){:else}No reviews yet{/if}</p>
            </div>
          </section>
        {/if}
        {#if !active && !isOwner}<p class="muted note">This listing is {view.status.toLowerCase()}, so messaging is turned off.</p>{/if}
      </div>
    </div>

    <!-- Actions stay in view while the details scroll -->
    <div class="bar">
      {#if isOwner}
        <Link to="/listings/{id}/edit" class="btn-solid"><Pencil size={16} aria-hidden="true" /> Edit listing</Link>
      {:else if isAdmin}
        <p class="muted admin-note">Signed in as admin: messaging is for farmers and buyers.</p>
      {:else}
        {#if showPhone && detail}
          <a class="btn-line" href="tel:{detail.farmer.phone}"><Phone size={16} aria-hidden="true" /> {detail.farmer.phone}</a>
        {:else}
          <button type="button" class="btn-line" disabled={!detail} on:click={() => (showPhone = true)}><Phone size={16} aria-hidden="true" /> Show phone</button>
        {/if}
        <button type="button" class="btn-solid" disabled={!active || !detail} on:click={() => dispatch('contact', { id, produceType: view.produceType, farmerName: farmer?.name })}>
          <MessageSquare size={16} aria-hidden="true" /> Message seller
        </button>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .scrim { position: fixed; inset: 0; z-index: 900; background: rgba(15, 32, 24, 0.5); animation: fade var(--dur-base) var(--ease-out); }

  .panel {
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 901;
    display: flex;
    flex-direction: column;
    width: min(560px, 100%);
    background: #fff;
    box-shadow: -12px 0 40px rgba(15, 32, 24, 0.25);
    animation: slide 260ms var(--ease-out);
    outline: none;
  }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }

  .hero { position: relative; aspect-ratio: 4 / 3; background: var(--tint-gray); }
  .hero img { width: 100%; height: 100%; object-fit: cover; }
  .top-actions { position: absolute; top: var(--space-3); right: var(--space-3); display: flex; gap: var(--space-2); }
  .top-actions.static { position: static; justify-content: flex-end; padding: var(--space-3); }
  .round { display: grid; place-items: center; width: 48px; height: 48px; border: 0; border-radius: 50%; background: #fff; color: var(--color-ink); box-shadow: var(--shadow-sm); cursor: pointer; transition: transform var(--dur-fast) var(--ease-out); }
  .round:hover { transform: scale(1.06); }
  .round:active { transform: scale(0.94); }
  .round.on { color: var(--color-orange-600); }
  .panel :global(button:focus-visible), .panel :global(a:focus-visible) { outline: 3px solid var(--color-orange-600); outline-offset: 2px; }

  .hero-foot { position: absolute; inset: auto var(--space-3) var(--space-3); display: flex; align-items: center; justify-content: space-between; }
  .pill { padding: 5px 12px; border-radius: var(--radius-pill); background: rgba(22, 32, 27, 0.78); color: #fff; font-size: var(--text-xs); font-weight: 600; }
  .pill.new { background: #1d4ed8; }

  .by { display: flex; align-items: center; gap: 4px; padding: var(--space-3) var(--space-4); background: #2b2b2b; color: #fff; font-size: var(--text-xs); }

  .thumbs { display: flex; gap: var(--space-2); margin: 0; padding: var(--space-3) var(--space-4) 0; list-style: none; overflow-x: auto; }
  .thumbs button { width: 72px; height: 56px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: var(--radius-sm); background: none; cursor: pointer; opacity: 0.8; }
  .thumbs button.on { border-color: var(--color-ink); opacity: 1; }
  .thumbs img { width: 100%; height: 100%; object-fit: cover; }

  .body { display: grid; gap: var(--space-2); padding: var(--space-4) var(--space-4) var(--space-8); }
  .status { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-muted); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #16a34a; }
  .dot.off { background: var(--color-line-strong); }
  .price { font-family: var(--font-display); font-weight: 400; font-size: clamp(2.5rem, 9vw, 3.25rem); line-height: 1.05; letter-spacing: 0.01em; }
  .price span { font-family: inherit; font-size: 0.45em; color: var(--color-muted); }
  .lot { font-size: var(--text-sm); }
  .stats { margin-top: var(--space-2); font-size: var(--text-lg); }
  .addr { font-size: var(--text-sm); color: var(--color-muted); }

  .callouts { display: grid; gap: var(--space-3); margin-top: var(--space-4); padding: var(--space-4) 0; border-block: 1px solid var(--color-line); font-size: var(--text-sm); }
  @media (min-width: 520px) { .callouts { grid-template-columns: 1fr 1fr; gap: var(--space-4); } .callouts p + p { padding-left: var(--space-4); border-left: 1px solid var(--color-line); } }
  .callouts :global(a) { color: var(--color-green-700); font-weight: 500; text-decoration: none; }
  .callouts :global(a:hover) { text-decoration: underline; }

  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4) var(--space-3); margin: var(--space-4) 0; padding: 0; list-style: none; }
  .grid li { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
  .grid li > :global(svg) { flex: none; color: var(--color-ink); }
  .grid strong { display: block; font-size: var(--text-sm); font-weight: 700; overflow-wrap: anywhere; }
  .grid span { font-size: var(--text-xs); color: var(--color-muted); }

  h3 { font-size: var(--text-lg); font-weight: 700; }
  .desc { margin-top: var(--space-2); white-space: pre-wrap; font-size: var(--text-sm); }
  .sk { height: 72px; border-radius: var(--radius-md); }

  .seller { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); padding: var(--space-4); border-radius: var(--radius-md); background: var(--tint-gray); }
  .avatar { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 50%; background: var(--color-green-900); color: #fff; font-weight: 600; font-size: var(--text-sm); }
  .rate { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); }
  .note { font-size: var(--text-sm); }

  .bar { display: flex; gap: var(--space-3); padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom)); border-top: 1px solid var(--color-line); background: #fff; }
  .bar > :global(*) { flex: 1; }
  .admin-note { align-self: center; text-align: center; font-size: var(--text-sm); }
  .bar :global(.btn-solid), .bar :global(.btn-line), .btn-solid, .btn-line {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 52px; padding: 0 var(--space-4);
    border: 2px solid var(--color-ink); border-radius: var(--radius-pill); font: inherit; font-size: var(--text-sm); font-weight: 700; text-decoration: none; cursor: pointer;
    transition: opacity var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
  }
  .bar :global(.btn-solid) { background: var(--color-ink); color: #fff; }
  .bar :global(.btn-line) { background: #fff; color: var(--color-ink); }
  .bar :global(.btn-line:hover:not(:disabled)) { background: var(--tint-gray); }
  .bar :global(.btn-solid:hover:not(:disabled)) { background: #000; }
  .bar :global(button:disabled) { opacity: 0.45; cursor: not-allowed; }

  .state { display: grid; gap: var(--space-4); padding: var(--space-4); }
  .sk-hero { aspect-ratio: 4 / 3; border-radius: var(--radius-md); }

  @keyframes slide { from { transform: translateX(32px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .panel { animation: fade var(--dur-base) linear; }
    .round:hover { transform: none; }
  }
</style>
