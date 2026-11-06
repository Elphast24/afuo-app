/* Listings the user has opened in the side panel, kept on this device (drives the "Viewed" badge) */
import { writable } from 'svelte/store';

const KEY = 'agrimatch.viewed';
const MAX = 200;

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export const viewed = writable(load());

viewed.subscribe((list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the badge just will not persist */
  }
});

export const markViewed = (id) => viewed.update((list) => (list.includes(id) ? list : [id, ...list].slice(0, MAX)));
