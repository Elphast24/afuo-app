<script>
  import { Link } from 'svelte-navigator';
  import { session } from '../../lib/auth.js';
  import { initials, timeAgo } from '../../lib/format.js';

  export let conversations = [];
  export let activeId = null;

  const other = (c, me) => (me && c.buyer.id === me.id ? c.farmer : c.buyer);
</script>

<ul class="list">
  {#each conversations as c (c.id)}
    {@const who = other(c, $session)}
    <li>
      <Link to="/messages/{c.id}" class="row {c.id === activeId ? 'active' : ''}" aria-current={c.id === activeId ? 'true' : undefined}>
        <span class="avatar" aria-hidden="true">{initials(who.name)}</span>
        <span class="text">
          <span class="top">
            <strong>{who.name || 'AgriMatch user'}</strong>
            <time>{timeAgo(c.lastMessage?.createdAt ?? c.createdAt)}</time>
          </span>
          <span class="produce">{c.listing.produceType} · {c.listing.location}</span>
          <span class="last" class:unread={c.unreadCount > 0}>
            {c.lastMessage ? (c.lastMessage.senderId === $session?.id ? 'You: ' : '') + c.lastMessage.content : 'No messages yet'}
          </span>
        </span>
        {#if c.unreadCount > 0}
          <span class="count" aria-label="{c.unreadCount} unread">{c.unreadCount}</span>
        {/if}
      </Link>
    </li>
  {/each}
</ul>

<style>
  .list {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .list :global(.row) {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-line);
    transition: background-color var(--dur-fast) var(--ease-out);
  }
  .list :global(.row:hover) {
    background: var(--color-green-50);
  }
  .list :global(.row.active) {
    background: var(--color-green-100);
  }

  .avatar {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-green-900);
    color: #fff;
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .text {
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 2px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }

  time {
    flex: none;
    font-size: var(--text-xs);
    color: var(--color-muted);
  }

  .produce {
    font-size: var(--text-xs);
    color: var(--color-orange-700);
    font-weight: 500;
  }

  .last {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--color-muted);
  }
  .last.unread {
    color: var(--color-ink);
    font-weight: 600;
  }

  .count {
    display: grid;
    place-items: center;
    flex: none;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--color-orange-600);
    color: #fff;
    font-size: var(--text-xs);
    font-weight: 700;
  }
</style>
