<script>
  import { Link } from 'svelte-navigator';
  import { X } from 'lucide-svelte';
  import SiteHeader from '../components/SiteHeader.svelte';

  /** id of the heading inside the slot, for the dialog-like region label */
  export let labelledby;
</script>

<div class="auth">
  <div class="backdrop" aria-hidden="true"></div>
  <SiteHeader current="" />

  <main class="stage">
    <section class="panel" aria-labelledby={labelledby}>
      <Link to="/" class="close" aria-label="Close and return home"><X size={20} aria-hidden="true" /></Link>
      <slot />
    </section>
  </main>
</div>

<style>
  .auth {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    color: var(--color-ink);
    background: var(--color-green-900);
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: linear-gradient(rgba(15, 42, 31, 0.86), rgba(15, 42, 31, 0.94)),
      url('/images/hero-farmer.jpg') center 30% / cover no-repeat;
  }

  .stage {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    padding: 9.5rem 0.75rem var(--space-8);
  }

  @media (min-width: 760px) {
    .stage {
      padding: 7rem var(--space-4) var(--space-8);
    }
  }

  .panel {
    position: relative;
    width: 100%;
    max-width: 440px;
    padding: var(--space-8) var(--space-6) var(--space-8);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    text-align: center;
    animation: panel-in var(--dur-base) var(--ease-out);
  }

  @media (min-width: 480px) {
    .panel {
      padding-inline: var(--space-8);
    }
  }

  .panel :global(.close) {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--color-muted);
    transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
  }

  .panel :global(.close:hover) {
    background: var(--color-bg);
    color: var(--color-ink);
  }

  @keyframes panel-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
