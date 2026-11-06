<script>
  import { onMount, onDestroy } from 'svelte';
  import { useParams } from 'svelte-navigator';
  import { MessageSquare } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import ConversationList from '../components/messages/ConversationList.svelte';
  import ChatWindow from '../components/messages/ChatWindow.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { api } from '../lib/api.js';
  import { onSocket } from '../lib/socket.js';

  const params = useParams();

  let status = 'loading';
  let error = '';
  let conversations = [];
  let off = [];

  $: activeId = $params.conversationId ?? null;
  $: active = conversations.find((c) => c.id === activeId) ?? null;

  async function load(quiet = false) {
    if (!quiet) status = 'loading';
    try {
      ({ conversations } = await api.conversations.list());
      status = 'ready';
    } catch (e) {
      error = e.message;
      status = 'error';
    }
  }

  const touch = (id, patch) => (conversations = conversations.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  onMount(() => {
    load();
    off = [
      // A message arrived: refresh previews (cheap, and picks up brand-new conversations too)
      onSocket('message:new', () => load(true))
    ];
  });
  onDestroy(() => off.forEach((fn) => fn()));
</script>

<PageLayout current="messages" kicker="Messages" title="Your conversations" lead="Talk to farmers and buyers about the produce you are trading.">
  <section class="shell" class:has-chat={!!activeId} aria-label="Messages">
    <aside class="side" aria-label="Conversations">
      {#if status === 'loading'}
        <div class="pad"><span class="skeleton sk"></span><span class="skeleton sk"></span><span class="skeleton sk"></span></div>
      {:else if status === 'error'}
        <ErrorState message={error} on:retry={() => load()} />
      {:else if conversations.length === 0}
        <div class="empty-state">
          <span class="icon-chip"><MessageSquare size={24} aria-hidden="true" /></span>
          <p>No conversations yet. Contact a seller from a search result or listing to start one.</p>
        </div>
      {:else}
        <ConversationList {conversations} {activeId} />
      {/if}
    </aside>

    <div class="main">
      {#if active}
        {#key active.id}
          <ChatWindow conversation={active} on:read={(e) => touch(e.detail, { unreadCount: 0 })} on:sent={() => load(true)} />
        {/key}
      {:else if activeId && status === 'ready'}
        <div class="empty-state"><p>That conversation was not found.</p></div>
      {:else if status === 'ready'}
        <div class="empty-state">
          <span class="icon-chip"><MessageSquare size={24} aria-hidden="true" /></span>
          <p>Select a conversation to read it.</p>
        </div>
      {/if}
    </div>
  </section>
</PageLayout>

<style>
  .shell {
    display: grid;
    grid-template-columns: 1fr;
    height: min(70dvh, 680px);
    min-height: 420px;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .side { overflow-y: auto; border-right: 1px solid var(--color-line); }
  .main { min-height: 0; min-width: 0; }

  /* Phones: show the list, or the open chat, not both */
  .shell.has-chat .side { display: none; }
  .shell:not(.has-chat) .main { display: none; }

  @media (min-width: 900px) {
    .shell { grid-template-columns: 340px 1fr; }
    .shell.has-chat .side, .shell:not(.has-chat) .main { display: block; }
    .main { display: grid; align-content: stretch; }
  }

  .main > :global(.empty-state) { height: 100%; align-content: center; }
  .pad { display: grid; gap: var(--space-3); padding: var(--space-4); }
  .sk { height: 56px; }
</style>
