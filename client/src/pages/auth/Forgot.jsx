import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SignLayout from './SignLayout';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';

export function Forgot() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      setSent(await api('/auth/forgot', { method: 'POST', body: { email } }));
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SignLayout>
      <Link className="link back" to="/login"><Icon name="arrowl" size={16} />Back to sign in</Link>
      <h1>Reset your password</h1>
      <p className="sub">Enter the email on your account and we'll send you a link to set a new password. No email on your account? Ask your admin to set a new password.</p>
      {sent && (
        <div className="alert ok" role="status"><Icon name="check" size={18} />
          <span>{sent.message}{sent.resetLink && <> Demo mode is on, so here is the link: <Link className="link" to={new URL(sent.resetLink).pathname}>set a new password</Link>.</>}</span>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="f-mail">Email</label>
          <div className="input-wrap"><Icon name="mail" size={18} className="lead-ic" /><input id="f-mail" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.edu" /></div>
          {err && <span className="err">{err}</span>}</div>
        <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
    </SignLayout>
  );
}

export function Reset() {
  const { token } = useParams();
  const nav = useNavigate();
  const { toast } = useApp();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pw.length < 6) { setErr('Use at least 6 characters.'); return; }
    if (pw !== pw2) { setErr('The passwords do not match.'); return; }
    setBusy(true);
    setErr('');
    try {
      const d = await api('/auth/reset', { method: 'POST', body: { token, password: pw } });
      toast(d.message);
      nav('/login');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SignLayout>
      <Link className="link back" to="/login"><Icon name="arrowl" size={16} />Back to sign in</Link>
      <h1>Choose a new password</h1>
      <p className="sub">This link works once and expires after 30 minutes.</p>
      {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="r-pw">New password</label><input id="r-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" /></div>
        <div className="field"><label htmlFor="r-pw2">Confirm new password</label><input id="r-pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type it again" autoComplete="new-password" /></div>
        <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </SignLayout>
  );
}
