<script>
  import { RotateCcw } from 'lucide-svelte';

  export const DEFAULT_WEIGHTS = { produce: 30, quantity: 20, location: 25, price: 15, availability: 10 };

  /** { produce, quantity, location, price, availability }, each 0-100 (bindable) */
  export let weights = { ...DEFAULT_WEIGHTS };

  const ROWS = [
    ['produce', 'Right produce'],
    ['quantity', 'Enough quantity'],
    ['location', 'Close to me'],
    ['price', 'Fits my budget'],
    ['availability', 'Available when I need it']
  ];

  $: sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const share = (v) => (sum > 0 ? Math.round((v / sum) * 100) : 0);
</script>

<fieldset class="weights">
  <legend>How much does each matter?</legend>
  <p class="hint muted">Drag to set your priorities. The shares always add up to 100%.</p>

  {#each ROWS as [key, label]}
    <div class="row">
      <label for="w-{key}">{label}</label>
      <input id="w-{key}" type="range" min="0" max="100" step="5" bind:value={weights[key]} aria-valuetext="{share(weights[key])} percent" />
      <output for="w-{key}">{share(weights[key])}%</output>
    </div>
  {/each}

  <button type="button" class="btn btn-outline btn-sm" on:click={() => (weights = { ...DEFAULT_WEIGHTS })}>
    <RotateCcw size={14} aria-hidden="true" /> Reset priorities
  </button>
</fieldset>

<style>
  .weights { display: grid; gap: var(--space-3); margin: 0; padding: 0; border: 0; }
  legend { padding: 0; margin-bottom: var(--space-1); font-size: 0.875rem; font-weight: 600; }
  .hint { font-size: var(--text-xs); margin-top: calc(var(--space-2) * -1); }

  .row {
    display: grid;
    grid-template-columns: 1fr 3rem;
    grid-template-areas: 'label out' 'range range';
    align-items: center;
    column-gap: var(--space-3);
  }
  label { grid-area: label; font-size: var(--text-sm); }
  output { grid-area: out; text-align: right; font-size: var(--text-sm); font-weight: 600; font-variant-numeric: tabular-nums; }
  input[type='range'] { grid-area: range; width: 100%; height: 44px; accent-color: var(--color-green-700); cursor: pointer; }
  .btn { justify-self: start; }
</style>
