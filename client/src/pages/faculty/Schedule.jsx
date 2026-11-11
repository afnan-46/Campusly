import Icon from '../../components/Icon';
import ApptRow from '../../components/ApptRow';
import { Async, Empty } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { byDT, fmtDate } from '../../lib/format';

export default function Schedule() {
  const state = useApi('/appointments');
  return (
    <Async state={state}>
      {(d) => {
        const mine = d.appointments;
        const up = mine.filter((a) => a.status === 'Confirmed' && !a.past).sort(byDT);
        const groups = {};
        up.forEach((a) => { (groups[a.date] = groups[a.date] || []).push(a); });
        const hist = mine.filter((a) => ['Completed', 'No-show', 'Declined', 'Cancelled'].includes(a.status)).sort(byDT).reverse().slice(0, 6);
        return (
          <>
            <p className="lead">Your confirmed meetings for the coming week.</p>
            {Object.keys(groups).length ? Object.entries(groups).map(([day, arr]) => (
              <section className="card sec" key={day}>
                <div className="card-head"><h2><Icon name="cal" size={18} />{fmtDate(day)}</h2><span className="hint">{arr.length} {arr.length === 1 ? 'meeting' : 'meetings'}</span></div>
                <div className="card-body">{arr.map((a) => <ApptRow key={a.id} a={a} who="faculty" onChanged={state.reload} />)}</div>
              </section>
            )) : <div className="sec"><Empty text="No confirmed meetings coming up." /></div>}
            <section className="card sec">
              <div className="card-head"><h2><Icon name="clock" size={18} />Recent</h2></div>
              <div className="card-body">{hist.length ? hist.map((a) => <ApptRow key={a.id} a={a} who="faculty" onChanged={state.reload} />) : <Empty text="No past meetings yet." />}</div>
            </section>
          </>
        );
      }}
    </Async>
  );
}
