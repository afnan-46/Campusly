import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SignLayout from './SignLayout';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';

// Separate sign-in for the Campusly company: the owner and office staff.
export default function CompanyLogin() {
  const { login } = useApp();
  const loc = useLocation();
  const [email, setEmail] = useState(loc.state?.email || '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);
  useEffect(() => { api('/auth/demo-accounts?role=company').then(setDemo).catch(() => {}); }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const d = await api('/auth/company-login', { method: 'POST', body: { email, password: pw } });
      login(d.token, d.user);
    } catch (ex) { setErr(ex.message); setBusy(false); }
  }
  return (
    <SignLayout>
      <span className="company-tag">Campusly staff</span>
      <h1 style={{ marginTop: 12 }}>Company sign in</h1>
      <p className="sub">For the Campusly owner and office team. Institutions sign in <Link className="link" to="/login">here</Link> instead.</p>
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="c-mail">Work email</label><input id="c-mail" type="text" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" /></div>
        <div className="field"><label htmlFor="c-pw">Password</label><input id="c-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
        {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
        <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {demo && demo.enabled && demo.accounts.length > 0 && (
        <details className="demo-box"><summary>Try a demo account</summary>
          <div className="demo-group">
            {demo.accounts.map((a) => (
              <button type="button" className="demo-line" key={a.id} onClick={() => { setEmail(a.identifier); setPw(a.password); }}><b>{a.name}</b><span>{a.sub}</span></button>
            ))}
          </div>
        </details>
      )}
    </SignLayout>
  );
}
