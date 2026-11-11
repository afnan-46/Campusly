import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { Async } from '../../components/ui';
import { taka } from '../../lib/format';

const rows = (p) => [
  [p.limits.students ? `Up to ${p.limits.students.toLocaleString('en-IN')} students` : 'Unlimited students', true],
  [p.limits.staff ? `Up to ${p.limits.staff} teachers and staff` : 'Unlimited teachers and staff', true],
  ['Appointments and campus reports', true],
  ['Import students from Excel', !!p.features.import],
  [`${p.features.insights} insights`, true],
  ['Campus server option (works without internet)', !!p.features.campusServer],
  [`${p.features.support} support`, true],
];

export default function Pricing() {
  const state = useApi('/public/plans');
  const [cycle, setCycle] = useState('monthly');
  return (
    <div className="wrap">
      <div className="page-narrow" style={{ textAlign: 'center', maxWidth: 760 }}>
        <h1>Simple plans for every institution</h1>
        <p className="lead" style={{ margin: '10px auto 0' }}>Students and teachers always use Campusly for free. Pay only for your institution, and save when you pay ahead.</p>
      </div>
      <Async state={state}>
        {(d) => {
          const c = d.cycles.find((x) => x.key === cycle);
          return (
            <>
              <div style={{ textAlign: 'center' }}>
                <div className="cycle" role="group" aria-label="Billing period">
                  {d.cycles.map((x) => (
                    <button key={x.key} aria-pressed={cycle === x.key} onClick={() => setCycle(x.key)}>
                      {x.name}{x.discount ? <span className="save">Save {Math.round(x.discount * 100)}%</span> : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className="plans">
                {d.plans.map((p) => {
                  const total = p.prices[cycle];
                  const perMonth = Math.round(total / c.months / 10) * 10;
                  return (
                    <div key={p.key} className={`plan${p.popular ? ' pop' : ''}`}>
                      {p.popular && <span className="badge">Most chosen</span>}
                      <h3>{p.name}</h3>
                      <p className="for">{p.bestFor}</p>
                      <div className="price"><b>{taka(perMonth)}</b><span>per month</span></div>
                      <p className="bill">{c.months === 1 ? 'Billed every month' : `${taka(total)} billed every ${c.months === 6 ? '6 months' : 'year'}`}</p>
                      <ul>
                        {rows(p).map(([t, yes]) => (
                          <li key={t} className={yes ? '' : 'no'}><Icon name={yes ? 'check' : 'x'} size={16} />{t}</li>
                        ))}
                      </ul>
                      <Link className={`btn${p.popular ? '' : ' ghost'}`} to={`/apply?plan=${p.key}&cycle=${cycle}`}>Choose {p.name}</Link>
                    </div>
                  );
                })}
              </div>
              <div className="note-card"><Icon name="info" size={18} /><span><b>{d.trialDays}-day free trial.</b> Try Campusly with your own students and teachers first. You can pay with bKash or Nagad when you are ready, and we confirm it within one working day.</span></div>
              <h2 style={{ marginTop: 38 }}>Common questions</h2>
              <div className="faq">
                <details><summary>Do students or teachers pay anything?</summary><p>No. Students and teachers use Campusly for free. Only the institution pays for its plan.</p></details>
                <details><summary>How do we pay?</summary><p>Send the amount by bKash or Nagad, then enter the transaction ID from the SMS when you apply or renew. We check it and activate your plan.</p></details>
                <details><summary>What happens if our plan ends?</summary><p>Your data stays safe. Students and teachers see that access is paused, and your admin can renew from the Billing page.</p></details>
                <details><summary>Can we change plans later?</summary><p>Yes. Upgrade or renew any time from Billing. Paying for 6 months saves 10%, and a full year saves 15%.</p></details>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}
