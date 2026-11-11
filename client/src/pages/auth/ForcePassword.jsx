import { useState } from 'react';
import SignLayout from './SignLayout';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';

// Shown after signing in with a temporary password: the person must choose their own first.
export default function ForcePassword() {
  const { user, setUser, logout, toast } = useApp();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (pw.length < 6) { setErr('Use at least 6 characters for your new password.'); return; }
    if (pw !== pw2) { setErr('The new passwords do not match.'); return; }
    setBusy(true); setErr('');
    try {
      const d = await api('/auth/password', { method: 'POST', body: { current: cur, password: pw } });
      setUser(d.user);
      toast('Password saved. Welcome to Campusly.');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }
  return (
    <SignLayout>
      <h1>Choose your own password</h1>
      <p className="sub">Hi {user.name.split(' ')[0]}. You signed in with a temporary password. Set a new one that only you know.</p>
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="fp-cur">Temporary password</label><input id="fp-cur" type="password" autoFocus value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="fp-new">New password</label><input id="fp-new" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" /></div>
        <div className="field"><label htmlFor="fp-new2">Confirm new password</label><input id="fp-new2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
        {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
        <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
      </form>
      <div className="sign-links"><button type="button" className="link" onClick={logout}>Sign out</button></div>
    </SignLayout>
  );
}
