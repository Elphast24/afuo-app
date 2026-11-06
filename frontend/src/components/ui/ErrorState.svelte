<script>
  import { createEventDispatcher } from 'svelte';
  import { CircleAlert, RotateCcw } from 'lucide-svelte';

  export let message = 'Something went wrong.';
  export let retry = true;

  const dispatch = createEventDispatcher();
</script>

<div class="empty-state" role="alert">
  <span class="icon-chip danger"><CircleAlert size={24} aria-hidden="true" /></span>
  <p>{message}</p>
  {#if retry}
    <button type="button" class="btn btn-outline btn-sm" on:click={() => dispatch('retry')}>
      <RotateCcw size={14} aria-hidden="true" /> Try again
    </button>
  {/if}
</div>

<style>
  .danger {
    background: var(--color-danger-bg);
    color: var(--color-danger);
  }
</style>
