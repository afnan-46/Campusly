import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import ApptRow from '../../components/ApptRow';
import { Async, Empty, Pill } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { byDT, firstName, fmtDate, fmtTime, greet, isUpcoming, apptLabel } from '../../lib/format';

// Calm home: one greeting, four clear actions, what is coming up, and your latest reports.
export default function StudentHome() {
  const { user, terms: t } = useApp();
  const adv1 = t.advisor.toLowerCase();
  const nav = useNavigate();
  const state = useApi({ appts: '/appointments', reps: '/reports/mine' });

  return (
    <Async state={state}>
      {(d) => {
        const ups = d.appts.appointments.filter(isUpcoming).sort(byDT);
        const open = d.reps.reports.filter((r) => r.status !== 'Resolved');
        const next = ups[0];
        return (
          <>
            <div className="greet"><h1>{greet()}, {firstName(user)}</h1>
              <p>{user.institution ? user.institution.name : ''}</p></div>

            {next && (
              <div className="next-card">
                <span className="ai" style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center' }}><Icon name="cal" size={20} /></span>
                <div className="nl"><small>Your next appointment</small><b>{fmtDate(next.date)}, {fmtTime(next.time)}</b>
                  <small>{next.facultyName}, {apptLabel(next, t)}</small></div>
                <Pill status={next.status} label={next.status === 'Pending' ? 'Waiting' : next.status} />
              </div>
            )}

            <div className="actions2">
              <button className="actionbtn" onClick={() => nav('/advisor')}><span className="ai"><Icon name="advisor" size={22} /></span><span><b>Book my {adv1}</b><small>Pick a free time</small></span></button>
              <button className="actionbtn" onClick={() => nav('/instructors')}><span className="ai"><Icon name="course" size={22} /></span><span><b>Meet a {t.instructor.toLowerCase()}</b><small>For a {t.course.toLowerCase()}</small></span></button>
              <button className="actionbtn" onClick={() => nav('/reports/new')}><span className="ai"><Icon name="alert" size={22} /></span><span><b>Report a problem</b><small>Send it to the right office</small></span></button>
              <button className="actionbtn" onClick={() => nav('/appointments')}><span className="ai"><Icon name="clock" size={22} /></span><span><b>My appointments</b><small>{ups.length ? `${ups.length} coming up` : 'Nothing booked'}</small></span></button>
            </div>

            <div className="sectitle"><h2>Coming up</h2>{ups.length > 3 && <button className="link small" onClick={() => nav('/appointments')}>See all</button>}</div>
            <div className="plain-list">
              {ups.length ? ups.slice(0, 3).map((a) => <ApptRow key={a.id} a={a} who="student" onChanged={state.reload} />)
                : <Empty text="No appointments yet." label={`Book my ${adv1}`} to="/advisor" />}
            </div>

            <div className="sectitle"><h2>Your reports</h2>{open.length > 0 && <button className="link small" onClick={() => nav('/reports')}>See all</button>}</div>
            <div className="plain-list">
              {open.length ? open.slice(0, 2).map((r) => (
                <button key={r.id} className="minirep" onClick={() => nav('/reports')}>
                  <span><b>{r.title}</b><small>With {r.dept}</small></span>
                  <Pill status={r.status} />
                </button>
              )) : <Empty text="Nothing open. If something is broken or unsafe, tell us." label="Report a problem" to="/reports/new" />}
            </div>
          </>
        );
      }}
    </Async>
  );
}
