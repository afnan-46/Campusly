import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Stub from '../components/Stub';
import { Async, Empty } from '../components/ui';
import { useApi } from '../lib/useApi';

// Students' and faculty members' own reports.
export default function Reports() {
  const [params, setParams] = useSearchParams();
  const f = ['open', 'resolved'].includes(params.get('filter')) ? params.get('filter') : 'all';
  const nav = useNavigate();
  const loc = useLocation();
  const justFiled = loc.state?.justFiled;
  const [expanded, setExpanded] = useState(justFiled || null);
  const state = useApi('/reports/mine');

  return (
    <Async state={state}>
      {(d) => {
        const mine = d.reports;
        const openN = mine.filter((r) => r.status !== 'Resolved').length;
        const list = mine.filter((r) => f === 'all' || (f === 'open' ? r.status !== 'Resolved' : r.status === 'Resolved'));
        return (
          <>
            {justFiled && (
              <div className="filed"><span className="fi"><Icon name="check" /></span>
                <div><h2>Report {justFiled} submitted</h2><p className="small">Use this number if you follow up in person. You'll get a notification each time the status changes.</p></div></div>
            )}
            <div className="filters">
              <div className="chips" role="group" aria-label="Show">
                {[['all', `All (${mine.length})`], ['open', `Open (${openN})`], ['resolved', `Resolved (${mine.length - openN})`]].map(([v, l]) => (
                  <button key={v} className="chip" aria-pressed={f === v} onClick={() => setParams(v === 'all' ? {} : { filter: v }, { replace: true })}>{l}</button>
                ))}
              </div>
              <button className="btn sm" onClick={() => nav('/reports/new')}><Icon name="alert" size={16} />Report a problem</button>
            </div>
            <div className="stubs sec">
              {list.length ? list.map((r) => (
                <Stub key={r.id} r={r} full expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} onChanged={state.reload} />
              )) : <Empty text="No reports here yet. If something on campus is broken or unsafe, report it." label="Report a problem" to="/reports/new" />}
            </div>
          </>
        );
      }}
    </Async>
  );
}
