import { writable } from 'svelte/store';

export const toasts = writable([]);

let nextId = 0;

/** Show a transient message. type: 'success' | 'error' | 'info' */
export function showToast(message, type = 'success') {
  const toast = { id: ++nextId, message, type };
  toasts.update((list) => [...list, toast]);
  setTimeout(() => toasts.update((list) => list.filter((t) => t.id !== toast.id)), 3500);
}
