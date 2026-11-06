<script>
  import PageLayout from '../components/PageLayout.svelte';
  import { PHOTO_CREDITS } from '../lib/credits.js';

  const ALL = [
    {
      image: 'hero-farmer.jpg',
      title: 'Harvest 2.jpg',
      author: 'Wilhelm Nomu Kutah',
      license: 'CC BY-SA 4.0',
      url: 'https://commons.wikimedia.org/wiki/File:Harvest_2.jpg'
    },
    ...PHOTO_CREDITS
  ];

  const licenseUrl = (l) => {
    const m = /^CC BY(-SA)? ([0-9.]+)$/.exec(l);
    return m ? `https://creativecommons.org/licenses/by${m[1] ? '-sa' : ''}/${m[2]}/` : null;
  };
</script>

<PageLayout current="home" kicker="Credits" title="Photo credits" lead="AgriMatch uses photographs shared on Wikimedia Commons. Thank you to the photographers. Images were cropped and compressed.">
  <section class="card" aria-labelledby="credits-title">
    <h2 id="credits-title" class="sr-only">Credits</h2>
    <ul class="list">
      {#each ALL as c (c.image)}
        <li>
          <span class="file">{c.image}</span>
          <span>
            <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a>
            by {c.author}, licensed
            {#if licenseUrl(c.license)}<a href={licenseUrl(c.license)} target="_blank" rel="noopener noreferrer">{c.license}</a>{:else}{c.license}{/if}.
          </span>
        </li>
      {/each}
    </ul>
  </section>
</PageLayout>

<style>
  .list { display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); }
  .list li { display: grid; gap: var(--space-1); padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-line); }
  .list li:last-child { border-bottom: 0; }
  @media (min-width: 700px) { .list li { grid-template-columns: 12rem 1fr; gap: var(--space-4); } }
  .file { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: var(--text-xs); color: var(--color-muted); }
  a { color: var(--color-green-700); text-decoration: underline; }
</style>
