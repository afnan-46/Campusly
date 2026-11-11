import { useNavigate } from 'react-router-dom';
import ApptRow from '../../components/ApptRow';
import { Async, Empty } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { byDT, firstName, greet, ymd } from '../../lib/format';

export default function FacultyHome() {
  const { user } = useApp();
  const nav = useNavigate();
  const state = useApi('/appointments');
  return (
    <Async state={state}>
      {(d) => {
        const mine = d.appointments;
        const pend = mine.filter((a) => a.status === 'Pending' && !a.past).sort(byDT);
        const need = mine.filter((a) => a.status === 'Confirmed' && a.past).sort(byDT);
        const today = ymd(new Date());
        const todays = mine.filter((a) => a.status === 'Confirmed' && !a.past && a.date === today).sort(byDT);
        const upcoming = mine.filter((a) => a.status === 'Confirmed' && !a.past && a.date !== today).sort(byDT).slice(0, 3);
        return (
          <>
            <div className="greet"><h1>{greet()}, {firstName(user)}</h1>
              <p>{pend.length ? `${pend.length} ${pend.length === 1 ? 'request needs' : 'requests need'} your reply.` : 'No requests waiting.'}{todays.length ? ` ${todays.length} ${todays.length === 1 ? 'meeting' : 'meetings'} today.` : ''}</p></div>
            <div className="actions2">
              <button className="actionbtn" onClick={() => nav('/schedule')}><span className="ai"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg></span><span><b>My schedule</b><small>All meetings</small></span></button>
              <button className="actionbtn" onClick={() => nav('/hours')}><span className="ai"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><span><b>Office hours</b><small>When students can book you</small></span></button>
            </div>

            <div className="sectitle" id="waiting"><h2>Waiting for you{pend.length ? ` (${pend.length})` : ''}</h2></div>
            <div className="plain-list">{pend.length ? pend.map((a) => <ApptRow key={a.id} a={a} who="faculty" onChanged={state.reload} />) : <Empty text="No pending requests. New ones show up here." />}</div>

            {need.length > 0 && (<>
              <div className="sectitle"><h2>Record the outcome</h2><span className="hint">These meetings have passed.</span></div>
              <div className="plain-list">{need.map((a) => <ApptRow key={a.id} a={a} who="faculty" onChanged={state.reload} />)}</div>
            </>)}

            <div className="sectitle"><h2>Later today</h2><button className="link small" onClick={() => nav('/schedule')}>Full schedule</button></div>
            <div className="plain-list">{todays.length ? todays.map((a) => <ApptRow key={a.id} a={a} who="faculty" onChanged={state.reload} />) : <Empty text="No more confirmed meetings today." />}</div>
            {upcoming.length > 0 && (<>
              <div className="sectitle"><h2>Next few days</h2></div>
              <div className="plain-list">{upcoming.map((a) => <ApptRow key={a.id} a={a} who="faculty" onChanged={state.reload} />)}</div>
            </>)}
          </>
        );
      }}
    </Async>
  );
}
