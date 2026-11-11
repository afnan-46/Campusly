import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { fmtDay } from '../../lib/format';

const WORDS = {
  new: ['warn', 'Received', 'We have your application and will start reviewing it soon.'],
  reviewing: ['warn', 'Being reviewed', 'Our team is checking your application and payment.'],
  approved: ['ok', 'Approved', 'Your institution is ready. Your admin received the sign-in details by phone or email.'],
  rejected: ['bad', 'Not approved', 'We could not approve this application.'],
};

export default function ApplyStatus() {
  const [sp] = useSearchParams();
  const [code, setCode] = useState(sp.get('code') || '');
  const [email, setEmail] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setRes(null);
    try { setRes(await api(`/public/apply/${encodeURIComponent(code.trim())}?email=${encodeURIComponent(email.trim())}`)); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }
  const w = res && WORDS[res.status];
  return (
    <div className="wrap"><div className="page-narrow" style={{ maxWidth: 520 }}>
      <h1>Check your application</h1>
      <p className="lead mt-xs">Enter the application number you received and the email you applied with.</p>
      <form className="fsec" onSubmit={submit} noValidate>
        <div className="field" style={{ marginTop: 0 }}><label htmlFor="as-code">Application number</label><input id="as-code" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="APP-1003" /></div>
        <div className="field"><label htmlFor="as-mail">Email</label><input id="as-mail" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu.bd" autoComplete="email" /></div>
        {err && <div className="alert" role="alert"><span>{err}</span></div>}
        <button className="btn mt" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Check status'}</button>
      </form>
      {res && (
        <div className="fsec" role="status">
          <span className={`dotline ${w[0]}`}>{w[1]}</span>
          <h2 style={{ marginTop: 8 }}>{res.institution}</h2>
          <p className="muted mt-xs">{w[2]}</p>
          {res.rejectReason && <p className="mt-s"><b>Reason:</b> {res.rejectReason}</p>}
          <p className="hint mt-s">Applied on {fmtDay(res.createdAt)}{res.decidedAt ? `. Decided on ${fmtDay(res.decidedAt)}` : ''}.</p>
          {res.status === 'approved' && <Link className="btn mt" to="/login">Go to sign in</Link>}
          {res.status === 'rejected' && <Link className="btn ghost mt" to="/apply">Apply again</Link>}
        </div>
      )}
    </div></div>
  );
}
