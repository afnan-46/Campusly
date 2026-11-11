import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useApp } from '../context/AppContext';

// Loads one or more API paths. Refetches when `deps` change or new notifications arrive.
// paths: a string, or an object like { appts: '/appointments', reports: '/reports/mine' }
export function useApi(paths, deps = []) {
  const { liveTick } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(paths);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      let out;
      if (typeof paths === 'string') out = await api(paths);
      else {
        const entries = Object.entries(paths).filter(([, p]) => p);
        const results = await Promise.all(entries.map(([, p]) => api(p)));
        out = Object.fromEntries(entries.map(([k], i) => [k, results[i]]));
      }
      if (mine === seq.current) { setData(out); setError(null); }
    } catch (e) {
      if (mine === seq.current) setError(e);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { setLoading(true); load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (liveTick) load(); }, [liveTick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, error, loading, reload: load, setData };
}
