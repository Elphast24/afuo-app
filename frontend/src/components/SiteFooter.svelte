<script>
  import { Link } from 'svelte-navigator';
  import Brand from './Brand.svelte';

  const year = new Date().getFullYear();
</script>

<footer class="footer">
  <div class="container grid">
    <div class="about">
      <Brand size="sm" />
      <p>Agricultural produce market information and matching system.</p>
    </div>

    <nav class="col" aria-label="For farmers">
      <h2>For farmers</h2>
      <Link to="/listings/new">List your produce</Link>
      <Link to="/market">Market analytics</Link>
    </nav>

    <nav class="col" aria-label="For buyers">
      <h2>For buyers</h2>
      <Link to="/search">Search listings</Link>
      <Link to="/market">Price trends</Link>
    </nav>
  </div>

  <div class="container legal">
    <p>&copy; {year} AgriMatch. Connecting farmers and buyers across Ghana.</p>
    <p>Photos from Wikimedia Commons contributors, cropped and compressed. <Link to="/credits">Photo credits</Link></p>
  </div>
</footer>

<style>
  .footer {
    background: var(--color-green-900);
    color: #fff;
    padding: var(--space-12) 0 var(--space-6);
  }

  .footer :global(a:focus-visible) {
    outline-color: #fff;
  }

  .grid {
    display: grid;
    gap: var(--space-8);
    grid-template-columns: 1fr;
  }

  .about p {
    margin-top: var(--space-3);
    max-width: 34ch;
    color: var(--color-on-dark-muted);
    font-size: var(--text-sm);
  }

  .col {
    display: flex;
    flex-direction: column;
  }

  .col h2 {
    margin-bottom: var(--space-2);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-on-dark-muted);
  }

  .col :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: var(--text-sm);
  }

  .col :global(a:hover),
  .legal :global(a:hover) {
    text-decoration: underline;
  }

  .legal {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-8);
    padding-top: var(--space-4);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    font-size: var(--text-xs);
    color: var(--color-on-dark-muted);
  }

  .legal :global(a) {
    text-decoration: underline;
  }

  @media (min-width: 720px) {
    .grid {
      grid-template-columns: 2fr 1fr 1fr;
    }
  }
</style>
