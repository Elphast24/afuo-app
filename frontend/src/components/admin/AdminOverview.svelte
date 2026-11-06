<script>
  import { onMount } from 'svelte';
  import { Users, Sprout, ShoppingBasket, Package, UserPlus, MessageSquare, Eye, Star, TrendingUp } from 'lucide-svelte';
  import StatsCards from '../market/StatsCards.svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import { api } from '../../lib/api.js';

  let status = 'loading';
  let error = '';
  let s = null;

  async function load() {
    status = 'loading';
    try {
      s = await api.admin.stats();
      status = 'ready';
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }
  onMount(load);

  $: peopleCards = s && [
    { icon: Users, value: s.users.total, label: 'Users' },
    { icon: Sprout, value: s.users.farmers, label: 'Farmers' },
    { icon: ShoppingBasket, value: s.users.buyers, label: 'Buyers' },
    { icon: UserPlus, value: s.users.newLast7Days, label: 'New in 7 days' }
  ];
  $: activityCards = s && [
    { icon: Package, value: s.listings.active, label: 'Active listings' },
    { icon: MessageSquare, value: s.activity.messages, label: 'Messages sent' },
    { icon: Star, value: s.activity.reviews, label: 'Reviews' },
    { icon: Eye, value: s.activity.views, label: 'Listing views' }
  ];

  const STATUS = [
    ['active', 'Active', 'var(--ramp-4)'],
    ['sold', 'Sold', 'var(--ramp-2)'],
    ['deactivated', 'Paused / removed', 'var(--color-orange-600)'],
    ['expired', 'Expired', 'var(--color-line-strong)']
  ];

  $: maxSignups = s ? Math.max(1, ...s.signups.map((x) => x.count)) : 1;
  $: maxTop = s ? Math.max(1, ...s.topProduce.map((x) => x.listings)) : 1;
</script>

{#if status === 'error'}
  <section class="card"><ErrorState message={error} on:retry={load} /></section>
{:else}
  <div class="stack">
    <StatsCards loading={status === 'loading'} cards={peopleCards ?? []} />
    <StatsCards loading={status === 'loading'} cards={activityCards ?? []} />

    {#if s}
      <div class="grid">
        <section class="card" aria-labelledby="status-title">
          <div class="card-header"><span class="icon-chip"><Package size={20} aria-hidden="true" /></span><h2 id="status-title">Listings by status</h2></div>
          {#if s.listings.total === 0}
            <p class="muted">No listings yet.</p>
          {:else}
            <div class="bars">
              {#each STATUS as [key, label, color]}
                <div class="bar-row">
                  <span class="lab">{label}</span>
                  <div class="track" role="presentation"><div class="fill" style="width: {(s.listings[key] / s.listings.total) * 100}%; background: {color}"></div></div>
                  <span class="n">{s.listings[key]}</span>
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <section class="card" aria-labelledby="top-title">
          <div class="card-header"><span class="icon-chip"><TrendingUp size={20} aria-hidden="true" /></span><h2 id="top-title">Most listed produce</h2></div>
          {#if s.topProduce.length === 0}
            <p class="muted">No active listings yet.</p>
          {:else}
            <div class="bars">
              {#each s.topProduce as t}
                <div class="bar-row">
                  <span class="lab">{t.produce}</span>
                  <div class="track" role="presentation"><div class="fill" style="width: {(t.listings / maxTop) * 100}%; background: var(--ramp-4)"></div></div>
                  <span class="n">{t.listings}</span>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </div>

      <section class="card" aria-labelledby="signup-title">
        <div class="card-header"><span class="icon-chip"><UserPlus size={20} aria-hidden="true" /></span><h2 id="signup-title">Sign-ups, last 14 days</h2></div>
        {#if s.signups.length === 0}
          <p class="muted">No sign-ups in the last 14 days.</p>
        {:else}
          <ul class="cols" aria-label="Sign-ups per day">
            {#each s.signups as d}
              <li title="{d.day}: {d.count}">
                <span class="col-n">{d.count}</span>
                <span class="col" style="height: {(d.count / maxSignups) * 100}%"></span>
                <span class="col-d">{d.day.slice(5)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
{/if}

<style>
  .grid { display: grid; gap: var(--space-6); }
  @media (min-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }

  .bar-row { display: grid; grid-template-columns: 8.5rem 1fr 2.5rem; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
  .lab { font-size: var(--text-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { height: 24px; overflow: hidden; border-radius: var(--radius-pill); background: var(--color-bg); }
  .fill { height: 100%; min-width: 4px; border-radius: var(--radius-pill); }
  .n { text-align: right; font-size: var(--text-sm); font-weight: 600; color: var(--color-muted); }

  .cols { display: flex; align-items: flex-end; gap: var(--space-2); height: 180px; margin: 0; padding: 0; list-style: none; }
  .cols li { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: flex-end; gap: var(--space-1); height: 100%; min-width: 0; }
  .col { display: block; width: 100%; max-width: 40px; min-height: 4px; border-radius: 6px 6px 0 0; background: var(--ramp-4); }
  .col-n { font-size: var(--text-xs); font-weight: 600; }
  .col-d { font-size: 0.6875rem; color: var(--color-muted); }
</style>
