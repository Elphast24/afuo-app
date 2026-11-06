<script>
  import { Link } from 'svelte-navigator';
  import { UserRound } from 'lucide-svelte';
  import Brand from './Brand.svelte';
  import { session } from '../lib/auth.js';
  import { unreadTotal } from '../lib/socket.js';

  /** id of the active page: 'home' | 'dashboard' | 'marketplace' | 'listings' | 'search' | 'market' | 'messages' | 'profile' | 'admin' */
  export let current = 'home';

  $: role = $session?.role;
  $: items = !$session
    ? []
    : role === 'ADMIN'
      ? [
          { id: 'admin', label: 'Admin', to: '/admin' },
          { id: 'marketplace', label: 'Marketplace', to: '/marketplace' },
          { id: 'market', label: 'Prices', to: '/market' }
        ]
      : [
          { id: 'dashboard', label: 'Dashboard', to: '/dashboard' },
          { id: 'marketplace', label: 'Marketplace', to: '/marketplace' },
          role === 'BUYER'
            ? { id: 'search', label: 'Smart match', to: '/search' }
            : { id: 'listings', label: 'My listings', to: '/listings' },
          { id: 'market', label: 'Prices', to: '/market' },
          { id: 'messages', label: 'Messages', to: '/messages' }
        ];
  $: firstName = ($session?.name || '').split(' ')[0];
</script>

<!-- Sits on top of a dark photo/colour banner, so it is always light-on-dark -->
<header class="site-header">
  <div class="bar">
    <Link to="/" class="brand" aria-label="AgriMatch home">
      <Brand />
    </Link>

    {#if items.length}
      <nav class="nav" aria-label="Main">
        {#each items as item (item.id)}
          <Link to={item.to} class={item.id === current ? 'nav-link is-active' : 'nav-link'}>
            {item.label}
            {#if item.id === 'messages' && $unreadTotal > 0}
              <span class="badge-count" aria-label="{$unreadTotal} unread">{$unreadTotal > 9 ? '9+' : $unreadTotal}</span>
            {/if}
          </Link>
        {/each}
      </nav>
    {/if}

    {#if $session}
      <Link to="/profile" class="header-cta">
        <UserRound size={16} strokeWidth={2} aria-hidden="true" />
        <span>{firstName || 'Profile'}</span>
      </Link>
    {:else}
      <Link to="/login" class="header-cta">
        <UserRound size={16} strokeWidth={2} aria-hidden="true" />
        <span>Create Account</span>
      </Link>
    {/if}
  </div>
</header>

<style>
  .site-header {
    position: absolute;
    inset: 0 0 auto 0;
    z-index: 10;
    color: #fff;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-4) var(--gutter);
  }

  .site-header :global(a:focus-visible) {
    outline-color: #fff;
  }

  .site-header :global(.brand) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
  }

  /* Nav drops to its own scrollable row on phones */
  .nav {
    order: 3;
    display: flex;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
    border-radius: var(--radius-pill);
    background: rgba(15, 32, 24, 0.55);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
  }
  .nav::-webkit-scrollbar {
    display: none;
  }

  .site-header :global(.nav-link) {
    flex: 1 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    font-size: 0.875rem;
    font-weight: 500;
    color: #fff;
    transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
  }

  .site-header :global(.nav-link:hover) {
    background: rgba(255, 255, 255, 0.16);
  }

  .badge-count {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    margin-left: var(--space-2);
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--color-orange-600);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 700;
  }

  .site-header :global(.nav-link.is-active) {
    background: #fff;
    color: var(--color-green-900);
  }

  .site-header :global(.header-cta) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    background: #fff;
    color: var(--color-green-900);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    border: 0;
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  }

  .site-header :global(.header-cta:hover) {
    background: var(--color-green-100);
  }

  .site-header :global(.header-cta:active) {
    transform: scale(0.97);
  }

  @media (min-width: 760px) {
    .bar {
      flex-wrap: nowrap;
      padding-block: var(--space-6);
    }

    .nav {
      order: 0;
      width: auto;
      overflow: visible;
    }

    .site-header :global(.nav-link) {
      flex: none;
      padding: 0 var(--space-6);
    }
  }
</style>
