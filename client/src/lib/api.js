// Small fetch wrapper: adds the JWT, parses JSON, and turns errors into ApiError.
const TOKEN_KEY = 'campusly-token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
};

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
let onConnection = () => {};
export const setConnectionHandler = (fn) => { onConnection = fn; };

// Offline support. Every page the person opens is kept on this device (per account),
// so it can still be read with no internet. Reports written offline wait in the outbox.
const CACHE = 'campusly-cache:';
const OUTBOX = 'campusly-outbox';
let cacheOwner = null;
export const setCacheOwner = (id) => { cacheOwner = id; };
const cacheKey = (path) => `${CACHE}${cacheOwner}:${path}`;
export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(CACHE) || k === OUTBOX || k === 'campusly-me').forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
function cachePut(path, data) {
  if (!cacheOwner || path.startsWith('/auth/') || path.startsWith('/public/')) return;
  try { localStorage.setItem(cacheKey(path), JSON.stringify({ at: Date.now(), data })); } catch { /* storage full */ }
}
function cacheGet(path) {
  if (!cacheOwner) return null;
  try { return JSON.parse(localStorage.getItem(cacheKey(path))); } catch { return null; }
}

export const outbox = {
  list() { try { return JSON.parse(localStorage.getItem(OUTBOX)) || []; } catch { return []; } },
  save(items) { try { localStorage.setItem(OUTBOX, JSON.stringify(items)); } catch { /* ignore */ } },
  add(item) { const l = outbox.list(); l.push({ ...item, queuedAt: Date.now() }); outbox.save(l); },
  count() { return outbox.list().filter((i) => i.owner === cacheOwner).length; },
};
// Sends reports that were written offline. Returns how many went through.
export async function flushOutbox() {
  const items = outbox.list();
  const mine = items.filter((i) => i.owner === cacheOwner);
  let sent = 0;
  for (const it of mine) {
    try {
      await api('/reports', { method: 'POST', body: it.body });
      sent += 1;
      outbox.save(outbox.list().filter((x) => x.queuedAt !== it.queuedAt));
    } catch (e) {
      if (e.status === 0) break; // still offline
      outbox.save(outbox.list().filter((x) => x.queuedAt !== it.queuedAt)); // the server refused it: drop it
    }
  }
  return sent;
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    onConnection(false);
    if (method === 'GET') {
      const hit = cacheGet(path);
      if (hit) return hit.data;
    }
    throw new ApiError(0, method === 'GET'
      ? 'You are offline and this page was not saved on this device yet. Open it once with internet.'
      : 'You are offline. Check your connection and try again.');
  }
  onConnection(true);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data.message || 'Something went wrong.', data.fields);
  }
  if (method === 'GET') cachePut(path, data);
  return data;
}
