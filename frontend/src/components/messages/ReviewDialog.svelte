<script>
  import { createEventDispatcher } from 'svelte';
  import { Star, LoaderCircle } from 'lucide-svelte';
  import Dialog from '../ui/Dialog.svelte';
  import { api } from '../../lib/api.js';
  import { showToast } from '../../lib/toast.js';

  export let open = false;
  /** { listingId, buyerId?, name } : buyerId is only needed when the farmer is the reviewer */
  export let target = null;

  const dispatch = createEventDispatcher();

  let rating = 0;
  let comment = '';
  let error = '';
  let sending = false;

  $: if (!open) {
    rating = 0;
    comment = '';
    error = '';
  }

  async function submit() {
    if (!rating) {
      error = 'Choose a rating from 1 to 5 stars.';
      return;
    }
    sending = true;
    error = '';
    try {
      await api.reviews.create({
        listingId: target.listingId,
        buyerId: target.buyerId,
        rating,
        comment: comment.trim() || undefined
      });
      showToast('Thanks for your review.', 'success');
      dispatch('close');
    } catch (e) {
      error = e.code === 'CONFLICT' ? 'You have already reviewed this listing.' : e.message;
    } finally {
      sending = false;
    }
  }
</script>

<Dialog {open} title="Review {target?.name || 'this person'}" on:close={() => !sending && dispatch('close')}>
  <form id="review-form" on:submit|preventDefault={submit} class="stack" novalidate>
    <fieldset class="stars">
      <legend>How was your experience?</legend>
      <div class="row">
        {#each [1, 2, 3, 4, 5] as n}
          <label class:on={n <= rating} title="{n} star{n > 1 ? 's' : ''}">
            <input type="radio" name="rating" value={n} bind:group={rating} class="sr-only" />
            <Star size={28} aria-hidden="true" fill={n <= rating ? 'currentColor' : 'none'} />
            <span class="sr-only">{n} star{n > 1 ? 's' : ''}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <div class="field">
      <label for="comment">Comment <span class="muted">(optional)</span></label>
      <textarea id="comment" bind:value={comment} maxlength="1000" placeholder="Was the produce as described? Easy to deal with?"></textarea>
    </div>
    {#if error}<p class="field-error" role="alert">{error}</p>{/if}
  </form>

  <svelte:fragment slot="actions">
    <button type="button" class="btn btn-outline" on:click={() => dispatch('close')} disabled={sending}>Cancel</button>
    <button type="submit" form="review-form" class="btn btn-primary" disabled={sending}>
      {#if sending}<LoaderCircle size={16} aria-hidden="true" /> Sending...{:else}Submit review{/if}
    </button>
  </svelte:fragment>
</Dialog>

<style>
  .stars { margin: 0; padding: 0; border: 0; }
  legend { padding: 0; margin-bottom: var(--space-2); font-size: 0.875rem; font-weight: 600; }
  .row { display: flex; gap: var(--space-1); }
  label.on { color: var(--series-3); }
  .row label {
    position: relative;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    color: var(--color-line-strong);
    cursor: pointer;
  }
  .row label:focus-within { outline: 3px solid var(--color-orange-600); outline-offset: 2px; }
  .row label:hover { color: var(--series-3); }
</style>
