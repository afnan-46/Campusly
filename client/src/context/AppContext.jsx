import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler, setConnectionHandler, setCacheOwner, clearCache, flushOutbox, outbox } from '../lib/api';
import { termsFor } from '../lib/terms';

const INST_KEY = 'campusly-inst';
const readInst = () => {
  try { return JSON.parse(localStorage.getItem(INST_KEY)) || null; } catch { return null; }
};

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const POLL_MS = 15000;

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [meta, setMeta] = useState(null);
  // The institution picked on the sign-in screen (remembered for next time).
  const [inst, setInstState] = useState(readInst);
  const [toastMsg, setToastMsg] = useState(null);
  const [notifs, setNotifs] = useState({ unread: 0, notifications: [] });
  // Bumped whenever new notifications arrive, so open pages refetch their data.
  const [liveTick, setLiveTick] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [queued, setQueued] = useState(0);
  const toastTimer = useRef();
  const lastUnread = useRef(0);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3800);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    clearCache();
    setCacheOwner(null);
    setUser(null);
    setNotifs({ unread: 0, notifications: [] });
  }, []);

  const login = useCallback((token, u) => {
    setToken(token);
    setCacheOwner(u.id);
    setUser(u);
    try { localStorage.setItem('campusly-me', JSON.stringify(u)); } catch { /* ignore */ }
  }, []);

  const setInst = useCallback((i) => {
    try { if (i) localStorage.setItem(INST_KEY, JSON.stringify(i)); else localStorage.removeItem(INST_KEY); } catch { /* ignore */ }
    setInstState(i);
  }, []);

  // Offline mode: remember what the person opened, show a banner, and send waiting reports later.
  useEffect(() => {
    setConnectionHandler((ok) => setOnline(ok));
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  useEffect(() => { setCacheOwner(user ? user.id : null); setQueued(user ? outbox.count() : 0); }, [user]);
  useEffect(() => {
    if (!user || !online) return;
    if (!outbox.count()) return;
    flushOutbox().then((n) => {
      setQueued(outbox.count());
      if (n) { toast(n === 1 ? 'Your saved report was sent.' : `${n} saved reports were sent.`); setLiveTick((t) => t + 1); }
    });
  }, [user, online, toast]);

  // Signed-in users always work inside their own institution.
  const activeInst = user ? user.institution || null : inst;
  const instId = activeInst ? activeInst.id : null;

  // Restore the session and load lookup data on first load.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast('Your session ended. Please sign in again.');
    });
    if (!getToken()) { setBooting(false); return; }
    api('/auth/me')
      .then((d) => {
        setCacheOwner(d.user.id);
        setUser(d.user);
        try { localStorage.setItem('campusly-me', JSON.stringify(d.user)); } catch { /* ignore */ }
      })
      .catch((e) => {
        // Opened with no internet: stay signed in using the saved profile.
        let me = null;
        try { me = JSON.parse(localStorage.getItem('campusly-me')); } catch { /* ignore */ }
        if (e.status === 0 && me) { setCacheOwner(me.id); setUser(me); } else setToken(null);
      })
      .finally(() => setBooting(false));
  }, [logout, toast]);

  // Lookup data (report types, offices, classes, teachers) for the active institution.
  const refreshMeta = useCallback(() => {
    if (!instId) { setMeta(null); return Promise.resolve(); }
    return api(`/meta?institution=${instId}`).then(setMeta).catch(() => {});
  }, [instId]);
  useEffect(() => {
    // Retry while the API is still starting up (npm run dev opens the page first).
    let live = true;
    let timer;
    setMeta(null);
    if (!instId) return undefined;
    const load = (n) => api(`/meta?institution=${instId}`)
      .then((d) => { if (live) setMeta(d); })
      .catch(() => { if (live && n < 20) timer = setTimeout(() => load(n + 1), 1500); });
    load(0);
    return () => { live = false; clearTimeout(timer); };
  }, [instId]);

  // Keep the remembered institution in step with the signed-in user's.
  useEffect(() => { if (user && user.institution) setInst(user.institution); }, [user, setInst]);

  const loadNotifs = useCallback(async () => {
    if (!getToken()) return;
    try {
      const d = await api('/notifications');
      setNotifs(d);
      if (d.unread > lastUnread.current) setLiveTick((t) => t + 1);
      lastUnread.current = d.unread;
    } catch { /* offline: try again on the next poll */ }
  }, []);

  // Poll for notifications while signed in.
  useEffect(() => {
    if (!user) return undefined;
    lastUnread.current = 0;
    loadNotifs();
    const id = setInterval(() => { if (!document.hidden) loadNotifs(); }, POLL_MS);
    return () => clearInterval(id);
  }, [user, loadNotifs]);

  const markAllRead = useCallback(async () => {
    setNotifs((n) => ({ ...n, unread: 0 }));
    lastUnread.current = 0;
    try { await api('/notifications/read-all', { method: 'POST' }); } catch { /* ignore */ }
  }, []);

  const value = {
    user, setUser, booting, meta, refreshMeta, login, logout, toast, toastMsg,
    inst: activeInst, setInst, terms: termsFor(activeInst && activeInst.type),
    notifs, loadNotifs, markAllRead, liveTick, online, queued, setQueued,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
