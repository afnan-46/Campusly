import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import Modal, { FieldErr, FormAlert, useSave } from '../../components/Modal';
import { Async, Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';

function CourseForm({ course, people, onClose, onSaved }) {
  const { terms: t } = useApp();
  const editing = !!course;
  const teachers = people.filter((p) => p.role === 'faculty');
  const students = people.filter((p) => p.role === 'student');
  const groups = [...new Set(students.map((s) => s.dept))].sort();
  const [f, setF] = useState({
    code: course?.code || '', title: course?.title || '', section: course?.section || '', facultyId: course?.facultyId || '', studentIds: course?.studentIds || [],
  });
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [run, busy, errs, msg] = useSave();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const shown = students.filter((s) => (group === 'all' || s.dept === group) && `${s.name} ${s.sid}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id) => setF({ ...f, studentIds: f.studentIds.includes(id) ? f.studentIds.filter((x) => x !== id) : [...f.studentIds, id] });
  const selectShown = (on) => {
    const ids = new Set(shown.map((s) => s.id));
    setF({ ...f, studentIds: on ? [...new Set([...f.studentIds, ...ids])] : f.studentIds.filter((x) => !ids.has(x)) });
  };
  const c1 = t.course.toLowerCase();

  async function save(e) {
    e.preventDefault();
    const d = await run(
      () => (editing ? api(`/admin/courses/${course.code}`, { method: 'PATCH', body: f }) : api('/admin/courses', { method: 'POST', body: f })),
      (x) => `${x.course.code} ${editing ? 'updated' : 'added'}, with ${x.course.studentCount} student${x.course.studentCount === 1 ? '' : 's'}.`,
    );
    if (d) onSaved();
  }

  return (
    <Modal wide title={editing ? `Edit ${course.code}` : `Add a ${c1}`} onClose={onClose}
      sub={`Students enrolled here can book the teacher's office hours for this ${c1}.`}
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" form="course-form" className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : `Add ${c1}`}</button></>}>
      <form id="course-form" onSubmit={save} noValidate>
        <FormAlert msg={Object.keys(errs).length ? '' : msg} />
        <div className="form-grid three">
          <div className="field"><label htmlFor="c-code">Code</label>
            <input id="c-code" type="text" value={f.code} onChange={set('code')} disabled={editing} placeholder={t.inst === 'university' ? 'e.g. CSE302' : 'e.g. MATH-8'} />
            {errs.code ? <FieldErr errs={errs} k="code" /> : <span className="hint">{editing ? 'The code cannot change.' : 'Short and unique.'}</span>}</div>
          <div className="field"><label htmlFor="c-title">Name</label><input id="c-title" type="text" value={f.title} onChange={set('title')} placeholder={t.inst === 'university' ? 'e.g. Database Systems' : 'e.g. Mathematics'} /><FieldErr errs={errs} k="title" /></div>
          <div className="field"><label htmlFor="c-sec">Section <span className="muted">(optional)</span></label><input id="c-sec" type="text" value={f.section} onChange={set('section')} placeholder={t.inst === 'school' ? 'e.g. Class 8 A' : 'e.g. 2'} /></div>
        </div>
        <div className="field"><label htmlFor="c-t">Teacher</label>
          <select id="c-t" value={f.facultyId || ''} onChange={set('facultyId')}>
            <option value="">No teacher yet</option>
            {teachers.map((x) => <option key={x.id} value={x.id}>{x.name}{x.title ? `, ${x.title}` : ''}</option>)}
          </select><FieldErr errs={errs} k="facultyId" /></div>
        <div className="field">
          <span className="label">Students ({f.studentIds.length} enrolled)</span>
          <div className="enrol-tools">
            <div className="input-wrap"><Icon name="search" size={16} className="lead-ic" /><input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" aria-label="Search students" /></div>
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t.group}>
              <option value="all">Every {t.group.toLowerCase()}</option>
              {groups.map((g) => <option key={g}>{g}</option>)}
            </select>
            <button type="button" className="btn sm soft" onClick={() => selectShown(true)}>Select shown</button>
            <button type="button" className="btn sm ghost" onClick={() => selectShown(false)}>Clear shown</button>
          </div>
          {students.length ? (
            <div className="check-grid students">
              {shown.map((s) => (
                <label className="check-tile" key={s.id}><input type="checkbox" checked={f.studentIds.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span><b>{s.name}</b><small>{s.sid}, {s.dept}</small></span></label>
              ))}
              {!shown.length && <span className="hint">No students match.</span>}
            </div>
          ) : <span className="hint">No students yet. Add them on the People page.</span>}
        </div>
      </form>
    </Modal>
  );
}

export default function Courses() {
  const { terms: t } = useApp();
  const [modal, setModal] = useState(null);
  const [rmBusy, setRmBusy] = useState(false);
  const [run] = useSave();
  const state = useApi({ courses: '/admin/courses', people: '/admin/people' });
  const people = useMemo(() => state.data?.people.people || [], [state.data]);
  const close = () => setModal(null);
  const saved = () => { close(); state.reload(); };
  const c1 = t.course.toLowerCase();

  async function remove(c) {
    setRmBusy(true);
    if (await run(() => api(`/admin/courses/${c.code}`, { method: 'DELETE' }), `${c.code} removed.`)) saved();
    setRmBusy(false);
  }

  return (
    <>
      <div className="filters">
        <p className="lead">Each {c1} has one teacher and a list of enrolled students. Students can book that teacher for the {c1}.</p>
        <button className="btn sm" onClick={() => setModal({ kind: 'add' })}><Icon name="plus" size={16} />Add {c1}</button>
      </div>
      <Async state={state}>
        {(d) => (d.courses.courses.length ? (
          <div className="course-grid sec">
            {d.courses.courses.map((c, i) => (
              <article className="course-card" key={c.code} style={{ '--i': i }}>
                <div className="cc-top"><span className="code">{c.code}</span>{c.section && <span className="hint">{/^\d+$/.test(c.section) ? `Section ${c.section}` : c.section}</span>}</div>
                <h3>{c.title}</h3>
                <p className="cc-line"><Icon name="advisor" size={15} />{c.facultyName || <span className="tag warn">No teacher yet</span>}</p>
                <p className="cc-line"><Icon name="users" size={15} />{c.studentCount} student{c.studentCount === 1 ? '' : 's'}</p>
                <div className="cc-acts">
                  <button className="btn sm ghost" onClick={() => setModal({ kind: 'edit', c })}><Icon name="edit" size={15} />Edit</button>
                  <button className="btn sm danger" onClick={() => setModal({ kind: 'rm', c })} aria-label={`Remove ${c.code}`}><Icon name="trash" size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="sec"><Empty text={`No ${t.courses.toLowerCase()} yet. Add the first one so students can book their teachers.`} /></div>)}
      </Async>
      {modal?.kind === 'add' && <CourseForm people={people} onClose={close} onSaved={saved} />}
      {modal?.kind === 'edit' && <CourseForm course={modal.c} people={people} onClose={close} onSaved={saved} />}
      {modal?.kind === 'rm' && (
        <Modal title={`Remove ${modal.c.code}?`} sub="Students are un-enrolled. Past meetings keep the code." onClose={close}
          footer={<><button className="btn ghost" onClick={close}>Keep</button><button className="btn danger" disabled={rmBusy} onClick={() => remove(modal.c)}><Icon name="trash" size={16} />Remove</button></>}>
          <p>{modal.c.title} has {modal.c.studentCount} enrolled student{modal.c.studentCount === 1 ? '' : 's'}.</p>
        </Modal>
      )}
    </>
  );
}
