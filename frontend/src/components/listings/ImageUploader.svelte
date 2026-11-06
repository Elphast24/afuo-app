<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { ImagePlus, X } from 'lucide-svelte';
  import { assetUrl } from '../../lib/api.js';

  /** images already saved on the server: [{ id, url, isPrimary }] */
  export let existing = [];
  /** new files waiting to be uploaded: [{ file, preview }] (bindable) */
  export let queued = [];
  export let max = 5;
  export let disabled = false;

  const MAX_BYTES = 5 * 1024 * 1024;
  const dispatch = createEventDispatcher();

  let input;
  let error = '';

  $: total = existing.length + queued.length;

  function add(e) {
    error = '';
    const files = [...e.currentTarget.files];
    e.currentTarget.value = ''; // allow choosing the same file again
    const next = [...queued];

    for (const file of files) {
      if (existing.length + next.length >= max) {
        error = `You can add up to ${max} photos.`;
        break;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        error = `${file.name}: use a JPEG, PNG or WebP image.`;
        continue;
      }
      if (file.size > MAX_BYTES) {
        error = `${file.name} is over 5MB.`;
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    queued = next;
  }

  function removeQueued(i) {
    URL.revokeObjectURL(queued[i].preview);
    queued = queued.filter((_, idx) => idx !== i);
    error = '';
  }

  onDestroy(() => queued.forEach((q) => URL.revokeObjectURL(q.preview)));
</script>

<div class="uploader">
  <div class="head">
    <span class="label"><ImagePlus size={16} aria-hidden="true" /> Photos <span class="muted">({total}/{max})</span></span>
    <button type="button" class="btn btn-outline btn-sm" on:click={() => input.click()} disabled={disabled || total >= max}>
      <ImagePlus size={14} aria-hidden="true" /> Add photos
    </button>
    <input bind:this={input} type="file" accept="image/jpeg,image/png,image/webp" multiple class="sr-only" tabindex="-1" aria-label="Choose photos" on:change={add} />
  </div>

  {#if total > 0}
    <ul class="grid">
      {#each existing as img (img.id)}
        <li>
          <img src={assetUrl(img.url)} alt="" loading="lazy" />
          {#if img.isPrimary}<span class="badge primary">Cover</span>{/if}
          <button type="button" class="remove" aria-label="Remove photo" on:click={() => dispatch('removeExisting', img)} {disabled}>
            <X size={16} aria-hidden="true" />
          </button>
        </li>
      {/each}
      {#each queued as q, i (q.preview)}
        <li>
          <img src={q.preview} alt="New photo to upload: {q.file.name}" />
          <span class="badge new">New</span>
          <button type="button" class="remove" aria-label="Remove {q.file.name}" on:click={() => removeQueued(i)} {disabled}>
            <X size={16} aria-hidden="true" />
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="hint muted">Photos help buyers trust your listing. JPEG, PNG or WebP, up to 5MB each. The first photo is the cover.</p>
  {/if}

  {#if error}<p class="field-error" role="alert">{error}</p>{/if}
</div>

<style>
  .uploader { display: grid; gap: var(--space-3); }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .label { display: inline-flex; align-items: center; gap: var(--space-2); font-size: 0.875rem; font-weight: 600; }
  .hint { font-size: var(--text-sm); }

  .grid {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }

  li { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-sm); background: var(--color-bg); }
  img { width: 100%; height: 100%; object-fit: cover; }

  .badge { position: absolute; left: var(--space-2); bottom: var(--space-2); background: #fff; }
  .badge.new { background: var(--color-orange-100); color: var(--color-orange-700); }

  .remove {
    position: absolute;
    top: var(--space-1);
    right: var(--space-1);
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: rgba(15, 32, 24, 0.8);
    color: #fff;
    cursor: pointer;
  }
  .remove:hover { background: var(--color-danger); }
  .remove::after { content: ''; position: absolute; inset: -4px; } /* 44px touch target */
</style>
