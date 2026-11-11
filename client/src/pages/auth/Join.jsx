import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SignLayout from './SignLayout';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';

// Students join with a class code (instant) or ask their institution to approve them.
export default function Join() {
  const { code: urlCode } = useParams();
  const { login, toast } = useApp();
  const [code, setCode] = useState(urlCode || '');
  const [info, setInfo] = useState(null);       // from a valid code
  const [noCode, setNoCode] = useState(false);
  const [insts, setInsts] = useState(null);
  const [q, setQ] = useState('');
  const [inst, setInst] = useState(null);       // chosen when there is no code
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState({ name: '', sid: '', email: '', dept: '', advisorId: '', password: '', password2: '' });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function checkCode(c) {
    setBusy(true); setErr('');
    try { setInfo(await api(`/auth/join/${encodeURIComponent(c.trim())}`)); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }
  useEffect(() => { if (urlCode) checkCode(urlCode); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (noCode && !insts) api('/meta/institutions').then((d) => setInsts(d.institutions)).catch((e) => setErr(e.message)); }, [noCode, insts]);
  useEffect(() => {
    if (!inst) return;
    api(`/meta?institution=${inst.id}`).then((m) => { setMeta(m); setF((x) => ({ ...x, dept: m.programs[0] || '', advisorId: m.advisors[0]?.id || '' })); }).catch((e) => setErr(e.message));
  }, [inst]);
  const shown = useMemo(() => (insts || []).filter((i) => `${i.name} ${i.shortName} ${i.city}`.toLowerCase().includes(q.trim().toLowerCase())), [insts, q]);
  const t = (info && info.terms) || (meta && meta.terms) || { sid: 'Student ID', group: 'Class', advisorLong: 'Class teacher', sidExample: '', advisor: 'Class teacher' };
  const er = (k) => errs[k] && <span className="err">{errs[k]}</span>;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setErrs({});
    try {
      const body = info ? { joinCode: info.code, name: f.name, sid: f.sid, email: f.email, password: f.password, password2: f.password2 }
        : { institutionId: inst.id, name: f.name, sid: f.sid, email: f.email, dept: f.dept, advisorId: f.advisorId, password: f.password, password2: f.password2 };
      const d = await api('/auth/register', { method: 'POST', body });
      if (d.pending) setWaiting(d);
      else { login(d.token, d.user); toast(`Welcome to Campusly at ${info.institution.name}.`); }
    } catch (ex) {
      setErrs(ex.fields || {});
      if (!Object.keys(ex.fields || {}).length) setErr(ex.message);
      const first = Object.keys(ex.fields || {})[0];
      if (first) document.getElementById(`j-${first}`)?.focus();
    } finally { setBusy(false); }
  }

  if (waiting) {
    return (
      <SignLayout>
        <div className="done" style={{ padding: 0 }} role="status">
          <span className="tick"><Icon name="check" size={30} /></span>
          <h1>Request sent</h1>
          <p className="sub">{waiting.message}</p>
          <Link className="btn mt" to="/login">Back to sign in</Link>
        </div>
      </SignLayout>
    );
  }

  const form = (info || inst) && (
    <form onSubmit={submit} noValidate>
      <div className="whochip"><span className="avatar">{(info ? info.institution : inst).shortName.slice(0, 3)}</span>
        <div><b>{(info ? info.institution : inst).name}</b>
          <small>{info ? `${info.group}${info.advisor ? `, ${info.advisor}` : ''}` : 'Your admin will approve your request'}</small></div></div>
      <div className="field"><label htmlFor="j-name">Full name</label><input id="j-name" type="text" value={f.name} onChange={set('name')} autoComplete="name" placeholder="First and last name" />{er('name')}</div>
      <div className="two">
        <div className="field"><label htmlFor="j-sid">{t.sid}</label><input id="j-sid" type="text" value={f.sid} onChange={set('sid')} placeholder={t.sidExample ? `e.g. ${t.sidExample}` : ''} />{er('sid')}</div>
        <div className="field"><label htmlFor="j-email">Email <span className="muted">(optional)</span></label><input id="j-email" type="text" value={f.email} onChange={set('email')} autoComplete="email" />{er('email')}</div>
      </div>
      {!info && meta && (
        <div className="two">
          <div className="field"><label htmlFor="j-dept">{t.group}</label><select id="j-dept" value={f.dept} onChange={set('dept')}>{meta.programs.map((p) => <option key={p}>{p}</option>)}</select>{er('dept')}</div>
          <div className="field"><label htmlFor="j-advisor">{t.advisorLong}</label><select id="j-advisor" value={f.advisorId} onChange={set('advisorId')}>{!meta.advisors.length && <option value="">None added yet</option>}{meta.advisors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{er('advisor')}</div>
        </div>
      )}
      <div className="two">
        <div className="field"><label htmlFor="j-pw">Password</label><input id="j-pw" type="password" value={f.password} onChange={set('password')} placeholder="At least 6 characters" autoComplete="new-password" />{er('pw')}</div>
        <div className="field"><label htmlFor="j-pw2">Confirm password</label><input id="j-pw2" type="password" value={f.password2} onChange={set('password2')} autoComplete="new-password" />{er('pw2')}</div>
      </div>
      {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
      <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Please wait…' : info ? 'Join now' : 'Send request'}</button>
    </form>
  );

  return (
    <SignLayout wide={!!(info || inst)}>
      <Link className="link back" to="/login"><Icon name="arrowl" size={16} />Sign in</Link>
      {!info && !noCode && (
        <>
          <h1>Join your class</h1>
          <p className="sub">Enter the code your teacher or admin gave you.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) checkCode(code); }} noValidate>
            <div className="field"><label htmlFor="j-code">Class code</label><input id="j-code" type="text" autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. CSE26A" autoCapitalize="characters" style={{ letterSpacing: '.12em', fontWeight: 700 }} /></div>
            {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
            <button className="btn lg mt" type="submit" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
          </form>
          <div className="sign-links"><span>No code? <button type="button" className="link" onClick={() => { setNoCode(true); setErr(''); }}>Ask your institution to approve you</button></span></div>
        </>
      )}
      {info && (<><h1>Create your account</h1><p className="sub">Your code works. Fill in your details to join.</p>{form}</>)}
      {!info && noCode && !inst && (
        <>
          <h1>Find your institution</h1>
          <p className="sub">Your admin will approve your request before you can sign in.</p>
          <div className="field"><label htmlFor="j-q" className="sr-only">Search</label><input id="j-q" type="text" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or city" /></div>
          {err && <div className="alert" role="alert"><span>{err}</span></div>}
          {!insts && !err && <div className="loading"><span className="spinner" />Loading…</div>}
          <div className="pick-list">
            {shown.map((i) => (
              <button type="button" key={i.id} className="pick" onClick={() => setInst(i)}><span className="avatar">{i.shortName.slice(0, 3)}</span><div><b>{i.name}</b><small>{i.city}</small></div><Icon name="arrowr" size={18} /></button>
            ))}
            {insts && !shown.length && <p className="hint">No institution found. Ask your admin whether they use Campusly.</p>}
          </div>
          <div className="sign-links"><button type="button" className="link" onClick={() => setNoCode(false)}>I have a class code</button></div>
        </>
      )}
      {!info && inst && (<><h1>Request to join</h1><p className="sub">Fill in your details. The admin will approve you.</p>{form}</>)}
    </SignLayout>
  );
}
