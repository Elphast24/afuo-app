/*
  Saved ("favourite") listings, kept on this device in localStorage.
  A small snapshot is stored so the saved view works offline and without extra requests; it can go stale,
  so cards always link to the live listing page.
*/
import { writable, get } from 'svelte/store';

const KEY = 'agrimatch.saved';

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** [{ id, produceType, category, quantity, unit, pricePerUnit, currency, location, isOrganic, farmerName, imageUrl, createdAt }] */
export const saved = writable(load());

saved.subscribe((list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: favourites just will not persist */
  }
});

export const isSaved = (id) => get(saved).some((s) => s.id === id);

export function toggleSaved(listing) {
  saved.update((list) =>
    list.some((s) => s.id === listing.id)
      ? list.filter((s) => s.id !== listing.id)
      : [
          {
            id: listing.id,
            produceType: listing.produceType,
            category: listing.category,
            quantity: listing.quantity,
            unit: listing.unit,
            pricePerUnit: listing.pricePerUnit,
            currency: listing.currency,
            location: listing.location,
            isOrganic: listing.isOrganic,
            farmerName: listing.farmer?.name ?? null,
            imageUrl: listing.imageUrl ?? listing.images?.[0]?.url ?? null,
            createdAt: listing.createdAt
          },
          ...list
        ]
  );
}

export function clearSaved() {
  saved.set([]);
}
