<script>
  import { createEventDispatcher } from 'svelte';
  import { Package, Banknote, MapPin, Sprout } from 'lucide-svelte';
  import Dialog from '../ui/Dialog.svelte';
  import { CITIES } from '../../lib/format.js';

  export let open = false;
  /** { minQuantity, maxPrice, location, organic } */
  export let filters = {};

  const dispatch = createEventDispatcher();

  let draft = { ...filters };
  let wasOpen = false;

  // Start from the applied filters only when the dialog opens. (Svelte treats object props as always changed, so
  // resetting on every update would wipe what the user is typing whenever the page re-renders behind the dialog.)
  $: {
    if (open && !wasOpen) draft = { minQuantity: '', maxPrice: '', location: '', organic: false, ...filters };
    wasOpen = open;
  }

  const apply = () => dispatch('apply', { ...draft });
  const clear = () => dispatch('apply', { minQuantity: '', maxPrice: '', location: '', organic: false });
</script>

<Dialog {open} title="Filter produce" on:close={() => dispatch('close')}>
  <form id="filter-form" class="stack" on:submit|preventDefault={apply}>
    <div class="field">
      <label for="f-town"><MapPin size={16} aria-hidden="true" /> Town</label>
      <select id="f-town" bind:value={draft.location}>
        <option value="">Anywhere in Ghana</option>
        {#each CITIES as c}<option value={c}>{c}</option>{/each}
      </select>
    </div>
    <div class="field">
      <label for="f-qty"><Package size={16} aria-hidden="true" /> Minimum quantity</label>
      <input id="f-qty" type="number" inputmode="decimal" min="0" bind:value={draft.minQuantity} placeholder="e.g. 200" />
    </div>
    <div class="field">
      <label for="f-price"><Banknote size={16} aria-hidden="true" /> Highest price per unit (GHS)</label>
      <input id="f-price" type="number" inputmode="decimal" min="0" bind:value={draft.maxPrice} placeholder="e.g. 25" />
    </div>
    <label class="check" for="f-org"><input id="f-org" type="checkbox" bind:checked={draft.organic} /> <Sprout size={16} aria-hidden="true" /> Organic only</label>
  </form>
  <svelte:fragment slot="actions">
    <button type="button" class="btn btn-outline" on:click={clear}>Clear all</button>
    <button type="submit" form="filter-form" class="btn btn-primary">Show results</button>
  </svelte:fragment>
</Dialog>
