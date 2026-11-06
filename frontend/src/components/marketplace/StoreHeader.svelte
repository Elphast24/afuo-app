<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { Link, useNavigate } from 'svelte-navigator';
  import { Search, SlidersHorizontal, MessageSquare, Heart, LayoutDashboard, ClipboardList, Sparkles, TrendingUp, UserRound, LogOut, ShieldCheck, X } from 'lucide-svelte';
  import { session, signOut } from '../../lib/auth.js';
  import { unreadTotal } from '../../lib/socket.js';
  import { saved } from '../../lib/saved.js';
  import { initials } from '../../lib/format.js';
  import { showToast } from '../../lib/toast.js';

  /** current search text (bindable) */
  export let query = '';
  export let activeFilters = 0;
  export let showingSaved = false;

  const dispatch = createEventDispatcher();
  const navigate = useNavigate();

  let menuOpen = false;
  let menuEl;
  let buttonEl;

  $: role = $session?.role;
  $: links = [
    role === 'ADMIN'
      ? { to: '/admin', label: 'Admin dashboard', icon: ShieldCheck }
      : { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    role === 'BUYER'
      ? { to: '/search', label: 'Smart match', icon: Sparkles }
      : role === 'FARMER'
        ? { to: '/listings', label: 'My listings', icon: ClipboardList }
        : null,
    { to: '/market', label: 'Price trends', icon: TrendingUp },
    { to: '/profile', label: 'Profile', icon: UserRound }
  ].filter(Boolean);

  function onWindowClick(e) {
    if (menuOpen && !menuEl?.contains(e.target) && !buttonEl?.contains(e.target)) menuOpen = false;
  }
  function onKeydown(e) {
    if (e.key === 'Escape' && menuOpen) {
      menuOpen = false;
      buttonEl?.focus();
    }
  }

  async function logout() {
    menuOpen = false;
    await signOut();
    showToast('You are signed out.', 'info');
    navigate('/', { replace: true });
  }

  onMount(() => () => {});
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKeydown} />

