<script>
  import { onMount } from 'svelte';
  import { Link, useNavigate } from 'svelte-navigator';
  import { Package, Eye, CircleCheck, MessageSquare, Plus, Search, ClipboardList, MapPin, Banknote, Sprout, ArrowRight } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import StatsCards from '../components/market/StatsCards.svelte';
  import ConversationList from '../components/messages/ConversationList.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { session } from '../lib/auth.js';
  import { api } from '../lib/api.js';
  import { ALL_PRODUCE, money, perUnit, unitLabel } from '../lib/format.js';
  import { unreadTotal } from '../lib/socket.js';

  const navigate = useNavigate();

  $: isFarmer = $session?.role !== 'BUYER';
  $: first = ($session?.name || '').split(' ')[0];

  let status = 'loading';
  let error = '';
  let conversations = [];
  let listings = [];
  let summary = null;
  let prices = [];
  let quick = '';

  async function load() {
    status = 'loading';
    try {
      const role = $session.role;
      const [convos, extra] = await Promise.all([
        api.conversations.list(),
        role === 'BUYER'
          ? Promise.all([api.analytics.summary(), api.analytics.prices()])
          : api.listings.mine()
      ]);
      conversations = convos.conversations;
      if (role === 'BUYER') {
        summary = extra[0];
        prices = extra[1].prices.slice(0, 6);
      } else {
        listings = extra.listings;
      }
      status = 'ready';
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  onMount(load);

  $: farmerCards = [
    { icon: Package, value: listings.filter((l) => l.status === 'ACTIVE').length, label: 'Active listings' },
    { icon: CircleCheck, value: listings.filter((l) => l.status === 'SOLD').length, label: 'Sold' },
    { icon: Eye, value: listings.reduce((n, l) => n + l.viewCount, 0), label: 'Total views' },
    { icon: MessageSquare, value: $unreadTotal, label: 'Unread messages' }
  ];

  $: buyerCards = summary
    ? [
        { icon: Package, value: summary.totalListings.toLocaleString(), label: 'Listings on the market' },
        { icon: Sprout, value: summary.uniqueProduce, label: 'Produce types' },
        { icon: MapPin, value: summary.uniqueLocations, label: 'Towns' },
        { icon: MessageSquare, value: $unreadTotal, label: 'Unread messages' }
      ]
    : [];

  const quickSearch = () => navigate(`/search${quick.trim() ? `?produce=${encodeURIComponent(quick.trim())}` : ''}`);
</script>

<PageLayout
  current="dashboard"
  kicker={isFarmer ? 'Farmer dashboard' : 'Buyer dashboard'}
  title="Akwaaba, {first || 'friend'}"
  lead={isFarmer ? 'Here is how your produce is doing.' : 'Find produce, compare prices and talk to farmers.'}
>
  {#if status === 'error'}
    <section class="card"><ErrorState message={error} on:retry={load} /></section>
  {:else}
    <StatsCards loading={status === 'loading'} cards={isFarmer ? farmerCards : buyerCards} />

    <div class="grid">
      <div class="stack">
        {#if isFarmer}
          <section class="card" aria-labelledby="actions-title">
            <div class="card-header">
              <span class="icon-chip"><Plus size={20} aria-hidden="true" /></span>
              <h2 id="actions-title">Quick actions</h2>
            </div>
            <div class="actions">
              <Link to="/listings/new" class="btn btn-primary"><Plus size={16} aria-hidden="true" /> New listing</Link>
              <Link to="/listings" class="btn btn-outline"><ClipboardList size={16} aria-hidden="true" /> Manage listings</Link>
              <Link to="/market" class="btn btn-outline"><Banknote size={16} aria-hidden="true" /> Check prices</Link>
            </div>
          </section>

          <section class="card" aria-labelledby="latest-title">
            <div class="card-header">
              <span class="icon-chip"><Package size={20} aria-hidden="true" /></span>
              <h2 id="latest-title">Your latest listings</h2>
            </div>
            {#if status === 'loading'}
              <span class="skeleton row-sk"></span><span class="skeleton row-sk"></span>
            {:else if listings.length === 0}
              <div class="empty-state">
                <span class="icon-chip"><Package size={24} aria-hidden="true" /></span>
                <p>You have not listed any produce yet.</p>
                <Link to="/listings/new" class="btn btn-primary btn-sm">Add your first listing</Link>
              </div>
            {:else}
              <ul class="plain">
                {#each listings.slice(0, 4) as l (l.id)}
                  <li>
                    <Link to="/listings/{l.id}" class="item">
                      <span><strong>{l.produceType}</strong> <span class="muted">· {l.quantity} {unitLabel(l.unit)} · {l.location}</span></span>
                      <span class="end">{money(l.pricePerUnit, l.currency)}/{perUnit(l.unit)} <span class="badge" class:badge-warm={l.status !== 'ACTIVE'}>{l.status.toLowerCase()}</span></span>
                    </Link>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {:else}
          <section class="card" aria-labelledby="quick-title">
            <div class="card-header">
              <span class="icon-chip"><Search size={20} aria-hidden="true" /></span>
              <h2 id="quick-title">What do you need?</h2>
            </div>
            <form class="quick" on:submit|preventDefault={quickSearch}>
              <label for="quick" class="sr-only">Produce</label>
              <input id="quick" type="text" list="produce-list" bind:value={quick} placeholder="e.g. Maize, Tomatoes, Plantain" />
              <datalist id="produce-list">{#each ALL_PRODUCE as p}<option value={p}></option>{/each}</datalist>
              <button class="btn btn-primary" type="submit"><Search size={16} aria-hidden="true" /> Find matches</button>
            </form>
          </section>

          <section class="card" aria-labelledby="prices-title">
            <div class="card-header">
              <span class="icon-chip"><Banknote size={20} aria-hidden="true" /></span>
              <h2 id="prices-title">Prices right now</h2>
              <Link to="/market" class="more">All prices <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            {#if status === 'loading'}
              <span class="skeleton row-sk"></span><span class="skeleton row-sk"></span>
            {:else if prices.length === 0}
              <p class="muted">No active listings yet.</p>
            {:else}
              <ul class="plain">
                {#each prices as p}
                  <li class="item static">
                    <strong>{p.produce}</strong>
                    <span class="end">{money(p.avgPrice)} / {perUnit(p.unit)} <span class="muted">({p.count} {p.count === 1 ? 'listing' : 'listings'})</span></span>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/if}
      </div>

      <section class="card" aria-labelledby="msgs-title">
        <div class="card-header">
          <span class="icon-chip"><MessageSquare size={20} aria-hidden="true" /></span>
          <h2 id="msgs-title">Recent messages</h2>
          <Link to="/messages" class="more">Open <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        {#if status === 'loading'}
          <span class="skeleton row-sk"></span><span class="skeleton row-sk"></span>
        {:else if conversations.length === 0}
          <div class="empty-state">
            <span class="icon-chip"><MessageSquare size={24} aria-hidden="true" /></span>
            <p>{isFarmer ? 'When buyers contact you, their messages show up here.' : 'Contact a farmer from any search result to start a conversation.'}</p>
          </div>
        {:else}
          <div class="convos"><ConversationList conversations={conversations.slice(0, 4)} /></div>
        {/if}
      </section>
    </div>
  {/if}
</PageLayout>

<style>
  .grid {
    display: grid;
    gap: var(--space-6);
    align-items: start;
  }
  @media (min-width: 900px) {
    .grid { grid-template-columns: 3fr 2fr; }
  }

  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .actions :global(.btn) { text-decoration: none; }

  .card-header :global(.more) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-left: auto;
    min-height: 44px;
    color: var(--color-green-700);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .plain { display: grid; margin: 0; padding: 0; list-style: none; }
  .plain :global(.item), .item.static {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    align-items: center;
    min-height: 48px;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-line);
    font-size: var(--text-sm);
  }
  .plain li:last-child :global(.item) { border-bottom: 0; }
  .end { display: inline-flex; align-items: center; gap: var(--space-2); font-weight: 600; }

  .quick { display: grid; gap: var(--space-3); }
  @media (min-width: 560px) { .quick { grid-template-columns: 1fr auto; } }

  .convos { margin: calc(var(--space-6) * -1); margin-top: 0; }
  .row-sk { height: 44px; margin-bottom: var(--space-3); }
</style>
