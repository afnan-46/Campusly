import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';

// A centred dialog. Closes on Escape or a click outside.
export default function Modal({ title, sub, onClose, children, footer, wide }) {
  const box = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    const first = box.current?.querySelector('input, select, textarea, button:not(.x-btn)');
    first?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); prev?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="m-title" ref={box}>
        <div className="modal-head">
          <div><h2 id="m-title">{title}</h2>{sub && <p className="hint mt-xs">{sub}</p>}</div>
          <button type="button" className="x-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Runs an async save, shows field errors and a toast. Returns [run, busy, errors, message].
export function useSave() {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState('');
  async function run(fn, ok) {
    setBusy(true);
    setErrs({});
    setMsg('');
    try {
      const d = await fn();
      if (ok) toast(typeof ok === 'function' ? ok(d) : ok);
      return d || true;
    } catch (e) {
      setErrs(e.fields || {});
      setMsg(Object.keys(e.fields || {}).length ? e.message : e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return [run, busy, errs, msg];
}

export const FieldErr = ({ errs, k }) => (errs[k] ? <span className="err">{errs[k]}</span> : null);
export const FormAlert = ({ msg }) => (msg ? <div className="alert" role="alert"><Icon name="info" size={18} /><span>{msg}</span></div> : null);

// Editable list of short text items (classes, places).
export function ListEditor({ items, onChange, placeholder, label }) {
  const [v, setV] = useState('');
  const add = () => {
    const x = v.trim();
    if (!x || items.some((i) => i.toLowerCase() === x.toLowerCase())) { setV(''); return; }
    onChange([...items, x]);
    setV('');
  };
  return (
    <div className="list-editor">
      <div className="le-items">
        {items.map((i) => (
          <span className="le-item" key={i}>{i}<button type="button" onClick={() => onChange(items.filter((x) => x !== i))} aria-label={`Remove ${i}`}><Icon name="x" size={13} /></button></span>
        ))}
        {!items.length && <span className="hint">Nothing added yet.</span>}
      </div>
      <div className="le-add">
        <input type="text" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={label}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn soft sm" onClick={add}><Icon name="plus" size={15} />Add</button>
      </div>
    </div>
  );
}

// Change your own password.
export function ChangePassword() {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [run, busy, , msg] = useSave();
  const [local, setLocal] = useState('');
  async function submit(e) {
    e.preventDefault();
    setLocal('');
    if (pw.length < 6) { setLocal('Use at least 6 characters for the new password.'); return; }
    if (pw !== pw2) { setLocal('The new passwords do not match.'); return; }
    const ok = await run(() => api('/auth/password', { method: 'POST', body: { current: cur, password: pw } }), 'Password changed.');
    if (ok) { setCur(''); setPw(''); setPw2(''); }
  }
  return (
    <form className="card card-pad" onSubmit={submit} noValidate>
      <h2><Icon name="key" size={18} /> Change my password</h2>
      <div className="form-grid three">
        <div className="field"><label htmlFor="cp-cur">Current password</label><input id="cp-cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="cp-new">New password</label><input id="cp-new" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" /></div>
        <div className="field"><label htmlFor="cp-new2">Confirm new password</label><input id="cp-new2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
      </div>
      <FormAlert msg={local || msg} />
      <button className="btn mt" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