<header class="store-header">
  <Link to="/" class="logo" aria-label="AgriMatch home">
    <svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
      <rect x="0" y="0" width="16" height="16" rx="8" fill="#16201b" />
      <rect x="20" y="3" width="18" height="18" rx="6" fill="#16201b" />
      <circle cx="9" cy="28" r="7" fill="#16201b" />
      <path d="M20 36V24a12 12 0 0 1 12 12z" fill="#c9502c" />
    </svg>
  </Link>

  <form class="search" role="search" on:submit|preventDefault={() => dispatch('search', query.trim())}>
    <Search size={18} aria-hidden="true" />
    <label for="store-search" class="sr-only">Search produce</label>
    <input id="store-search" type="search" bind:value={query} placeholder="Search tomatoes, maize, plantain..." autocomplete="off" />
    {#if query}
      <button type="button" class="clear" aria-label="Clear search" on:click={() => { query = ''; dispatch('search', ''); }}><X size={16} aria-hidden="true" /></button>
    {/if}
  </form>

  <button type="button" class="round" aria-label="Filters{activeFilters ? `, ${activeFilters} active` : ''}" on:click={() => dispatch('filters')}>
    <SlidersHorizontal size={18} aria-hidden="true" />
    {#if activeFilters}<span class="dot">{activeFilters}</span>{/if}
  </button>

  <div class="icons">
    {#if role !== 'ADMIN'}
      <Link to="/messages" class="round" aria-label="Messages{$unreadTotal ? `, ${$unreadTotal} unread` : ''}">
        <MessageSquare size={18} aria-hidden="true" />
        {#if $unreadTotal}<span class="dot">{$unreadTotal > 9 ? '9+' : $unreadTotal}</span>{/if}
      </Link>
    {/if}

    <button type="button" class="round" class:on={showingSaved} aria-pressed={showingSaved} aria-label="Saved listings, {$saved.length}" on:click={() => dispatch('saved')}>
      <Heart size={18} aria-hidden="true" fill={showingSaved ? 'currentColor' : 'none'} />
      {#if $saved.length}<span class="dot soft">{$saved.length}</span>{/if}
    </button>

    <div class="menu-wrap">
      <button bind:this={buttonEl} type="button" class="avatar" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu" on:click={() => (menuOpen = !menuOpen)}>
        {initials($session?.name)}
      </button>
      {#if menuOpen}
        <div class="menu" role="menu" bind:this={menuEl}>
          <p class="who"><strong>{$session?.name || 'Account'}</strong><span>{role?.toLowerCase()}</span></p>
          {#each links as l}
            <Link to={l.to} class="item" role="menuitem"><svelte:component this={l.icon} size={16} aria-hidden="true" /> {l.label}</Link>
          {/each}
          <button type="button" class="item" role="menuitem" on:click={logout}><LogOut size={16} aria-hidden="true" /> Sign out</button>
        </div>
      {/if}
    </div>
  </div>
</header>

<style>
  .store-header {
    position: sticky;
    top: 0;
    z-index: 50;
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    grid-template-areas: 'logo icons icons icons' 'search search filter filter';
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--gutter);
    background: rgba(255, 255, 255, 0.92);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }
  @media (min-width: 760px) {
    .store-header {
      grid-template-columns: auto minmax(0, 560px) auto 1fr;
      grid-template-areas: 'logo search filter icons';
      gap: var(--space-4);
      padding-block: var(--space-4);
    }
  }

  .store-header :global(.logo) { grid-area: logo; display: inline-flex; align-items: center; min-height: 44px; }
  .store-header :global(a:focus-visible), .store-header button:focus-visible { outline: 3px solid var(--color-orange-600); outline-offset: 2px; }

  .search {
    grid-area: search;
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 48px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--tint-gray);
    color: var(--color-muted);
    transition: box-shadow var(--dur-fast) var(--ease-out);
  }
  .search:focus-within { box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.3); background: #fff; }
  .search input { flex: 1; min-width: 0; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--color-ink); font-size: var(--text-sm); }
  .search input:focus-visible { outline: none; box-shadow: none; border: 0; }
  .search input::-webkit-search-cancel-button { display: none; }
  .clear { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: var(--color-muted); cursor: pointer; }
  .clear:hover { background: rgba(0, 0, 0, 0.06); }

  .round {
    position: relative;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 50%;
    background: var(--tint-gray);
    color: var(--color-ink);
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  }
  .round:hover { background: #e8e6e1; }
  .round:active { transform: scale(0.95); }
  .round.on { background: var(--tint-peach); color: var(--color-orange-700); }
  .store-header > .round { grid-area: filter; }

  .dot {
    position: absolute;
    top: -2px;
    right: -2px;
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: var(--radius-pill);
    background: var(--color-orange-600);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 700;
  }
  .dot.soft { background: var(--color-ink); }

  .icons { grid-area: icons; display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); }

  .menu-wrap { position: relative; }
  .avatar {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--color-green-900);
    color: #fff;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    box-shadow: 0 0 0 2px var(--tint-peach);
    cursor: pointer;
  }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + var(--space-2));
    z-index: 60;
    display: grid;
    min-width: 220px;
    padding: var(--space-2);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: #fff;
    box-shadow: var(--shadow-md);
    animation: pop var(--dur-fast) var(--ease-out);
  }
  .who { display: grid; padding: var(--space-2) var(--space-3) var(--space-3); border-bottom: 1px solid var(--color-line); margin-bottom: var(--space-1); }
  .who span { font-size: var(--text-xs); color: var(--color-muted); text-transform: capitalize; }
  .menu :global(.item), .menu button.item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-ink);
    font: inherit;
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
  }
  .menu :global(.item:hover), .menu button.item:hover { background: var(--color-green-50); }

  @keyframes pop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
</style>
