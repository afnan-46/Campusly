import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import ApptRow from '../../components/ApptRow';
import { Async, Empty } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { byDT, isUpcoming } from '../../lib/format';
import { useApp } from '../../context/AppContext';

export default function Appointments() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'past' ? 'past' : 'up';
  const nav = useNavigate();
  const state = useApi('/appointments');
  const { terms: t } = useApp();

  return (
    <Async state={state}>
      {(d) => {
        const mine = d.appointments;
        const up = mine.filter(isUpcoming).sort(byDT);
        const past = mine.filter((a) => !isUpcoming(a)).sort(byDT).reverse();
        const list = tab === 'up' ? up : past;
        return (
          <>
            <div className="filters">
              <div className="chips" role="group" aria-label="Show">
                <button className="chip" aria-pressed={tab === 'up'} onClick={() => setParams({}, { replace: true })}>Upcoming ({up.length})</button>
                <button className="chip" aria-pressed={tab === 'past'} onClick={() => setParams({ tab: 'past' }, { replace: true })}>Past and cancelled ({past.length})</button>
              </div>
              <button className="btn sm" onClick={() => nav('/advisor')}><Icon name="cal" size={16} />New appointment</button>
            </div>
            <div className="sec">
              {list.length
                ? <div className="card"><div className="card-body">{list.map((a) => <ApptRow key={a.id} a={a} who="student" onChanged={state.reload} />)}</div></div>
                : <Empty text={tab === 'up' ? 'No upcoming appointments.' : 'No past appointments yet.'} label={tab === 'up' ? `Book my ${t.advisor.toLowerCase()}` : null} to="/advisor" />}
            </div>
          </>
        );
      }}
    </Async>
  );
}
