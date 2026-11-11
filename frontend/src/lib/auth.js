/*
  Auth state, backed by the AgriMatch API (phone + OTP, httpOnly cookies).
  `session` is the signed-in user's profile or null; `authReady` flips to true once the first /auth/me check is done.
*/
import { devCode } from './devcode.js';
import { writable, get } from 'svelte/store';
import { api, setUnauthorizedHandler } from './api.js';

export const session = writable(null);
export const authReady = writable(false);

/** E.164 phone awaiting OTP verification (in memory only) */
export const pendingPhone = writable(null);

/** Where to go after signing in (set by the route guard) */
export const nextPath = writable('/dashboard');

/**
 * Accepts what people actually type: 0241234567, 241 234 567, +233241234567, 233241234567.
 * Returns only the 9 national digits (no leading 0 / country code), capped at 9.
 */
export function toNationalDigits(input) {
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('233')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}

// Ghana mobile numbers: 9 digits after the country code, starting 2 (e.g. 24, 20, 26) or 5 (e.g. 54, 55, 59)
export const isValidNational = (digits) => /^[25]\d{8}$/.test(digits);
export const toE164 = (digits) => `+233${digits}`;

/** 241234567 -> "241 234 567" */
export const formatNational = (digits) => digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();

/** Check for an existing session (cookie) when the app starts */
export async function initSession() {
  try {
    const { user } = await api.auth.me();
    session.set(user);
  } catch {
    session.set(null);
  }
  authReady.set(true);
}

export async function sendOtp(phone) {
  const data = await api.auth.sendOtp(phone);
  if (data?.devCode) devCode.set({ code: data.devCode, phone });
  return data;
}

/** Verify the code; on success the API sets the cookies and we load the full profile */
export async function verifyOtp(phone, code) {
  const { user: basic } = await api.auth.verifyOtp(phone, code);
  pendingPhone.set(null);
  devCode.set(null);
  try {
    const { user } = await api.auth.me();
    session.set(user);
    return { user, isNewUser: basic.isNewUser };
  } catch {
    session.set({ ...basic });
    return { user: basic, isNewUser: basic.isNewUser };
  }
}

/** Admin dashboard sign-in: username + password (not a phone OTP) */
export async function adminLogin(username, password) {
  await api.admin.login(username, password);
  const { user } = await api.auth.me();
  session.set(user);
  return user;
}

export async function updateProfile(changes) {
  const { user } = await api.auth.updateMe(changes);
  session.set(user);
  return user;
}

export async function signOut() {
  try {
    await api.auth.logout();
  } catch {
    /* clear locally even if the server is unreachable */
  }
  session.set(null);
}

// A request failed even after a refresh attempt: the session is over
setUnauthorizedHandler(() => {
  if (get(session)) session.set(null);
});
