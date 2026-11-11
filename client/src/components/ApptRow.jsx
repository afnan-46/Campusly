import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { Pill } from './ui';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { apptLabel, DAYS, MONTHS, parseYmd, fmtTime } from '../lib/format';

// One appointment line. `who` is the viewer: 'student' or 'faculty'.
export default function ApptRow({ a, who, onChanged }) {
  const { toast, user, terms: t } = useApp();
  const nav = useNavigate();
  const [inline, setInline] = useState(null); // 'decline' | 'complete'
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const d = parseYmd(a.date);
  const future = !a.past;

  async function act(path, body, msg) {
    setBusy(true);
    try {
      await api(`/appointments/${a.id}/${path}`, { method: 'PATCH', body: body || {} });
      setInline(null);
      setText('');
      toast(msg);
      onChanged?.();
    } catch (e) {
      toast(e.message);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  function reschedule() {
    const state = { agenda: a.agenda, mode: a.mode };
    if (a.type === 'Advising' && a.facultyId === user.advisorId) nav('/advisor', { state });
    else if (a.course) nav(`/instructors?course=${a.course}`, { state });
    else nav('/advisor', { state });
    toast(`Pick a new time with ${a.facultyName}. Your agenda was kept.`);
  }

  // One plain sentence about where this appointment stands.
  const them = who === 'student' ? a.facultyName : a.studentName;
  const label = { Pending: 'Waiting', 'No-show': 'Missed' }[a.status] || a.status;
  const line = {
    student: {
      Pending: `${them} has not replied yet. You can still cancel.`,
      Confirmed: a.past ? 'The time has passed. Waiting for the outcome.' : `${them} accepted. See you then.`,
      Completed: 'This meeting is done.',
      Declined: `${them} could not meet at this time. Pick another time.`,
      Cancelled: 'This appointment was cancelled.',
      'No-show': 'You were marked as not attending.',
    },
    faculty: {
      Pending: 'Needs your reply.',
      Confirmed: a.past ? 'The time has passed. Record what happened.' : 'You accepted this request.',
      Completed: 'This meeting is done.',
      Declined: 'You declined this request.',
      Cancelled: 'The student cancelled.',
      'No-show': 'You marked the student as not attending.',
    },
  }[who][a.status] || '';

  let acts = null;
  let extra = null;
  if (who === 'student' && future && (a.status === 'Pending' || a.status === 'Confirmed')) {
    acts = <button className="btn sm danger" disabled={busy} onClick={() => act('cancel', null, 'Appointment cancelled. The slot is open again.')}>Cancel appointment</button>;
  }
  if (who === 'student' && ['Cancelled', 'Declined', 'No-show'].includes(a.status)) {
    acts = <button className="btn sm ghost" onClick={reschedule}><Icon name="refresh" size={15} />Reschedule</button>;
  }
  if (who === 'faculty') {
    if (a.status === 'Pending' && future) {
      acts = (
        <div className="row">
          <button className="btn sm" disabled={busy} onClick={() => act('accept', null, `Confirmed. ${a.studentName} has been notified.`)}>Accept</button>
          <button className="btn sm ghost" onClick={() => setInline('decline')}>Decline</button>
        </div>
      );
      if (inline === 'decline') {
        extra = (
          <div className="inline">
            <input type="text" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Reason, e.g. I'm in a meeting. Please pick Tuesday." aria-label="Reason for declining" />
            <button className="btn sm" disabled={busy} onClick={() => act('decline', { note: text }, `Declined. ${a.studentName} can pick another time.`)}>Decline request</button>
            <button className="btn sm ghost" onClick={() => setInline(null)}>Keep</button>
          </div>
        );
      }
    }
    if (a.status === 'Confirmed' && !future) {
      acts = (
        <div className="row">
          <button className="btn sm" onClick={() => setInline('complete')}>Mark completed</button>
          <button className="btn sm ghost" disabled={busy} onClick={() => act('no-show', null, 'Marked as a no-show.')}>No-show</button>
        </div>
      );
      if (inline === 'complete') {
        extra = (
          <div className="inline">
            <input type="text" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Note for the student (optional)" aria-label="Note for the student" />
            <button className="btn sm" disabled={busy} onClick={() => act('complete', { note: text }, 'Marked as completed.')}>Save as completed</button>
            <button className="btn sm ghost" onClick={() => setInline(null)}>Cancel</button>
          </div>
        );
      }
    }
  }

  return (
    <div className="appt">
      <div className="datebox"><span>{DAYS[d.getDay()]}</span><b>{d.getDate()}</b><span>{MONTHS[d.getMonth()]}</span></div>
      <div>
        <h3>{who === 'student' ? a.facultyName : <>{a.studentName} <span className="muted small">{a.sid}</span></>}</h3>
        <p className="meta">
          <span><Icon name="clock" size={14} />{fmtTime(a.time)}</span>
          <span><Icon name={a.type === 'Advising' ? 'advisor' : 'course'} size={14} />{apptLabel(a, t)}</span>
          <span><Icon name={a.mode === 'Online' ? 'video' : 'pin'} size={14} />{a.mode === 'Online' ? 'Online' : a.facultyRoom}</span>
        </p>
        <p className="stline"><Pill status={a.status} label={label} /><span>{line}</span></p>
        {a.agenda && <p className="agenda">{a.agenda}</p>}
        {a.note && <p className="note"><b>{who === 'student' ? a.facultyName : 'Your note'}:</b> {a.note}</p>}
        {extra}
      </div>
      <div className="acts">{acts}</div>
    </div>
  );
}
