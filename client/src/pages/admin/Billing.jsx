import { useState } from 'react';
import Icon from '../../components/Icon';
import { FieldErr, FormAlert, useSave } from '../../components/Modal';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { fmtDay, taka } from '../../lib/format';

const PAY = { pending: ['warn', 'Waiting for confirmation'], verified: ['ok', 'Confirmed'], rejected: ['bad', 'Not confirmed'] };

function Renew({ d, onSent }) {
  const cur = d.subscription || {};
  const [f, setF] = useState({ plan: cur.plan || 'standard', cycle: cur.cycle && cur.cycle !== 'trial' ? cur.cycle : 'monthly', method: 'bkash', trxId: '', payerNumber: '' });
  const [run, busy, errs, msg] = useSave();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const plan = d.plans.find((p) => p.key === f.plan);
  const price = plan.prices[f.cycle];
  async function send(e) { e.preventDefault(); if (await run(() => api('/admin/billing/renew', { method: 'POST', body: f }), 'Payment sent. We will confirm it soon.')) onSent(); }
  return (
    <form className="fsec" onSubmit={send} noValidate>
      <h2>{d.access.state === 'active' && !cur.trial ? 'Renew or change plan' : 'Choose a plan'}</h2>
      <div className="opt-list" role="group" aria-label="Plan">
        {d.plans.map((p) => (
          <button type="button" key={p.key} className="opt" aria-pressed={f.plan === p.key} onClick={() => setF({ ...f, plan: p.key })}>
            <span><b>{p.name}</b><small>{p.limits.students ? `Up to ${p.limits.students} students` : 'Unlimited students'}{p.key === cur.plan ? ', your current plan' : ''}</small></span><span className="pr">{taka(p.prices[f.cycle])}</span>
          </button>
        ))}
      </div>
      <FieldErr errs={errs} k="plan" />
      <div className="field"><span className="label">Pay for</span>
        <div className="seg" role="group" aria-label="Billing period">{d.cycles.map((c) => <button type="button" key={c.key} aria-pressed={f.cycle === c.key} onClick={() => setF({ ...f, cycle: c.key })}>{c.name}{c.discount ? ` (save ${Math.round(c.discount * 100)}%)` : ''}</button>)}</div></div>
      <div className="paybox">
        <span className="muted">Amount to send</span><div className="amount">{taka(price)}</div>
        <div className="seg" role="group" aria-label="Payment method" style={{ marginTop: 12 }}>
          <button type="button" aria-pressed={f.method === 'bkash'} onClick={() => setF({ ...f, method: 'bkash' })}>bKash</button>
          <button type="button" aria-pressed={f.method === 'nagad'} onClick={() => setF({ ...f, method: 'nagad' })}>Nagad</button>
        </div>
        <ol><li>Send {taka(price)} to <span className="paynum">{d.payTo[f.method]}</span></li><li>Copy the transaction ID from the SMS and enter it below.</li></ol>
        <div className="two">
          <div className="field"><label htmlFor="b-trx">Transaction ID</label><input id="b-trx" type="text" value={f.trxId} onChange={set('trxId')} placeholder="e.g. BK7H2M9XQ1" autoCapitalize="characters" /><FieldErr errs={errs} k="trxId" /></div>
          <div className="field"><label htmlFor="b-num">Number you paid from</label><input id="b-num" type="text" inputMode="tel" value={f.payerNumber} onChange={set('payerNumber')} placeholder="01712345678" /><FieldErr errs={errs} k="payerNumber" /></div>
        </div>
      </div>
      <FormAlert msg={Object.keys(errs).length ? '' : msg} />
      <button className="btn mt" type="submit" disabled={busy}>{busy ? 'Sending…' : `I have paid ${taka(price)}`}</button>
    </form>
  );
}

export default function Billing() {
  const state = useApi('/admin/billing');
  return (
    <Async state={state}>
      {(d) => {
        const a = d.access;
        const s = d.subscription;
        const total = s ? Math.max(1, Math.round((new Date(s.endsAt) - new Date(s.startsAt)) / 864e5)) : 1;
        const pct = s ? Math.max(0, Math.min(100, (a.daysLeft / total) * 100)) : 100;
        const status = a.state === 'suspended' ? ['bad', 'Paused'] : a.state === 'expired' ? ['bad', 'Ended'] : s && s.trial ? ['warn', 'Free trial'] : ['ok', 'Active'];
        const l = d.limits;
        return (
          <>
            {a.state !== 'active' && <div className="banner bad" role="alert"><span><b>{a.state === 'suspended' ? 'Access is paused.' : 'Your plan has ended.'}</b> Students and teachers can see their data but cannot book or report until this is fixed.{a.state === 'expired' ? ' Renew below.' : ' Please contact Campusly.'}</span></div>}
            {a.state === 'active' && a.daysLeft !== null && a.daysLeft <= 7 && <div className="banner warn"><span><b>{a.daysLeft} {a.daysLeft === 1 ? 'day' : 'days'} left.</b> Renew now so nothing stops.</span></div>}
            <section className="fsec" style={{ marginTop: 0 }}>
              <div className="row-between"><h2>Your plan</h2><span className={`dotline ${status[0]}`}>{status[1]}</span></div>
              <div className="planline mt-s"><b>{a.plan || 'No plan'}</b>{s && <span className="muted">{s.trial ? 'Free trial' : s.cycle === 'yearly' ? 'Yearly' : s.cycle === 'halfyear' ? '6 months' : 'Monthly'}</span>}</div>
              {s && <>
                <p className="muted mt-xs">{a.state === 'active' ? `Ends on ${fmtDay(s.endsAt)}, ${a.daysLeft} ${a.daysLeft === 1 ? 'day' : 'days'} from now.` : `Ended on ${fmtDay(s.endsAt)}.`}</p>
                <div className={`meter${a.daysLeft <= 7 ? ' low' : ''}`} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
              </>}
              <dl className="detail-grid" style={{ marginTop: 16 }}>
                <dt>Students</dt><dd>{l.students.used}{l.students.max ? ` of ${l.students.max}` : ' (unlimited)'}</dd>
                <dt>Teachers and staff</dt><dd>{l.staff.used}{l.staff.max ? ` of ${l.staff.max}` : ' (unlimited)'}</dd>
                <dt>Excel import</dt><dd>{l.canImport ? 'Included' : 'Not in this plan'}</dd>
              </dl>
            </section>
            {d.pendingPayment ? (
              <div className="banner grey" role="status"><span><Icon name="info" size={16} /> Your payment is waiting for confirmation. We usually confirm within one working day.</span></div>
            ) : <Renew d={d} onSent={state.reload} />}
            <h2 style={{ margin: '28px 0 10px' }}>Payments</h2>
            {d.payments.length ? (
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Transaction</th><th>Status</th></tr></thead>
                <tbody>{d.payments.map((p) => (
                  <tr key={p.id}><td className="nowrap">{fmtDay(p.createdAt)}</td><td>{p.planName}<small>{p.cycleName}</small></td><td><b>{taka(p.amount)}</b></td><td><span className="mono">{p.trxId}</span><small>{p.methodLabel}</small></td>
                    <td><span className={`dotline ${PAY[p.status][0]}`}>{PAY[p.status][1]}</span>{p.rejectReason && <small>{p.rejectReason}</small>}</td></tr>))}</tbody>
              </table></div>
            ) : <div className="empty"><p>No payments yet.</p></div>}
          </>
        );
      }}
    </Async>
  );
}
