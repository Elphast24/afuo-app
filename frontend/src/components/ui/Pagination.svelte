<script>
  import { createEventDispatcher } from 'svelte';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  export let page = 1;
  export let totalPages = 1;
  export let total = 0;
  export let disabled = false;

  const dispatch = createEventDispatcher();
</script>

{#if totalPages > 1}
  <nav class="pager" aria-label="Pagination">
    <span class="muted info" aria-live="polite">Page {page} of {totalPages} · {total} total</span>
    <div class="btns">
      <button type="button" class="btn btn-outline btn-sm" disabled={disabled || page <= 1} on:click={() => dispatch('page', page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </button>
      <button type="button" class="btn btn-outline btn-sm" disabled={disabled || page >= totalPages} on:click={() => dispatch('page', page + 1)}>
        Next <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  </nav>
{/if}

<style>
  .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-4); }
  .info { font-size: var(--text-sm); }
  .btns { display: flex; gap: var(--space-2); }
</style>
