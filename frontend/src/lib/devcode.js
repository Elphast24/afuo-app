import { writable } from 'svelte/store';

/*
  FALLBACK while no SMS provider is connected. The API returns the one-time code in the send-OTP response (devCode)
  and DevCodePopup shows it on screen with a disclaimer. When SMS is wired in, devCode stops coming and nothing shows.
*/
export const devCode = writable(null); // { code, phone } | null
