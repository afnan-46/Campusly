import { Async, Stats } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';

const fmtH = (h) => (h == null ? 'No data' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="bars">
      {rows.map(([l, n]) => (
        <div className="bar" key={l}><span>{l}</span><div className="tr"><div className="fill" style={{ width: `${((n / max) * 100).toFixed(0)}%` }} /></div><span className="n">{n}</span></div>
      ))}
    </div>
  );
}

export default function Insights() {
  const state = useApi('/insights');
  const { terms: t } = useApp();
  return (
    <Async state={state}>
      {(d) => (
        <>
          <p className="lead">How quickly reports are handled {d.scope === 'All offices' ? 'across all offices' : `in ${d.scope}`}, and where students ask for help. Figures update live as people use the app.</p>
          <Stats items={[
            ['clock', 'lav', fmtH(d.avgAckHours), 'Average time to acknowledge'],
            ['check', 'mint', fmtH(d.avgResolveHours), 'Average time to resolve'],
            ['ticket', 'butter', d.received, 'Reports received'],
            ['users', 'sky', d.acceptRate == null ? 'No data' : `${d.acceptRate}%`, 'Appointment requests accepted'],
          ]} />
          <div className="grid2 sec">
            <section className="card card-pad"><h2>Reports by type</h2><Bars rows={d.byCategory} /></section>
            <section className="card card-pad"><h2>Open reports by office</h2><Bars rows={d.openByOffice} /></section>
          </div>
          <section className="card card-pad sec"><h2>Appointment requests by {t.teacherLower}</h2><Bars rows={d.byFaculty} /></section>
        </>
      )}
    </Async>
  );
}
