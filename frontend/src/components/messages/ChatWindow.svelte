<script>
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  import { Link } from 'svelte-navigator';
  import { Send, LoaderCircle, ArrowLeft, Star } from 'lucide-svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import ReviewDialog from './ReviewDialog.svelte';
  import { api } from '../../lib/api.js';
  import { session } from '../../lib/auth.js';
  import { onSocket, activeConversationId, refreshUnread } from '../../lib/socket.js';
  import { clockTime, formatDate, money, perUnit } from '../../lib/format.js';

  /** a row of GET /conversations */
  export let conversation;

  const dispatch = createEventDispatcher();

  let status = 'loading';
  let error = '';
  let messages = [];
  let draft = '';
  let sending = false;
  let sendError = '';
  let scroller;
  let reviewing = false;
  let off = [];

  $: me = $session;
  $: iAmBuyer = me && conversation.buyer.id === me.id;
  $: other = iAmBuyer ? conversation.farmer : conversation.buyer;
  $: reviewTarget = {
    listingId: conversation.listing.id,
    buyerId: iAmBuyer ? undefined : conversation.buyer.id,
    name: other.name
  };

  async function scrollToEnd() {
    await tick();
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  async function markRead() {
    try {
      await api.conversations.markRead(conversation.id);
      refreshUnread();
      dispatch('read', conversation.id);
    } catch {
      /* not critical */
    }
  }

  async function load() {
    status = 'loading';
    try {
      ({ messages } = await api.conversations.messages(conversation.id, { limit: 100 }));
      status = 'ready';
      await scrollToEnd();
      markRead();
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  function addMessage(m) {
    if (messages.some((x) => x.id === m.id)) return;
    messages = [...messages, m];
    scrollToEnd();
  }

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;
    sending = true;
    sendError = '';
    try {
      const { message } = await api.conversations.send(conversation.id, content);
      draft = '';
      addMessage(message);
      dispatch('sent', message);
    } catch (e) {
      sendError = e.message;
    } finally {
      sending = false;
    }
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  onMount(() => {
    activeConversationId.set(conversation.id);
    load();
    off = [
      onSocket('message:new', (m) => {
        if (m.conversationId !== conversation.id) return;
        addMessage(m);
        if (m.senderId !== me?.id) markRead();
      })
    ];
  });

  onDestroy(() => {
    off.forEach((fn) => fn());
    activeConversationId.set(null);
  });
</script>

<section class="chat" aria-label="Conversation with {other.name || 'user'}">
  <header>
    <Link to="/messages" class="back" aria-label="Back to all conversations"><ArrowLeft size={20} aria-hidden="true" /></Link>
    <div class="who">
      <strong>{other.name || 'AgriMatch user'}</strong>
      <Link to="/listings/{conversation.listing.id}" class="about">{conversation.listing.produceType} · {money(conversation.listing.pricePerUnit, conversation.listing.currency)} · {conversation.listing.location}</Link>
    </div>
    <button type="button" class="btn btn-outline btn-sm" on:click={() => (reviewing = true)}><Star size={14} aria-hidden="true" /> Review</button>
  </header>

  <div class="scroll" bind:this={scroller} role="log" aria-live="polite" aria-label="Messages">
    {#if status === 'loading'}
      <span class="skeleton sk left"></span><span class="skeleton sk right"></span><span class="skeleton sk left"></span>
    {:else if status === 'error'}
      <ErrorState message={error} on:retry={load} />
    {:else if messages.length === 0}
      <p class="empty muted">No messages yet. Say hello.</p>
    {:else}
      {#each messages as m, i (m.id)}
        {#if i === 0 || formatDate(messages[i - 1].createdAt) !== formatDate(m.createdAt)}
          <p class="day">{formatDate(m.createdAt)}</p>
        {/if}
        <div class="bubble {m.senderId === me?.id ? 'mine' : 'theirs'}">
          <p>{m.content}</p>
          <time datetime={m.createdAt}>{clockTime(m.createdAt)}</time>
        </div>
      {/each}
    {/if}
  </div>

  <form class="composer" on:submit|preventDefault={send}>
    <label for="draft" class="sr-only">Message</label>
    <textarea id="draft" rows="1" bind:value={draft} on:keydown={onKeydown} placeholder="Write a message" maxlength="2000" disabled={status !== 'ready'}></textarea>
    <button type="submit" class="btn btn-primary" disabled={sending || !draft.trim() || status !== 'ready'} aria-label="Send message">
      {#if sending}<LoaderCircle size={18} aria-hidden="true" />{:else}<Send size={18} aria-hidden="true" />{/if}
    </button>
  </form>
  {#if sendError}<p class="field-error send-error" role="alert">{sendError}</p>{/if}
</section>

<ReviewDialog open={reviewing} target={reviewTarget} on:close={() => (reviewing = false)} />

<style>
  .chat { display: grid; grid-template-rows: auto 1fr auto; height: 100%; min-height: 0; }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-line);
  }
  header :global(.back) { display: grid; place-items: center; width: 44px; height: 44px; margin-left: calc(var(--space-2) * -1); border-radius: 50%; }
  header :global(.back:hover) { background: var(--color-bg); }
  @media (min-width: 900px) { header :global(.back) { display: none; } }

  .who { display: grid; flex: 1; min-width: 0; }
  .who strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who :global(.about) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-xs); color: var(--color-orange-700); font-weight: 500; }
  .who :global(.about:hover) { text-decoration: underline; }

  .scroll {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 0;
    padding: var(--space-4);
    overflow-y: auto;
    background: var(--color-bg);
  }

  .day { align-self: center; margin: var(--space-2) 0; padding: 2px var(--space-3); border-radius: var(--radius-pill); background: var(--color-surface); font-size: var(--text-xs); color: var(--color-muted); }
  .empty { margin: auto; }

  .bubble { max-width: min(80%, 460px); padding: var(--space-2) var(--space-3); border-radius: 16px; }
  .bubble p { white-space: pre-wrap; overflow-wrap: anywhere; }
  .bubble time { display: block; margin-top: 2px; font-size: 0.6875rem; opacity: 0.75; text-align: right; }
  .theirs { align-self: flex-start; border-bottom-left-radius: 4px; background: var(--color-surface); border: 1px solid var(--color-line); }
  .mine { align-self: flex-end; border-bottom-right-radius: 4px; background: var(--color-green-900); color: #fff; }

  .sk { height: 44px; width: 55%; border-radius: 16px; }
  .sk.right { align-self: flex-end; }

  .composer { display: flex; align-items: flex-end; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-top: 1px solid var(--color-line); background: var(--color-surface); }
  .composer textarea { min-height: 48px; max-height: 140px; resize: none; border-radius: 24px; }
  .composer .btn { flex: none; width: 48px; padding: 0; }
  .send-error { padding: 0 var(--space-4) var(--space-3); background: var(--color-surface); }
</style>
