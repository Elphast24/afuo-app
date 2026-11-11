<script>
  import { Copy, X, Info } from 'lucide-svelte';
  import { devCode } from '../lib/devcode.js';
  import { showToast } from '../lib/toast.js';

  // Fallback while no SMS provider is connected: the API returns the code (devCode) and we show it on screen.
  // Once real SMS is wired in, the API stops sending devCode and this pop-up never appears.
  async function copy() {
    try {
      await navigator.clipboard.writeText($devCode.code);
      showToast('Code copied.', 'success');
    } catch {
      showToast('Could not copy. Select the code and copy it.', 'error');
    }
  }
</script>

{#if $devCode}
  <aside class="dev-popup" role="status" aria-live="polite" aria-label="Your sign-in code">
    <div class="head">
      <p class="tag"><Info size={16} aria-hidden="true" /> Code shown on screen</p>
      <button type="button" class="icon-btn" on:click={() => devCode.set(null)} aria-label="Dismiss the sign-in code"><X size={18} aria-hidden="true" /></button>
    </div>
    <p class="why">Your sign-in code is:</p>
    <p class="code" aria-label="Code {$devCode.code.split('').join(' ')}">{$devCode.code}</p>
    <button type="button" class="btn btn-outline copy" on:click={copy}><Copy size={16} aria-hidden="true" /> Copy code</button>
    <p class="disclaimer">Disclaimer: we have not yet connected a paid SMS service, so no text message is sent. Until we do, your code is shown here instead. Anyone who can see this screen can see it, so keep it private.</p>
  </aside>
{/if}

<style>
  .dev-popup {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 2100;
    width: min(320px, calc(100vw - 2 * var(--space-4)));
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: var(--shadow-md);
    border: 2px solid var(--color-amber-500);
    animation: pop var(--dur-base) var(--ease-out);
  }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .tag { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-orange-700); }
  .icon-btn { display: grid; place-items: center; width: 44px; height: 44px; margin: calc(-1 * var(--space-2)); border: 0; border-radius: 50%; background: transparent; color: var(--color-ink); cursor: pointer; }
  .icon-btn:hover { background: var(--color-amber-100); }
  .icon-btn:focus-visible { outline: 3px solid var(--color-green-900); outline-offset: 2px; }
  .why { margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-muted); }
  .code { margin: var(--space-2) 0 var(--space-3); font-family: var(--font-display); font-size: 2.5rem; letter-spacing: 0.2em; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .copy { width: 100%; min-height: 44px; }
  .disclaimer { margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-amber-200); font-size: var(--text-xs); line-height: 1.5; color: var(--color-muted); }

  @keyframes pop {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dev-popup { animation: none; }
  }
</style>
