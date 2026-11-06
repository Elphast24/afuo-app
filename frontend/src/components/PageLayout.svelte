<script>
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  /** id of the active page, passed to the header nav */
  export let current;
  export let kicker = '';
  export let title;
  export let lead = '';
</script>

<div class="page">
  <section class="banner">
    <SiteHeader {current} />
    <div class="container banner-inner">
      {#if kicker}<p class="kicker">{kicker}</p>{/if}
      <h1>{title}</h1>
      {#if lead}<p class="lead">{lead}</p>{/if}
    </div>
  </section>

  <main class="main">
    <div class="container">
      <slot />
    </div>
  </main>

  <SiteFooter />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  .banner {
    position: relative;
    padding: 9.5rem 0 calc(var(--space-12) + var(--space-6));
    color: #fff;
    background: linear-gradient(rgba(15, 42, 31, 0.84), rgba(15, 42, 31, 0.94)),
      url('/images/hero-farmer.jpg') center 30% / cover no-repeat;
    background-color: var(--color-green-900);
  }

  @media (min-width: 760px) {
    .banner {
      padding-top: 8rem;
    }
  }

  .kicker {
    margin-bottom: var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f4b9a5;
  }

  h1 {
    max-width: 18ch;
    font-size: var(--text-display);
    font-weight: 500;
    letter-spacing: -0.025em;
  }

  .lead {
    max-width: 52ch;
    margin-top: var(--space-4);
    font-size: var(--text-lg);
    color: var(--color-on-dark-muted);
  }

  /* Content sheet overlaps the banner with a rounded top, echoing the hero cut-outs */
  .main {
    flex: 1;
    margin-top: calc(var(--space-6) * -1);
    padding: var(--space-8) 0 var(--space-16);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-bg);
    position: relative;
  }

  .main .container {
    display: grid;
    /* let wide children (tables) scroll inside their card instead of stretching the page */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-6);
  }
</style>
