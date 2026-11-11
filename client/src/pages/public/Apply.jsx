import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { Async } from '../../components/ui';
import { taka } from '../../lib/format';
import { TYPES } from '../../lib/terms';

function Form({ plans }) {
  const [sp] = useSearchParams();
  const [f, setF] = useState({
    type: '', name: '', shortName: '', city: '', address: '', contactName: '', designation: '', email: '', phone: '', students: '',
    plan: sp.get('plan') || 'standard', cycle: sp.get('cycle') || 'monthly', mode: 'trial', method: 'bkash', trxId: '', payerNumber: '', message: '',
  });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const plan = plans.plans.find((p) => p.key === f.plan);
  const price = plan && plan.prices[f.cycle];
  const trial = f.mode === 'trial';
  const er = (k) => errs[k] && <span className="err">{errs[k]}</span>;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setErrs({});
    try {
      const body = { ...f, students: Number(f.students), trial };
      if (trial) { body.method = 'trial'; delete body.trxId; delete body.payerNumber; }
      setDone(await api('/public/apply', { method: 'POST', body }));
      window.scrollTo(0, 0);
    } catch (ex) {
      setErrs(ex.fields || {});
      setErr(ex.message);
      const first = Object.keys(ex.fields || {})[0];
      if (first) document.getElementById(`ap-${first}`)?.focus();
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="fsec done" role="status">
        <span className="tick"><Icon name="check" size={30} /></span>
        <h2>Application sent</h2>
        <p className="muted">Keep this number. We will contact you on <b>{f.email}</b> or <b>{f.phone}</b>.</p>
        <p className="bigcode">{done.code}</p>
        <p className="hint">Usually reviewed within one working day.</p>
        <div className="hero-actions-pub" style={{ justifyContent: 'center' }}>
          <Link className="btn" to={`/apply/status?code=${done.code}`}>Check status</Link>
          <Link className="btn ghost" to="/">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <section className="fsec">
        <h2><span className="n">1</span>Your institution</h2>
        <div className="typepick" role="group" aria-label="Type of institution">
          {TYPES.map((t) => (
            <button type="button" key={t.key} aria-pressed={f.type === t.key} onClick={() => setF({ ...f, type: t.key })}>
              <Icon name={t.icon} size={22} /><b>{t.label}</b><small>{t.blurb}</small>
            </button>
          ))}
        </div>
        {er('type')}
        <div className="field"><label htmlFor="ap-name">Full name of the institution</label><input id="ap-name" type="text" value={f.name} onChange={set('name')} placeholder="e.g. Greenfield Model College" />{er('name')}</div>
        <div className="two">
          <div className="field"><label htmlFor="ap-city">City or district</label><input id="ap-city" type="text" value={f.city} onChange={set('city')} placeholder="e.g. Dhaka" />{er('city')}</div>
          <div className="field"><label htmlFor="ap-students">About how many students?</label><input id="ap-students" type="number" min="1" inputMode="numeric" value={f.students} onChange={set('students')} placeholder="e.g. 800" />{er('students')}</div>
        </div>
        <div className="field"><label htmlFor="ap-address">Address <span className="muted">(optional)</span></label><input id="ap-address" type="text" value={f.address} onChange={set('address')} /></div>
      </section>

      <section className="fsec">
        <h2><span className="n">2</span>Who will manage Campusly?</h2>
        <p className="hint mt-xs">This person becomes your first admin. We send the sign-in details to this email and phone.</p>
        <div className="two">
          <div className="field"><label htmlFor="ap-contactName">Full name</label><input id="ap-contactName" type="text" value={f.contactName} onChange={set('contactName')} autoComplete="name" />{er('contactName')}</div>
          <div className="field"><label htmlFor="ap-designation">Position</label><input id="ap-designation" type="text" value={f.designation} onChange={set('designation')} placeholder="e.g. Principal" /></div>
        </div>
        <div className="two">
          <div className="field"><label htmlFor="ap-email">Email</label><input id="ap-email" type="text" value={f.email} onChange={set('email')} autoComplete="email" />{er('email')}</div>
          <div className="field"><label htmlFor="ap-phone">Mobile number</label><input id="ap-phone" type="text" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="01712345678" autoComplete="tel" />{er('phone')}</div>
        </div>
      </section>

      <section className="fsec">
        <h2><span className="n">3</span>Plan and payment</h2>
        <div className="opt-list" role="group" aria-label="Plan">
          {plans.plans.map((p) => (
            <button type="button" key={p.key} className="opt" aria-pressed={f.plan === p.key} onClick={() => setF({ ...f, plan: p.key })}>
              <span><b>{p.name}</b><small>{p.bestFor}. {p.limits.students ? `Up to ${p.limits.students} students` : 'Unlimited students'}</small></span>
              <span className="pr">{taka(p.prices[f.cycle])}</span>
            </button>
          ))}
        </div>
        {er('plan')}
        <div className="field"><span className="label">Billing period</span>
          <div className="seg" role="group" aria-label="Billing period">
            {plans.cycles.map((c) => <button type="button" key={c.key} aria-pressed={f.cycle === c.key} onClick={() => setF({ ...f, cycle: c.key })}>{c.name}{c.discount ? ` (save ${Math.round(c.discount * 100)}%)` : ''}</button>)}
          </div>
        </div>
        <div className="field"><span className="label">How would you like to start?</span>
          <div className="seg" role="group" aria-label="How to start">
            <button type="button" aria-pressed={trial} onClick={() => setF({ ...f, mode: 'trial' })}>Free {plans.trialDays}-day trial</button>
            <button type="button" aria-pressed={!trial} onClick={() => setF({ ...f, mode: 'pay' })}>Pay now</button>
          </div>
        </div>
        {trial ? (
          <div className="paybox"><b>No payment today.</b> You get {plans.trialDays} days to try {plan && plan.name}. Then renew from the Billing page with bKash or Nagad.</div>
        ) : (
          <div className="paybox">
            <span className="muted">Amount to send</span>
            <div className="amount">{taka(price)}</div>
            <div className="seg" role="group" aria-label="Payment method" style={{ marginTop: 12 }}>
              <button type="button" aria-pressed={f.method === 'bkash'} onClick={() => setF({ ...f, method: 'bkash' })}>bKash</button>
              <button type="button" aria-pressed={f.method === 'nagad'} onClick={() => setF({ ...f, method: 'nagad' })}>Nagad</button>
            </div>
            {er('method')}
            <ol>
              <li>Open {f.method === 'bkash' ? 'bKash' : 'Nagad'} and choose Send Money (or Payment).</li>
              <li>Send {taka(price)} to <span className="paynum">{plans.payTo[f.method]}</span></li>
              <li>Copy the transaction ID from the SMS and enter it below.</li>
            </ol>
            <div className="two">
              <div className="field"><label htmlFor="ap-trxId">Transaction ID</label><input id="ap-trxId" type="text" value={f.trxId} onChange={set('trxId')} placeholder="e.g. BK7H2M9XQ1" autoCapitalize="characters" />{er('trxId')}</div>
              <div className="field"><label htmlFor="ap-payerNumber">Number you paid from</label><input id="ap-payerNumber" type="text" inputMode="tel" value={f.payerNumber} onChange={set('payerNumber')} placeholder="01712345678" />{er('payerNumber')}</div>
            </div>
          </div>
        )}
        <div className="field"><label htmlFor="ap-message">Anything we should know? <span className="muted">(optional)</span></label><textarea id="ap-message" value={f.message} onChange={set('message')} /></div>
      </section>

      {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
      <button className="btn lg mt" type="submit" disabled={busy}>{busy ? 'Sending…' : trial ? 'Start free trial' : `Send application and ${taka(price)} payment details`}</button>
      <p className="hint center mt-s">Students and teachers never pay. By applying you agree that we may contact you about your application.</p>
    </form>
  );
}

export default function Apply() {
  const state = useApi('/public/plans');
  return (
    <div className="wrap"><div className="page-narrow">
      <h1>Apply for Campusly</h1>
      <p className="lead mt-xs">Three short steps. We review your application and set up your institution, usually within one working day.</p>
      <Async state={state}>{(d) => <Form plans={d} />}</Async>
    </div></div>
  );
}
