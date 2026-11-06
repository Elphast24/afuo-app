<script>
  import { onMount } from 'svelte';
  import { Search, UserX, UserCheck } from 'lucide-svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Pagination from '../ui/Pagination.svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import { api } from '../../lib/api.js';
  import { session } from '../../lib/auth.js';
  import { showToast } from '../../lib/toast.js';
  import { formatDate, timeAgo } from '../../lib/format.js';

  let status = 'loading';
  let error = '';
  let items = [];
  let pagination = { page: 1, totalPages: 1, total: 0 };

  let search = '';
  let role = '';
  let state = '';
  let busyId = null;
  let confirm = null; // { user, activate }
  let timer;

  async function load(page = 1) {
    status = items.length && status === 'ready' ? 'refreshing' : 'loading';
    try {
      const data = await api.admin.users({ search: search.trim() || undefined, role: role || undefined, status: state || undefined, page, limit: 15 });
      items = data.items;
      pagination = data.pagination;
      status = 'ready';
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  onMount(() => {
    load();
    return () => clearTimeout(timer);
  });

  const onSearch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(1), 300);
  };

  async function apply(user, changes, message) {
    busyId = user.id;
    try {
      const { user: updated } = await api.admin.updateUser(user.id, changes);
      items = items.map((u) => (u.id === user.id ? { ...u, ...updated } : u));
      showToast(message, 'success');
    } catch (e) {
      showToast(e.message, 'error');
      await load(pagination.page); // a failed role change leaves the dropdown showing the wrong value
    } finally {
      busyId = null;
    }
  }

  async function doConfirm() {
    const { user, activate } = confirm;
    confirm = null;
    await apply(user, { isActive: activate }, activate ? `${user.name || 'User'} reactivated.` : `${user.name || 'User'} deactivated and signed out.`);
  }
</script>

<section class="card" aria-labelledby="users-title">
  <div class="card-header"><h2 id="users-title">Users</h2></div>

  <form class="filters" on:submit|preventDefault={() => load(1)} role="search">
    <div class="field grow">
      <label for="u-search" class="sr-only">Search users</label>
      <div class="search"><Search size={16} aria-hidden="true" /><input id="u-search" type="search" bind:value={search} on:input={onSearch} placeholder="Search name, phone or username" /></div>
    </div>
    <div class="field">
      <label for="u-role" class="sr-only">Role</label>
      <select id="u-role" bind:value={role} on:change={() => load(1)}>
        <option value="">All roles</option><option value="FARMER">Farmers</option><option value="BUYER">Buyers</option><option value="ADMIN">Admins</option>
      </select>
    </div>
    <div class="field">
      <label for="u-state" class="sr-only">Status</label>
      <select id="u-state" bind:value={state} on:change={() => load(1)}>
        <option value="">Any status</option><option value="active">Active</option><option value="inactive">Deactivated</option>
      </select>
    </div>
  </form>

  {#if status === 'error'}
    <ErrorState message={error} on:retry={() => load(pagination.page)} />
  {:else if status === 'loading'}
    <div class="stack"><span class="skeleton sk"></span><span class="skeleton sk"></span><span class="skeleton sk"></span></div>
  {:else if items.length === 0}
    <div class="empty-state"><p>No users match these filters.</p></div>
  {:else}
    <div class="table-wrap" class:dim={status === 'refreshing'}>
      <table>
        <caption class="sr-only">Registered users</caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">Phone</th><th scope="col">Role</th><th scope="col" class="num">Listings</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Last sign-in</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {#each items as u (u.id)}
            {@const me = u.id === $session?.id}
            <tr class:off={!u.isActive}>
              <th scope="row">{u.name || 'Not set'}{#if u.username}<span class="muted"> ({u.username})</span>{/if}{#if me}<span class="badge you">you</span>{/if}</th>
              <td>{u.username ? 'n/a' : u.phone}</td>
              <td>
                {#if u.role === 'ADMIN'}
                  <span class="badge">Admin</span>
                {:else}
                  <label class="sr-only" for="role-{u.id}">Role for {u.name || u.phone}</label>
                  <select id="role-{u.id}" class="mini" value={u.role} disabled={busyId === u.id} on:change={(e) => apply(u, { role: e.currentTarget.value }, 'Role updated.')}>
                    <option value="FARMER">Farmer</option><option value="BUYER">Buyer</option>
                  </select>
                {/if}
              </td>
              <td class="num">{u.listingCount}</td>
              <td><span class="badge" class:badge-warm={!u.isActive}>{u.isActive ? 'Active' : 'Deactivated'}</span></td>
              <td>{formatDate(u.createdAt.slice(0, 10))}</td>
              <td>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
              <td class="act">
                {#if !me}
                  {#if u.isActive}
                    <button type="button" class="btn btn-danger btn-sm" disabled={busyId === u.id} on:click={() => (confirm = { user: u, activate: false })}><UserX size={14} aria-hidden="true" /> Deactivate</button>
                  {:else}
                    <button type="button" class="btn btn-outline btn-sm" disabled={busyId === u.id} on:click={() => apply(u, { isActive: true }, `${u.name || 'User'} reactivated.`)}><UserCheck size={14} aria-hidden="true" /> Reactivate</button>
                  {/if}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Pagination {...pagination} disabled={status === 'refreshing'} on:page={(e) => load(e.detail)} />
  {/if}
</section>

<Dialog open={!!confirm} title="Deactivate this account?" on:close={() => (confirm = null)}>
  <p><strong>{confirm?.user.name || confirm?.user.phone}</strong> will be signed out everywhere and will not be able to sign in again until you reactivate them. Their listings stay as they are.</p>
  <svelte:fragment slot="actions">
    <button type="button" class="btn btn-outline" on:click={() => (confirm = null)}>Cancel</button>
    <button type="button" class="btn btn-primary" on:click={doConfirm}>Deactivate</button>
  </svelte:fragment>
</Dialog>

<style>
  .filters { display: grid; gap: var(--space-3); margin-bottom: var(--space-4); }
  @media (min-width: 760px) { .filters { grid-template-columns: 1fr auto auto; } }
  .search { position: relative; }
  .search :global(svg) { position: absolute; left: 14px; top: 16px; color: var(--color-muted); }
  .search input { padding-left: 40px; }

  .table-wrap { overflow-x: auto; }
  .dim { opacity: 0.55; }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  th, td { padding: var(--space-3); border-bottom: 1px solid var(--color-line); text-align: left; white-space: nowrap; vertical-align: middle; }
  thead th { font-size: var(--text-xs); letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); }
  tbody th { font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.off td, tr.off th { color: var(--color-muted); }
  .act { text-align: right; }
  .mini { min-height: 44px; width: auto; padding: 0 var(--space-2); }
  .you { margin-left: var(--space-2); background: var(--color-orange-100); color: var(--color-orange-700); }
  .sk { height: 48px; }
</style>
