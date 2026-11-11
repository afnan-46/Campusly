import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Async, Empty, Hero, Pill, Stats } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { apptLabel, DAYS, firstName, fmtTime, greet, MONTHS, parseYmd } from '../../lib/format';

// One meeting in the institution-wide list.
export function AdminAppt({ a, t }) {
  const d = parseYmd(a.date);
  return (
    <div className="appt">
      <div className="datebox"><span>{DAYS[d.getDay()]}</span><b>{d.getDate()}</b><span>{MONTHS[d.getMonth()]}</span></div>
      <div>
        <h3>{a.studentName} <span className="muted small">with</span> {a.facultyName}</h3>
        <p className="meta">
          <span><Icon name="clock" size={14} />{fmtTime(a.time)}</span>
          <span><Icon name={a.type === 'Advising' ? 'advisor' : 'course'} size={14} />{apptLabel(a, t)}</span>
          <span><Icon name={a.mode === 'Online' ? 'video' : 'pin'} size={14} />{a.mode === 'Online' ? 'Online' : a.facultyRoom || 'In person'}</span>
        </p>
        <p className="stline"><Pill status={a.status} label={a.status === 'Pending' ? 'Waiting' : a.status === 'No-show' ? 'Missed' : a.status} /></p>
        {a.agenda && <p className="agenda">{a.agenda}</p>}
      </div>
      <div className="acts" />
    </div>
  );
}

export default function AdminHome() {
  const { user, terms: t } = useApp();
  const nav = useNavigate();
  const [when, setWhen] = useState('upcoming');
  const state = useApi({ ov: '/admin/overview', ap: `/admin/appointments?status=${when}` });
  const inst = user.institution;

  return (
    <Async state={state}>
      {(d) => {
        const c = d.ov.counts;
        const g = d.ov.gaps;
        const todo = [
          c.pendingPeople > 0 && { ic: 'users', text: `${c.pendingPeople} ${c.pendingPeople === 1 ? 'person is' : 'people are'} waiting for your approval.`, label: 'Review', to: '/people?tab=pending' },
          g.noTeacherCourses.length && { ic: 'course', text: `${g.noTeacherCourses.length} ${t.course.toLowerCase()}${g.noTeacherCourses.length === 1 ? ' has' : 's have'} no teacher: ${g.noTeacherCourses.join(', ')}.`, label: `Open ${t.courses.toLowerCase()}`, to: '/courses' },
          g.noAdvisorStudents && { ic: 'advisor', text: `${g.noAdvisorStudents} student${g.noAdvisorStudents === 1 ? ' has' : 's have'} no ${t.advisor.toLowerCase()}.`, label: 'Open students', to: '/people?role=student' },
          g.officesWithoutStaff.length && { ic: 'building', text: `No staff in ${g.officesWithoutStaff.join(', ')}. Its reports only reach admins.`, label: 'Add office staff', to: '/people?role=staff&add=1' },
          g.teachersWithoutHours.length && { ic: 'clock', text: `${g.teachersWithoutHours.length} ${t.teacherLower}${g.teachersWithoutHours.length === 1 ? ' has' : 's have'} not set office hours yet (${g.teachersWithoutHours.slice(0, 3).join(', ')}${g.teachersWithoutHours.length > 3 ? '…' : ''}), so students cannot book them.` },
        ].filter(Boolean);
        const right = (
          <div className="glass"><small>Reports right now</small><b>{c.openReports} open{c.urgent ? `, ${c.urgent} urgent` : ''}</b>
            <p>{c.pending} meeting request{c.pending === 1 ? '' : 's'} waiting for teachers.</p><span className="gpill">{inst.shortName}</span></div>
        );
        return (
          <>
            <Hero title={`${greet()}, ${firstName(user)}`} right={right}
              text={`You manage ${inst.name}: ${c.student} students, ${c.faculty} ${c.faculty === 1 ? t.teacherLower : `${t.teacherLower}s`}, ${c.courses} ${t.courses.toLowerCase()} and ${c.offices} offices.`}
              actions={<>
                <button className="btn white" onClick={() => nav('/people?add=1')}><Icon name="plus" size={18} />Add people</button>
                <button className="btn outline-white" onClick={() => nav('/queue')}><Icon name="inbox" size={18} />All reports</button>
              </>} />
            <Stats items={[
              ['cap', 'lav', c.student, 'Students', '/people?role=student'],
              ['course', 'mint', c.faculty, t.teachers, '/people?role=faculty'],
              ['cal', 'sky', c.upcoming, 'Upcoming meetings', () => document.getElementById('all-appts')?.scrollIntoView({ behavior: 'smooth' })],
              ['alert', 'butter', c.openReports, 'Open reports', '/queue'],
            ]} />
            <section className="card sec">
              <div className="card-head"><h2><Icon name="check" size={18} />Setup checklist</h2><span className="hint">Things that stop people from using Campusly fully.</span></div>
              <div className="card-body">
                {todo.length ? todo.map((x, i) => (
                  <div className="todo" key={i}>
                    <span className="todo-ic"><Icon name={x.ic} size={18} /></span><p>{x.text}</p>
                    {x.to && <button className="btn sm ghost" onClick={() => nav(x.to)}>{x.label}</button>}
                  </div>
                )) : <Empty text="Everything is set up. Every class has a teacher, every student has a teacher to talk to, and every office has staff." />}
              </div>
            </section>
            <section className="card sec" id="all-appts">
              <div className="card-head">
                <h2><Icon name="cal" size={18} />All meetings at {inst.shortName}</h2>
                <div className="chips" role="group" aria-label="Show">
                  <button className="chip" aria-pressed={when === 'upcoming'} onClick={() => setWhen('upcoming')}>Upcoming</button>
                  <button className="chip" aria-pressed={when === 'past'} onClick={() => setWhen('past')}>Past and cancelled</button>
                </div>
              </div>
              <div className="card-body">
                {d.ap.appointments.length ? d.ap.appointments.slice(0, 30).map((a) => <AdminAppt key={a.id} a={a} t={t} />)
                  : <Empty text={when === 'upcoming' ? 'No upcoming meetings.' : 'No past meetings yet.'} />}
                {d.ap.appointments.length > 30 && <p className="hint center mt-s">Showing the first 30 of {d.ap.appointments.length}.</p>}
              </div>
            </section>
          </>
        );
      }}
    </Async>
  );
}
