<script>
  import { createEventDispatcher } from 'svelte';
  import { Leaf, Package, Scale, Banknote, MapPin, Calendar, Sprout, FileText, Wheat, LoaderCircle } from 'lucide-svelte';
  import ImageUploader from './ImageUploader.svelte';
  import { api } from '../../lib/api.js';
  import { showToast } from '../../lib/toast.js';
  import { PRODUCE, CATEGORIES, UNITS, CITIES, categoryOf, today } from '../../lib/format.js';

  /** The listing being edited (from the API), or null to create one */
  export let listing = null;

  const dispatch = createEventDispatcher();
  const OTHER = '__other';

  const knownProduce = listing && Object.values(PRODUCE).flat().includes(listing.produceType);

  let produceChoice = listing ? (knownProduce ? listing.produceType : OTHER) : '';
  let customProduce = listing && !knownProduce ? listing.produceType : '';
  let customCategory = listing && !knownProduce ? listing.category : 'OTHER';
  let quantity = listing ? String(listing.quantity) : '';
  let unit = listing?.unit ?? 'KG';
  let price = listing ? String(listing.pricePerUnit) : '';
  let location = listing?.location ?? '';
  let availFrom = listing?.availableFrom ?? today();
  let availTo = listing?.availableTo ?? today(30);
  let organic = listing?.isOrganic ?? false;
  let description = listing?.description ?? '';

  let existing = listing?.images ?? [];
  let queued = [];

  let errors = {};
  let saving = false;

  // A town saved with explicit coordinates may not be in the picker
  $: towns = location && !CITIES.includes(location) ? [location, ...CITIES] : CITIES;

  function validate() {
    const e = {};
    const produce = produceChoice === OTHER ? customProduce.trim() : produceChoice;
    if (!produce || produce.length < 2) e.produceType = 'Choose or enter the produce.';
    if (!(Number(quantity) > 0)) e.quantity = 'Enter a quantity above 0.';
    if (!(Number(price) > 0)) e.pricePerUnit = 'Enter a price above 0.';
    if (!location) e.location = 'Choose where the produce is.';
    if (!availFrom) e.availableFrom = 'Choose the first day it is available.';
    if (!availTo) e.availableTo = 'Choose the last day it is available.';
    else if (availFrom && availTo < availFrom) e.availableTo = 'This must be on or after the start date.';
    return e;
  }

  const clearError = (field) => {
    if (errors[field]) errors = { ...errors, [field]: undefined };
  };

  async function removeExisting(e) {
    try {
      await api.listings.removeImage(listing.id, e.detail.id);
      existing = existing.filter((i) => i.id !== e.detail.id);
      if (e.detail.isPrimary && existing.length) existing = existing.map((i, idx) => ({ ...i, isPrimary: idx === 0 }));
      showToast('Photo removed.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function submit() {
    errors = validate();
    if (Object.values(errors).some(Boolean)) {
      document.querySelector('.field.invalid input, .field.invalid select')?.focus();
      return;
    }

    const produce = produceChoice === OTHER ? customProduce.trim() : produceChoice;
    const body = {
      produceType: produce,
      category: produceChoice === OTHER ? customCategory : categoryOf(produce),
      quantity: Number(quantity),
      unit,
      pricePerUnit: Number(price),
      availableFrom: availFrom,
      availableTo: availTo,
      isOrganic: organic
    };
    // Only send the town when it changed, so a listing saved with custom coordinates keeps them
    if (!listing || location !== listing.location) body.location = location;
    if (description.trim()) body.description = description.trim();
    else if (listing) body.description = null;

    saving = true;
    let id = listing?.id;
    try {
      if (listing) {
        await api.listings.update(listing.id, body);
      } else {
        const { listing: created } = await api.listings.create(body);
        id = created.id;
      }
    } catch (err) {
      errors = { ...err.fieldErrors };
      if (!Object.keys(errors).length) showToast(err.message, 'error');
      saving = false;
      return;
    }

    if (queued.length) {
      try {
        await api.listings.uploadImages(id, queued.map((q) => q.file));
      } catch (err) {
        showToast(`Listing saved, but the photos did not upload: ${err.message}`, 'error');
        saving = false;
        dispatch('saved', { id, photosFailed: true });
        return;
      }
    }

    saving = false;
    showToast(listing ? 'Listing updated.' : 'Listing published.', 'success');
    dispatch('saved', { id });
  }
</script>

<form on:submit|preventDefault={submit} novalidate>
  <div class="form-grid">
    <div class="field" class:invalid={errors.produceType}>
      <label for="produce"><Leaf size={16} aria-hidden="true" /> Produce <span class="req" aria-hidden="true">*</span></label>
      <select id="produce" bind:value={produceChoice} on:change={() => clearError('produceType')} aria-invalid={errors.produceType ? 'true' : undefined} aria-describedby={errors.produceType ? 'produce-err' : undefined}>
        <option value="">Select produce</option>
        {#each Object.entries(PRODUCE) as [cat, list]}
          <optgroup label={CATEGORIES[cat]}>{#each list as p}<option value={p}>{p}</option>{/each}</optgroup>
        {/each}
        <option value={OTHER}>Other (type it in)</option>
      </select>
      {#if errors.produceType}<span class="field-error" id="produce-err">{errors.produceType}</span>{/if}
    </div>

    {#if produceChoice === OTHER}
      <div class="field" class:invalid={errors.produceType}>
        <label for="custom">Produce name <span class="req" aria-hidden="true">*</span></label>
        <input id="custom" type="text" bind:value={customProduce} placeholder="e.g. Shea nuts" on:input={() => clearError('produceType')} />
      </div>
      <div class="field">
        <label for="cat">Category</label>
        <select id="cat" bind:value={customCategory}>
          {#each Object.entries(CATEGORIES) as [k, v]}<option value={k}>{v}</option>{/each}
        </select>
      </div>
    {/if}

    <div class="field" class:invalid={errors.quantity}>
      <label for="qty"><Package size={16} aria-hidden="true" /> Quantity available <span class="req" aria-hidden="true">*</span></label>
      <input id="qty" type="number" inputmode="decimal" min="1" step="any" bind:value={quantity} placeholder="e.g. 500" on:input={() => clearError('quantity')} aria-invalid={errors.quantity ? 'true' : undefined} aria-describedby={errors.quantity ? 'qty-err' : undefined} />
      {#if errors.quantity}<span class="field-error" id="qty-err">{errors.quantity}</span>{/if}
    </div>

    <div class="field">
      <label for="unit"><Scale size={16} aria-hidden="true" /> Unit</label>
      <select id="unit" bind:value={unit}>
        {#each Object.entries(UNITS) as [k, u]}<option value={k}>{u.label}</option>{/each}
      </select>
    </div>

    <div class="field" class:invalid={errors.pricePerUnit}>
      <label for="price"><Banknote size={16} aria-hidden="true" /> Price per unit (GHS) <span class="req" aria-hidden="true">*</span></label>
      <input id="price" type="number" inputmode="decimal" min="0.01" step="0.01" bind:value={price} placeholder="e.g. 22" on:input={() => clearError('pricePerUnit')} aria-invalid={errors.pricePerUnit ? 'true' : undefined} aria-describedby={errors.pricePerUnit ? 'price-err' : undefined} />
      {#if errors.pricePerUnit}<span class="field-error" id="price-err">{errors.pricePerUnit}</span>{/if}
    </div>

    <div class="field" class:invalid={errors.location}>
      <label for="loc"><MapPin size={16} aria-hidden="true" /> Town <span class="req" aria-hidden="true">*</span></label>
      <select id="loc" bind:value={location} on:change={() => clearError('location')} aria-invalid={errors.location ? 'true' : undefined} aria-describedby={errors.location ? 'loc-err' : undefined}>
        <option value="">Select a town</option>
        {#each towns as c}<option value={c}>{c}</option>{/each}
      </select>
      {#if errors.location}<span class="field-error" id="loc-err">{errors.location}</span>{/if}
    </div>

    <div class="field" class:invalid={errors.availableFrom}>
      <label for="from"><Calendar size={16} aria-hidden="true" /> Available from <span class="req" aria-hidden="true">*</span></label>
      <input id="from" type="date" bind:value={availFrom} on:input={() => clearError('availableFrom')} aria-invalid={errors.availableFrom ? 'true' : undefined} aria-describedby={errors.availableFrom ? 'from-err' : undefined} />
      {#if errors.availableFrom}<span class="field-error" id="from-err">{errors.availableFrom}</span>{/if}
    </div>

    <div class="field" class:invalid={errors.availableTo}>
      <label for="to"><Calendar size={16} aria-hidden="true" /> Available to <span class="req" aria-hidden="true">*</span></label>
      <input id="to" type="date" bind:value={availTo} on:input={() => clearError('availableTo')} aria-invalid={errors.availableTo ? 'true' : undefined} aria-describedby={errors.availableTo ? 'to-err' : undefined} />
      {#if errors.availableTo}<span class="field-error" id="to-err">{errors.availableTo}</span>{/if}
    </div>

    <div class="field">
      <label class="check" for="organic">
        <input id="organic" type="checkbox" bind:checked={organic} />
        <Sprout size={16} aria-hidden="true" /> Organic produce
      </label>
    </div>

    <div class="field full-width">
      <label for="desc"><FileText size={16} aria-hidden="true" /> Description <span class="muted">(optional)</span></label>
      <textarea id="desc" bind:value={description} maxlength="2000" placeholder="Quality, variety, packaging, how you can deliver..."></textarea>
    </div>

    <div class="field full-width">
      <ImageUploader {existing} bind:queued disabled={saving} on:removeExisting={removeExisting} />
    </div>
  </div>

  <div class="actions">
    <button type="submit" class="btn btn-primary" disabled={saving}>
      {#if saving}
        <span class="spin"><LoaderCircle size={16} aria-hidden="true" /></span> Saving...
      {:else}
        <Wheat size={16} aria-hidden="true" /> {listing ? 'Save changes' : 'Publish listing'}
      {/if}
    </button>
    <button type="button" class="btn btn-outline" on:click={() => dispatch('cancel')} disabled={saving}>Cancel</button>
  </div>
</form>

<style>
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-6); }
  .spin { display: inline-flex; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
