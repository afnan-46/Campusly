import { useNavigate } from 'react-router-dom';
import { Async } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { age, fmtDay, taka } from '../../lib/format';

export default function CompanyHome() {
  const nav = useNavigate();
  const state = useApi('/company/dashboard');
  return (
    <Async state={state}>
      {(d) => {
        const max = Math.max(1, ...d.revenue.months.map((m) => m.amount));
        return (
          <>
            <div className="kpis">
              <div className="kpi"><small>Revenue this month</small><b>{taka(d.revenue.month)}</b><span>{taka(d.revenue.year)} this year</span></div>
              <div className="kpi"><small>Active institutions</small><b>{d.institutions.active}</b><span>{d.institutions.trial} on free trial</span></div>
              <button className="kpi" style={{ textAlign: 'left' }} onClick={() => nav('/applications')}><small>Applications waiting</small><b>{d.pending.applications}</b><span>Open the inbox</span></button>
              <button className="kpi" style={{ textAlign: 'left' }} onClick={() => nav('/payments')}><small>Payments to check</small><b>{d.pending.payments}</b><span>Renewals and upgrades</span></button>
            </div>
            <div className="cols2">
              <section className="listcard">
                <div className="lc-head"><h2>Revenue, last 6 months</h2></div>
                <div style={{ padding: '0 18px 18px' }}>
                  <div className="barchart">
                    {d.revenue.months.map((m) => (
                      <div className="col" key={m.label}><span>{m.amount ? taka(m.amount) : ''}</span><div className="bar-v" style={{ height: `${Math.max(2, (m.amount / max) * 100)}%` }} /><small>{m.label}</small></div>
                    ))}
                  </div>
                  <p className="hint mt-s">All time: {taka(d.revenue.total)} from {d.institutions.total} institutions, {d.people.students} students and {d.people.teachers} teachers.</p>
                </div>
              </section>
              <section className="listcard">
                <div className="lc-head"><h2>Plans ending soon</h2></div>
                {d.expiringSoon.length ? d.expiringSoon.map((x) => (
                  <div className="lc-row" key={x.id}><div><b>{x.name}</b><small>{x.trial ? 'Free trial' : x.plan}</small></div>
                    <span className={`dotline ${x.daysLeft <= 5 ? 'bad' : 'warn'}`}>{x.daysLeft} {x.daysLeft === 1 ? 'day' : 'days'} left</span></div>
                )) : <div className="lc-row"><small>No plan ends in the next 14 days.</small></div>}
                {(d.institutions.expired > 0 || d.institutions.suspended > 0) && (
                  <div className="lc-row"><small>{d.institutions.expired} expired, {d.institutions.suspended} paused</small><button className="link small" onClick={() => nav('/institutions')}>View</button></div>
                )}
              </section>
            </div>
            <section className="listcard" style={{ marginTop: 14 }}>
              <div className="lc-head row-between"><h2>Newest applications</h2><button className="link small" onClick={() => nav('/applications')}>See all</button></div>
              {d.recentApplications.length ? d.recentApplications.map((a) => (
                <button key={a.id} className="lc-row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, borderTop: '1px solid var(--line)' }} onClick={() => nav('/applications')}>
                  <div><b>{a.institution.name}</b><small>{a.code}, {a.planName}{a.payment.trial ? ', free trial' : `, ${taka(a.payment.amount)}`}, {age(a.createdAt)}</small></div>
                  <span className={`dotline ${a.status === 'approved' ? 'ok' : a.status === 'rejected' ? 'bad' : 'warn'}`}>{a.status === 'new' ? 'New' : a.status === 'reviewing' ? 'Reviewing' : a.status === 'approved' ? 'Approved' : 'Rejected'}</span>
                </button>
              )) : <div className="lc-row"><small>No applications yet.</small></div>}
            </section>
          </>
        );
      }}
    </Async>
  );
}
