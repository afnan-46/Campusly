import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SignLayout from './SignLayout';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { initials } from '../../lib/format';

// Sign in in two steps: who are you, then your password. We find the institution and role ourselves.
export default function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState('id'); // id | pick | pw
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [matches, setMatches] = useState([]);
  const [who, setWho] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);

  useEffect(() => { api('/auth/demo-accounts').then(setDemo).catch(() => {}); }, []);

  async function lookup(ident, keepPw) {
    setBusy(true); setErr('');
    try {
      const d = await api('/auth/lookup', { method: 'POST', body: { identifier: ident } });
      if (!d.matches.length && d.company) { nav('/company/login', { state: { email: ident } }); return; }
      setMatches(d.matches);
      if (!keepPw) setPw('');
      if (d.matches.length === 1) { setWho(d.matches[0]); setStep('pw'); } else setStep('pick');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  async function signIn(e) {
    e.preventDefault();
    if (!pw) { setErr('Enter your password.'); return; }
    setBusy(true); setErr('');
    try {
      const d = await api('/auth/login', { method: 'POST', body: { institutionId: who.institution.id, identifier: id.trim(), password: pw } });
      login(d.token, d.user);
    } catch (ex) { setErr(ex.message); setBusy(false); }
  }

  const back = () => { setStep('id'); setWho(null); setErr(''); setPw(''); };

  return (
    <SignLayout>
      {step === 'id' && (
        <form onSubmit={(e) => { e.preventDefault(); if (id.trim().length < 3) { setErr('Enter your email or student ID.'); return; } lookup(id.trim()); }} noValidate>
          <h1>Sign in</h1>
          <p className="sub">Use your email or student ID. We will find your institution.</p>
          <div className="field"><label htmlFor="l-id">Email or student ID</label>
            <input id="l-id" type="text" autoFocus value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. name@school.edu.bd or 2023-1-60-145" autoComplete="username" autoCapitalize="none" /></div>
          {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
          <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Looking…' : 'Continue'}</button>
        </form>
      )}

      {step === 'pick' && (
        <>
          <button type="button" className="link back" onClick={back}><Icon name="arrowl" size={16} />Change</button>
          <h1>Which institution?</h1>
          <p className="sub"><b>{id}</b> is used at more than one place. Choose where you want to sign in.</p>
          <div className="pick-list">
            {matches.map((m) => (
              <button type="button" key={m.institution.id} className="pick" onClick={() => { setWho(m); setStep('pw'); }}>
                <span className="avatar">{m.institution.shortName.slice(0, 3)}</span>
                <div><b>{m.institution.name}</b><small>{m.roleLabel}</small></div>
                <Icon name="arrowr" size={18} />
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'pw' && who && (
        <form onSubmit={signIn} noValidate>
          <button type="button" className="link back" onClick={back}><Icon name="arrowl" size={16} />Not you?</button>
          <h1>Welcome back</h1>
          <div className="whochip"><span className="avatar">{initials(who.institution.name)}</span>
            <div><b>{who.institution.name}</b><small>{who.roleLabel}, {id}</small></div></div>
          {who.status === 'pending' && <div className="alert warn" role="status"><Icon name="info" size={18} /><span>Your account is waiting for approval by the admin. You can sign in once it is approved.</span></div>}
          <div className="field"><div className="label-row"><label htmlFor="l-pw">Password</label><Link className="link small" to="/forgot">Forgot password?</Link></div>
            <div className="input-wrap">
              <input id="l-pw" type={show ? 'text' : 'password'} autoFocus className="has-toggle" style={{ paddingLeft: 16 }} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
              <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeoff' : 'eye'} size={18} /></button>
            </div></div>
          {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
          <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      )}

      {demo && demo.enabled && demo.groups && step === 'id' && (
        <details className="demo-box">
          <summary>Try a demo account</summary>
          {demo.groups.map((g) => (
            <div className="demo-group" key={g.institution.id}>
              <h4>{g.institution.name}</h4>
              {g.accounts.map((a) => (
                <button type="button" className="demo-line" key={a.id} onClick={() => { setId(a.identifier); setPw(a.password); lookup(a.identifier, true); }}>
                  <b>{a.roleLabel}: {a.name}</b><span>{a.identifier}</span>
                </button>
              ))}
            </div>
          ))}
          <p className="hint mt-s">Demo password for each is filled in for you.</p>
        </details>
      )}

      <div className="sign-links">
        <span>Got a class code from your teacher? <Link to="/join">Join your class</Link></span>
        <span>Own a school, college or university? <Link to="/apply">Apply for Campusly</Link></span>
        <span>Campusly team? <Link to="/company/login">Staff sign in</Link></span>
      </div>
    </SignLayout>
  );
}
