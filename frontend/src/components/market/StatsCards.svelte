<script>
  /** [{ icon: LucideComponent, value, label }] */
  export let cards = [];
  export let loading = false;
</script>

<div class="stats-grid">
  {#if loading}
    {#each Array(4) as _}
      <div class="stat-card"><span class="skeleton chip-sk"></span><span class="skeleton num-sk"></span><span class="skeleton lab-sk"></span></div>
    {/each}
  {:else}
    {#each cards as card (card.label)}
      <div class="stat-card">
        <span class="icon-chip"><svelte:component this={card.icon} size={20} aria-hidden="true" /></span>
        <div class="stat-number">{card.value}</div>
        <div class="stat-label">{card.label}</div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .stats-grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  }

  .stat-card {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-6);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .stat-card .icon-chip {
    margin-bottom: var(--space-3);
  }

  .stat-number {
    font-size: 1.875rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--color-green-900);
  }

  .stat-label {
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  .chip-sk { width: 44px; height: 44px; border-radius: 50%; margin-bottom: var(--space-3); }
  .num-sk { width: 60%; height: 30px; }
  .lab-sk { width: 40%; height: 14px; margin-top: var(--space-1); }
</style>
