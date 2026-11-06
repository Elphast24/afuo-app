<script>
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { X } from 'lucide-svelte';

  export let open = false;
  export let title = '';
  /** narrow (confirmations) or wide (forms) */
  export let size = 'sm';

  const dispatch = createEventDispatcher();
  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;

  let panel;
  let previouslyFocused = null;

  const close = () => dispatch('close');

  async function onOpen() {
    previouslyFocused = document.activeElement;
    await tick();
    const first = panel?.querySelector('[autofocus], input, textarea, select, button:not(.close)');
    (first || panel)?.focus();
  }

  $: if (open) onOpen();
  $: if (!open && previouslyFocused) {
    previouslyFocused.focus?.();
    previouslyFocused = null;
  }

  function onKeydown(e) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab' && panel) {
      // keep focus inside the dialog
      const focusable = [...panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')].filter(
        (el) => el.offsetParent !== null
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  onDestroy(() => previouslyFocused?.focus?.());
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click|self={close}>
    <div class="panel {size}" role="dialog" aria-modal="true" aria-labelledby={titleId} tabindex="-1" bind:this={panel}>
      <header>
        <h2 id={titleId}>{title}</h2>
        <button type="button" class="close" on:click={close} aria-label="Close"><X size={20} aria-hidden="true" /></button>
      </header>
      <div class="body"><slot /></div>
      {#if $$slots.actions}
        <footer><slot name="actions" /></footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: rgba(10, 24, 16, 0.6);
  }

  .panel {
    width: 100%;
    max-height: 100%;
    overflow-y: auto;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    animation: dialog-in var(--dur-base) var(--ease-out);
  }
  .panel:focus {
    outline: none;
  }
  .sm { max-width: 440px; }
  .md { max-width: 600px; }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--color-line);
  }

  h2 {
    font-size: var(--text-lg);
  }

  .close {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-ink);
    cursor: pointer;
  }
  .close:hover {
    background: var(--color-bg);
  }

  .body {
    padding: var(--space-6);
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--color-line);
    background: var(--color-bg);
  }

  @keyframes dialog-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
