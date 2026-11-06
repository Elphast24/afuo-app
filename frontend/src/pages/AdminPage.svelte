<script>
  import { LayoutDashboard, Users, Package, KeyRound } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import AdminOverview from '../components/admin/AdminOverview.svelte';
  import AdminUsers from '../components/admin/AdminUsers.svelte';
  import AdminListings from '../components/admin/AdminListings.svelte';
  import AdminAccount from '../components/admin/AdminAccount.svelte';

  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'listings', label: 'Listings', icon: Package },
    { id: 'account', label: 'Account', icon: KeyRound }
  ];

  let tab = 'overview';
  let tabEls = [];

  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  function onKeydown(e, i) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + TABS.length) % TABS.length;
    tab = TABS[next].id;
    tabEls[next].focus();
  }
</script>

<PageLayout current="admin" kicker="Administration" title="Admin dashboard" lead="Keep an eye on the platform, manage accounts and moderate listings.">
  <div class="tabs" role="tablist" aria-label="Admin sections">
    {#each TABS as t, i (t.id)}
      <button
        bind:this={tabEls[i]}
        type="button"
        role="tab"
        id="tab-{t.id}"
        aria-selected={tab === t.id}
        aria-controls="panel-{t.id}"
        tabindex={tab === t.id ? 0 : -1}
        on:click={() => (tab = t.id)}
        on:keydown={(e) => onKeydown(e, i)}
      >
        <svelte:component this={t.icon} size={16} aria-hidden="true" /> {t.label}
      </button>
    {/each}
  </div>

  <div role="tabpanel" id="panel-{tab}" aria-labelledby="tab-{tab}" tabindex="0">
    {#if tab === 'overview'}<AdminOverview />
    {:else if tab === 'users'}<AdminUsers />
    {:else if tab === 'listings'}<AdminListings />
    {:else}<AdminAccount />{/if}
  </div>
</PageLayout>

<style>
  .tabs { display: flex; gap: var(--space-2); padding: var(--space-1); overflow-x: auto; scrollbar-width: none; border-radius: var(--radius-pill); background: var(--color-surface); border: 1px solid var(--color-line); width: fit-content; max-width: 100%; }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs button {
    display: inline-flex; flex: none; align-items: center; gap: var(--space-2); min-height: 44px; padding: 0 var(--space-4);
    border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--color-ink);
    font: inherit; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
  }
  .tabs button:hover { background: var(--color-green-50); }
  .tabs button[aria-selected='true'] { background: var(--color-green-900); color: #fff; }
  [role='tabpanel']:focus { outline: none; }
  [role='tabpanel']:focus-visible { outline: 3px solid var(--color-orange-600); outline-offset: 4px; border-radius: var(--radius-md); }
</style>
