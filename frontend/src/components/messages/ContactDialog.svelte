<script>
  import { createEventDispatcher } from 'svelte';
  import { useNavigate } from 'svelte-navigator';
  import { Send, LoaderCircle } from 'lucide-svelte';
  import Dialog from '../ui/Dialog.svelte';
  import { api } from '../../lib/api.js';
  import { showToast } from '../../lib/toast.js';

  export let open = false;
  /** { id, produceType, farmerName } */
  export let target = null;

  const navigate = useNavigate();
  const dispatch = createEventDispatcher();

  let message = '';
  let sending = false;
  let error = '';

  $: if (open && target && !message) message = `Hello${target.farmerName ? ' ' + target.farmerName.split(' ')[0] : ''}, is your ${target.produceType} still available?`;
  $: if (!open) {
    message = '';
    error = '';
  }

  async function send() {
    if (!message.trim()) {
      error = 'Write a short message first.';
      return;
    }
    sending = true;
    error = '';
    try {
      const { conversation } = await api.conversations.start(target.id, message.trim());
      showToast('Message sent.', 'success');
      dispatch('close');
      navigate(`/messages/${conversation.id}`);
    } catch (e) {
      error = e.message;
    } finally {
      sending = false;
    }
  }
</script>

<Dialog {open} title="Message {target?.farmerName || 'the farmer'}" on:close={() => !sending && dispatch('close')}>
  <form on:submit|preventDefault={send} id="contact-form" novalidate class="stack">
    <p class="muted">About: <strong>{target?.produceType}</strong></p>
    <div class="field" class:invalid={error}>
      <label for="msg">Your message</label>
      <textarea id="msg" bind:value={message} maxlength="2000" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'msg-err' : undefined}></textarea>
      {#if error}<span class="field-error" id="msg-err" role="alert">{error}</span>{/if}
    </div>
  </form>
  <svelte:fragment slot="actions">
    <button type="button" class="btn btn-outline" on:click={() => dispatch('close')} disabled={sending}>Cancel</button>
    <button type="submit" form="contact-form" class="btn btn-primary" disabled={sending}>
      {#if sending}<LoaderCircle size={16} aria-hidden="true" /> Sending...{:else}<Send size={16} aria-hidden="true" /> Send message{/if}
    </button>
  </svelte:fragment>
</Dialog>
