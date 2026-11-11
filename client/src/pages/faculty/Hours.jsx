import { useState } from 'react';
import Icon from '../../components/Icon';
import { Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { DAYS, DAYS_LONG, fmtTime, hoursSorted, toMin } from '../../lib/format';

export default function Hours() {
  const { user, setUser, toast, terms: t } = useApp();
  const courses = useApi('/faculty/courses');
  const [day, setDay] = useState(0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const teaches = (courses.data?.courses || []).map((c) => c.code);

  async function add() {
    setBusy(true);
    setErr('');
    try {
      const d = await api('/faculty/me/hours', { method: 'POST', body: { day, start, end } });
      setUser(d.user);
      toast(`${DAYS_LONG[day]} hours added.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(h) {
    try {
      const d = await api(`/faculty/me/hours/${h._id}`, { method: 'DELETE' });
      setUser(d.user);
      toast('Office hours removed. Existing bookings are kept.');
    } catch (e) {
      toast(e.message);
    }
  }

  const blocks = hoursSorted(user.hours);
  return (
    <>
      <p className="lead">Students can book 20-minute slots inside these hours, for a {t.advisingAppt}{teaches.length ? ` and for ${teaches.join(', ')}` : ''}.</p>
      <div className="hours sec">
        {blocks.length ? blocks.map((h) => (
          <div className="hour" key={h._id}>
            <div className="hl"><span className="hd">{DAYS[h.day]}</span>
              <div><b>{DAYS_LONG[h.day]}</b><span className="muted small">{fmtTime(h.start)} to {fmtTime(h.end)}, {Math.floor((toMin(h.end) - toMin(h.start)) / 20)} slots</span></div></div>
            <button className="btn sm danger" onClick={() => remove(h)}>Remove</button>
          </div>
        )) : <Empty text="No office hours set. Students cannot book you until you add some." />}
      </div>
      <section className="card card-pad sec">
        <h2>Add office hours</h2>
        <div className="addrow">
          <div className="field"><label htmlFor="h-day">Day</label>
            <select id="h-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>{[6, 0, 1, 2, 3, 4].map((x) => <option key={x} value={x}>{DAYS_LONG[x]}</option>)}</select></div>
          <div className="field"><label htmlFor="h-start">From</label><input id="h-start" type="time" value={start} step="600" onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label htmlFor="h-end">To</label><input id="h-end" type="time" value={end} step="600" onChange={(e) => setEnd(e.target.value)} /></div>
          <button className="btn" onClick={add} disabled={busy}>Add hours</button>
        </div>
        {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
      </section>
    </>
  );
}
