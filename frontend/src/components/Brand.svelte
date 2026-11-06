<script>
  /** 'md' for the header, 'sm' for the footer */
  export let size = 'md';
</script>

<!-- The logo is dark green, so it sits on a white tile to stay readable on the dark banners and footer -->
<span class="brand-lockup" class:sm={size === 'sm'}>
  <span class="mark-tile"><img src="/logo-mark.png" alt="" width="329" height="183" /></span>
  <span class="name">AgriMatch</span>
</span>

<style>
  .brand-lockup { display: inline-flex; align-items: center; gap: var(--space-2); }
  .mark-tile {
    display: grid;
    place-items: center;
    width: 56px;
    height: 40px;
    border-radius: 12px;
    background: #fff;
  }
  .mark-tile img { width: 40px; height: auto; }
  .name { font-size: var(--text-lg); font-weight: 700; letter-spacing: -0.01em; }

  .sm .mark-tile { width: 48px; height: 34px; border-radius: 10px; }
  .sm .mark-tile img { width: 34px; }
</style>
