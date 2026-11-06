/*
  API client for the AgriMatch API (apps/api).

  - Auth lives in httpOnly cookies set by the API, so no token ever touches JavaScript.
  - On a 401 the client calls POST /auth/refresh once (shared by concurrent requests) and retries.
    If that fails, the unauthorized handler runs (auth.js clears the session and the route guard sends you to /login).
  - Errors are ApiError with a stable `code` (e.g. OTP_INVALID, VALIDATION_ERROR) and the server's message.
*/

// Same-origin by default (Vite proxies /v1 in dev). Set VITE_API_URL=https://api.example.com/v1 for a separate API host.
const API_URL = (import.meta.env.VITE_API_URL || '/v1').replace(/\/$/, '');
const API_ORIGIN = API_URL.startsWith('http') ? new URL(API_URL).origin : '';

export class ApiError extends Error {
  constructor(code, message, status = 0, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** { fieldName: message } from a VALIDATION_ERROR, for showing errors beside inputs */
  get fieldErrors() {
    const out = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details) if (d.field && !out[d.field]) out[d.field] = d.message;
    }
    return out;
  }
}

/** Turn an API-relative asset path (/uploads/...) into a loadable URL */
export const assetUrl = (path) => (path ? (path.startsWith('http') ? path : `${API_ORIGIN}${path}`) : null);

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

let refreshing = null;
function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export const refresh = refreshSession;

async function request(path, { method = 'GET', body, query, form, retry = true } = {}) {
  let url = `${API_URL}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const init = { method, credentials: 'include', headers: {} };
  if (form) {
    init.body = form; // the browser sets the multipart boundary
  } else if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  const isAuthRoute = path.startsWith('/auth/');
  if (res.status === 401 && retry && !isAuthRoute) {
    if (await refreshSession()) return request(path, { method, body, query, form, retry: false });
    onUnauthorized();
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok || json?.success === false) {
    const err = json?.error;
    throw new ApiError(
      err?.code || (res.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'REQUEST_FAILED'),
      err?.message || `Request failed (${res.status})`,
      res.status,
      err?.details
    );
  }
  return json?.data ?? json;
}

const get = (path, query) => request(path, { query });
const post = (path, body) => request(path, { method: 'POST', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const del = (path) => request(path, { method: 'DELETE' });

export const api = {
  auth: {
    sendOtp: (phone) => post('/auth/otp/send', { phone }),
    verifyOtp: (phone, code) => post('/auth/otp/verify', { phone, code }),
    me: () => get('/auth/me'),
    updateMe: (changes) => patch('/auth/me', changes),
    logout: () => post('/auth/logout', {})
  },
  listings: {
    list: (query) => get('/listings', query),
    mine: () => get('/listings/my'),
    get: (id) => get(`/listings/${id}`),
    create: (body) => post('/listings', body),
    update: (id, body) => patch(`/listings/${id}`, body),
    remove: (id) => del(`/listings/${id}`),
    uploadImages: (id, files) => {
      const form = new FormData();
      for (const f of files) form.append('images', f);
      return request(`/listings/${id}/images`, { method: 'POST', form });
    },
    removeImage: (id, imageId) => del(`/listings/${id}/images/${imageId}`)
  },
  match: (query) => post('/match', query),
  admin: {
    login: (username, password) => post('/admin/auth/login', { username, password }),
    stats: () => get('/admin/stats'),
    users: (query) => get('/admin/users', query),
    updateUser: (id, changes) => patch(`/admin/users/${id}`, changes),
    listings: (query) => get('/admin/listings', query),
    setListingStatus: (id, status) => patch(`/admin/listings/${id}`, { status }),
    deleteListing: (id) => del(`/admin/listings/${id}`),
    changePassword: (currentPassword, newPassword) => post('/admin/password', { currentPassword, newPassword })
  },
  analytics: {
    summary: () => get('/analytics/summary'),
    prices: () => get('/analytics/prices'),
    priceHistory: (produce, months = 6) => get(`/analytics/prices/${encodeURIComponent(produce)}`, { months }),
    locations: () => get('/analytics/locations'),
    insights: () => get('/analytics/insights')
  },
  conversations: {
    list: () => get('/conversations'),
    start: (listingId, message) => post('/conversations', { listingId, message: message || undefined }),
    messages: (id, query) => get(`/conversations/${id}/messages`, query),
    send: (id, content) => post(`/conversations/${id}/messages`, { content }),
    markRead: (id) => patch(`/conversations/${id}/read`)
  },
  reviews: {
    create: (body) => post('/reviews', body),
    forUser: (userId) => get(`/reviews/users/${userId}`)
  }
};
