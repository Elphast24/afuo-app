import { writable } from 'svelte/store';

/*
  TESTING AID. When the API runs with EXPOSE_OTP=true it returns the one-time code in the send-OTP response,
  and we show it in a pop-up (there is no SMS provider yet). Normal API responses have no devCode, so nothing shows.
*/
export const devCode = writable(null); // { code, phone } | null
