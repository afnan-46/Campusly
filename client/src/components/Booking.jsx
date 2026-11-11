import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { DAYS, fmtDate, fmtTime, hoursSorted, initials, parseYmd } from '../lib/format';

export function HoursChips({ hours }) {
  return (
    <div className="hours-chips">
      {hoursSorted(hours).map((h) => (
        <span className="hc" key={h._id || `${h.day}${h.start}`}><Icon name="clock" size={13} />{DAYS[h.day]} {fmtTime(h.start)} to {fmtTime(h.end)}</span>
      ))}
    </div>
  );
}

// The four-step booking card. `f` is a faculty profile with `days` from the API.
export default function Booking({ f, type, course, onRefresh }) {
  const { toast, terms: t } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const keep = loc.state || {};
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [mode, setMode] = useState(keep.mode || 'In person');
  const [agenda, setAgenda] = useState(keep.agenda || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const who = type === 'Advising' ? t.advisor.toLowerCase() : 'teacher';

  // Pick the first day with a free slot; keep the chosen day if it is still listed.
  useEffect(() => {
    if (!date || !f.days.some((x) => x.date === date)) {
      const first = f.days.find((x) => x.free > 0);
      setDate(first ? first.date : f.days[0]?.date);
    }
  }, [f, date]);

  const day = f.days.find((x) => x.date === date);
  const slots = day ? day.slots : [];
  useEffect(() => {
    if (time && !slots.some((s) => s.time === time && !s.taken)) setTime(null);
  }, [slots, time]);

  async function book() {
    if (!time) return;
    if (agenda.trim().length < 5) {
      setErr(`Add a short agenda so your ${who} knows what to prepare.`);
      document.getElementById('agenda')?.focus();
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api('/appointments', { method: 'POST', body: { facultyId: f.id, type, course, date, time, mode, agenda } });
      toast(`Request sent to ${f.name}. You'll be notified when it's confirmed.`);
      nav('/appointments', { replace: true, state: null });
    } catch (e) {
      setErr(e.message);
      if (e.status === 409) { setTime(null); onRefresh?.(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad booking">
      {type === 'Course' && (
        <div className="profile" style={{ marginBottom: 24 }}>
          <span className="avatar">{initials(f.name)}</span>
          <div className="pi"><h2>{f.name}</h2><p className="muted small">{course} {t.teacherLower}{f.room ? `, ${f.room}` : ''}</p><HoursChips hours={f.hours} /></div>
        </div>
      )}
      <div className="block">
        <div className="step-h"><span className="step-n">1</span><h2>Pick a day</h2></div>
        <div className="days" role="group" aria-label="Days">
          {f.days.map((x) => {
            const d = parseYmd(x.date);
            return (
              <button key={x.date} className="day" aria-pressed={date === x.date} disabled={!x.total} onClick={() => { setDate(x.date); setTime(null); setErr(''); }}>
                <small>{DAYS[d.getDay()]}</small><b>{d.getDate()}</b><small>{x.total ? (x.free ? `${x.free} free` : 'Full') : 'No hours'}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="block">
        <div className="step-h"><span className="step-n">2</span><h2>Pick a time</h2></div>
        {slots.length ? (
          <div className="slots" role="group" aria-label="Times">
            {slots.map((s) => (
              <button key={s.time} className="slot" aria-pressed={time === s.time} disabled={s.taken}
                aria-label={s.taken ? `${fmtTime(s.time)}, already booked` : undefined} onClick={() => { setTime(s.time); setErr(''); }}>
                {fmtTime(s.time)}
              </button>
            ))}
          </div>
        ) : <p className="muted mt-s">No office hours left on this day. Pick another day.</p>}
      </div>
      <div className="block">
        <div className="step-h"><span className="step-n">3</span><h2>How do you want to meet?</h2></div>
        <div className="seg" role="group" aria-label="Meeting mode">
          {['In person', 'Online'].map((m) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m}</button>)}
        </div>
      </div>
      <div className="block">
        <div className="step-h"><span className="step-n">4</span><h2><label htmlFor="agenda">What do you want to discuss?</label></h2></div>
        <div className="field" style={{ marginTop: 12 }}>
          <textarea id="agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} maxLength={600}
            placeholder={type === 'Advising' ? (t.inst === 'university' ? 'e.g. course plan for next semester, credit transfer, retake rules' : 'e.g. my exam results, a problem in class, or a study plan') : 'e.g. a question about homework, or a chapter I did not understand'} />
          <span className="hint">A short agenda helps your {who} prepare.</span>
        </div>
      </div>
      {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
      <div className="summary">
        <p>{time ? <><b>{fmtDate(date)}, {fmtTime(time)}</b> with {f.name}{course ? ` for ${course}` : ''}, {mode.toLowerCase()}</> : <span className="muted">Choose a time to continue.</span>}</p>
        <button className="btn" onClick={book} disabled={!time || busy}><Icon name="send" size={16} />{busy ? 'Sending…' : 'Send request'}</button>
      </div>
    </div>
  );
}
