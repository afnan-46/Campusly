import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import Modal, { FieldErr, FormAlert, useSave } from '../../components/Modal';
import Credentials from '../../components/Credentials';
import ImportModal from './ImportModal';
import { Async, Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { initials } from '../../lib/format';
import { roleLabel } from '../../lib/terms';

const ROLES = ['student', 'faculty', 'staff', 'admin'];
const TABS = [...ROLES, 'pending'];
const plural = (role, t) => ({ student: 'Students', faculty: t.teachers, staff: 'Office staff', admin: 'Admins', pending: 'People waiting' }[role]);

function PersonForm({ role, person, courses, onClose, onSaved, onCreated }) {
  const { meta, terms: t } = useApp();
  const editing = !!person;
  const [f, setF] = useState(() => ({
    name: person?.name || '', email: person?.email || '', password: '',
    sid: person?.sid || '', dept: person?.dept || meta?.programs?.[0] || '', advisorId: person?.advisorId || '', courses: person?.courses || [],
    title: person?.title || '', room: person?.room || '', office: person?.office || meta?.depts?.[0] || '',
  }));
  const [run, busy, errs, msg] = useSave();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleCourse = (code) => setF({ ...f, courses: f.courses.includes(code) ? f.courses.filter((c) => c !== code) : [...f.courses, code] });
  const label = roleLabel(role, t).toLowerCase();

  async function save(e) {
    e.preventDefault();
    const body = { ...f, role };
    const d = await run(
      () => (editing ? api(`/admin/people/${person.id}`, { method: 'PATCH', body }) : api('/admin/people', { method: 'POST', body })),
      editing ? `${f.name} updated.` : `${f.name} added.`,
    );
    if (d) { if (editing) onSaved(); else onCreated(d); }
  }

  return (
    <Modal title={editing ? `Edit ${person.name}` : `Add ${role === 'admin' ? 'an' : 'a'} ${label}`} onClose={onClose} wide={role === 'student'}
      sub={editing ? null : role === 'student' ? `They sign in with their ${t.sid.toLowerCase()}. We make a temporary password for you to hand over.` : 'They sign in with their email. We make a temporary password for you to hand over.'}
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" form="person-form" className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : `Add ${label}`}</button></>}>
      <form id="person-form" onSubmit={save} noValidate>
        <FormAlert msg={Object.keys(errs).length ? '' : msg} />
        <div className="form-grid">
          <div className="field"><label htmlFor="p-name">Full name</label><input id="p-name" type="text" value={f.name} onChange={set('name')} placeholder="e.g. Rina Das" /><FieldErr errs={errs} k="name" /></div>
          {role === 'student'
            ? <div className="field"><label htmlFor="p-sid">{t.sid}</label><input id="p-sid" type="text" value={f.sid} onChange={set('sid')} placeholder={`e.g. ${t.sidExample}`} /><FieldErr errs={errs} k="sid" /></div>
            : <div className="field"><label htmlFor="p-mail">Email</label><input id="p-mail" type="text" value={f.email} onChange={set('email')} placeholder="name@example.edu" /><FieldErr errs={errs} k="email" /></div>}
        </div>
        {role === 'student' && (
          <>
            <div className="form-grid three">
              <div className="field"><label htmlFor="p-mail">Email <span className="muted">(optional)</span></label><input id="p-mail" type="text" value={f.email} onChange={set('email')} placeholder="For password resets" /><FieldErr errs={errs} k="email" /></div>
              <div className="field"><label htmlFor="p-dept">{t.group}</label>
                <select id="p-dept" value={f.dept} onChange={set('dept')}>{(meta?.programs || []).map((g) => <option key={g}>{g}</option>)}</select><FieldErr errs={errs} k="dept" /></div>
              <div className="field"><label htmlFor="p-adv">{t.advisorLong}</label>
                <select id="p-adv" value={f.advisorId || ''} onChange={set('advisorId')}>
                  <option value="">Not assigned yet</option>
                  {(meta?.advisors || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select><FieldErr errs={errs} k="advisorId" /></div>
            </div>
            <div className="field"><span className="label">{t.courses} ({f.courses.length} selected)</span>
              {courses.length ? (
                <div className="check-grid">
                  {courses.map((c) => (
                    <label className="check-tile" key={c.code}><input type="checkbox" checked={f.courses.includes(c.code)} onChange={() => toggleCourse(c.code)} />
                      <span><b>{c.code}</b><small>{c.title}</small></span></label>
                  ))}
                </div>
              ) : <span className="hint">No {t.courses.toLowerCase()} yet. Add them on the {t.courses} page.</span>}
            </div>
          </>
        )}
        {role !== 'student' && (
          <div className="form-grid">
            <div className="field"><label htmlFor="p-title">Job title</label><input id="p-title" type="text" value={f.title} onChange={set('title')}
              placeholder={role === 'faculty' ? 'e.g. Assistant Teacher, Mathematics' : role === 'staff' ? 'e.g. Lab assistant' : 'e.g. Head Teacher'} /></div>
            {role === 'faculty' && <div className="field"><label htmlFor="p-room">Room</label><input id="p-room" type="text" value={f.room} onChange={set('room')} placeholder="Where students meet them" /></div>}
            {role === 'staff' && <div className="field"><label htmlFor="p-office">Office</label>
              <select id="p-office" value={f.office} onChange={set('office')}>{(meta?.depts || []).map((o) => <option key={o}>{o}</option>)}</select><FieldErr errs={errs} k="office" /></div>}
          </div>
        )}
      </form>
    </Modal>
  );
}

function PasswordForm({ person, onClose }) {
  const [pw, setPw] = useState('');
  const [creds, setCreds] = useState(null);
  const [run, busy, , msg] = useSave();
  async function go() {
    const d = await run(() => api(`/admin/people/${person.id}/password`, { method: 'POST', body: { password: pw } }));
    if (d && d.temporaryPassword) setCreds(d.temporaryPassword);
  }
  if (creds) {
    return (
      <Modal title={`Temporary password for ${person.name}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Done</button>}>
        <Credentials name={person.name} sid={person.sid} email={person.email} password={creds} institution={null} />
      </Modal>
    );
  }
  return (
    <Modal title={`Reset password for ${person.name}`} sub="Use this when someone forgets their password. They must choose a new one when they sign in." onClose={onClose}
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn" disabled={busy} onClick={go}>{busy ? 'Working…' : 'Create temporary password'}</button></>}>
      <FormAlert msg={msg} />
      <div className="field"><label htmlFor="np">Password <span className="muted">(optional)</span></label><input id="np" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Leave empty and we will create one" autoComplete="off" /></div>
    </Modal>
  );
}

function RemoveForm({ person, onClose, onSaved }) {
  const { terms: t } = useApp();
  const [run, busy, , msg] = useSave();
  const effects = {
    student: 'Their upcoming meetings are cancelled. Reports they filed stay on record.',
    faculty: `Their upcoming meetings are cancelled, their ${t.courses.toLowerCase()} are left without a teacher, and their students need a new ${t.advisor.toLowerCase()}.`,
    staff: 'Reports stay with their office.',
    admin: 'They lose admin access straight away.',
  }[person.role];
  return (
    <Modal title={`Remove ${person.name}?`} sub="This cannot be undone." onClose={onClose}
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Keep</button>
        <button type="button" className="btn danger" disabled={busy} onClick={async () => { if (await run(() => api(`/admin/people/${person.id}`, { method: 'DELETE' }), `${person.name} was removed.`)) onSaved(); }}><Icon name="trash" size={16} />Remove</button></>}>
      <FormAlert msg={msg} />
      <p>{effects}</p>
    </Modal>
  );
}

export default function People() {
  const { user, terms: t, refreshMeta } = useApp();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') === 'pending' ? 'pending' : null;
  const role = tabParam || (ROLES.includes(params.get('role')) ? params.get('role') : 'student');
  const [creds, setCreds] = useState(null);
  const [busyId, setBusyId] = useState('');
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(params.get('add') ? { kind: 'add' } : null);
  const state = useApi({ people: '/admin/people', courses: '/admin/courses' });
  const all = state.data?.people.people || [];
  const pending = state.data?.people.pending || [];
  const limits = state.data?.people.limits;
  const shown = useMemo(() => all.filter((p) => p.role === role)
    .filter((p) => `${p.name} ${p.email} ${p.sid || ''} ${p.dept || ''} ${p.office || ''} ${p.title || ''}`.toLowerCase().includes(q.trim().toLowerCase())), [all, role, q]);
  const close = () => { setModal(null); if (params.get('add')) { params.delete('add'); setParams(params, { replace: true }); } };
  const saved = () => { close(); state.reload(); refreshMeta(); };
  const pickRole = (r) => setParams(r === 'pending' ? { tab: 'pending' } : { role: r }, { replace: true });
  async function decide(p, what) {
    setBusyId(p.id);
    try {
      await api(`/admin/people/${p.id}/${what}`, { method: 'POST', body: {} });
      toast(what === 'approve' ? `${p.name} was approved.` : `${p.name} was declined.`);
      state.reload();
    } catch (e) { toast(e.message); } finally { setBusyId(''); }
  }
  async function approveAll() {
    try { const d = await api('/admin/pending/approve-all', { method: 'POST', body: {} }); toast(`${d.approved} approved${d.left ? `, ${d.left} left (plan limit reached)` : ''}.`); state.reload(); } catch (e) { toast(e.message); }
  }

  function sub(p) {
    if (p.role === 'student') return `${p.sid}, ${p.dept}`;
    if (p.role === 'staff') return `${p.office}${p.title ? `, ${p.title}` : ''}`;
    return [p.email, p.title].filter(Boolean).join(', ');
  }
  function extras(p) {
    if (p.role === 'student') {
      return <>{p.advisorName ? <span className="tag soft">{t.advisor}: {p.advisorName}</span> : <span className="tag warn">No {t.advisor.toLowerCase()}</span>}
        <span className="tag soft">{p.courses.length} {t.course.toLowerCase()}{p.courses.length === 1 ? '' : 's'}</span></>;
    }
    if (p.role === 'faculty') {
      return <>{p.teaches.length ? <span className="tag soft">Teaches {p.teaches.join(', ')}</span> : <span className="tag soft">No {t.courses.toLowerCase()}</span>}
        {p.advisees > 0 && <span className="tag soft">{t.advisor} to {p.advisees}</span>}
        {!p.hours.length && <span className="tag warn">No office hours</span>}</>;
    }
    return null;
  }

  return (
    <>
      <div className="filters">
        <div className="chips" role="tablist" aria-label="Kind of account">
          {TABS.map((r) => (
            <button key={r} role="tab" className="chip" aria-selected={role === r} aria-pressed={role === r} onClick={() => pickRole(r)}>
              {r === 'pending' ? `Waiting for approval (${pending.length})` : `${plural(r, t)} (${all.filter((p) => p.role === r).length})`}
            </button>
          ))}
        </div>
        {role !== 'pending' && (
          <div className="inline" style={{ margin: 0 }}>
            {(role === 'student' || role === 'faculty') && <button className="btn sm ghost" onClick={() => setModal({ kind: 'import' })}><Icon name="upload" size={16} />Import from Excel</button>}
            <button className="btn sm" onClick={() => setModal({ kind: 'add' })}><Icon name="plus" size={16} />Add {roleLabel(role, t).toLowerCase()}</button>
          </div>
        )}
      </div>
      {limits && limits.students.max && role === 'student' && (
        <p className="hint" style={{ marginBottom: 10 }}>{limits.students.used} of {limits.students.max} students used on the {limits.plan} plan.</p>
      )}
      {role !== 'pending' && <div className="field search-field">
        <div className="input-wrap"><Icon name="search" size={18} className="lead-ic" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${plural(role, t).toLowerCase()}`} aria-label="Search people" /></div>
      </div>}
      {role === 'pending' ? (
        <Async state={state}>
          {() => (pending.length ? (
            <div className="card sec"><div className="card-head"><h2>{pending.length} waiting</h2><button className="btn sm ghost" onClick={approveAll}>Approve everyone</button></div>
              <div className="card-body">{pending.map((p) => (
                <div className="person" key={p.id}>
                  <span className="avatar">{initials(p.name)}</span>
                  <div className="pr-main"><b>{p.name}</b><small>{p.sid}, {p.dept}{p.advisorName ? `, ${t.advisor}: ${p.advisorName}` : ''}</small></div>
                  <div className="pr-acts"><button className="btn sm" disabled={busyId === p.id} onClick={() => decide(p, 'approve')}>Approve</button><button className="btn sm danger" disabled={busyId === p.id} onClick={() => decide(p, 'reject')}>Decline</button></div>
                </div>))}</div></div>
          ) : <div className="empty"><p>Nobody is waiting. Students who sign up without a class code appear here.</p></div>)}
        </Async>
      ) : (
      <Async state={state}>
        {() => (
          <div className="card sec">
            <div className="card-body">
              {shown.length ? shown.map((p, i) => (
                <div className="person" key={p.id} style={{ '--i': i }}>
                  <span className="avatar">{initials(p.name)}</span>
                  <div className="pr-main">
                    <b>{p.name}{p.id === user.id && <span className="tag soft">You</span>}</b>
                    <small>{sub(p)}</small>
                    <div className="pr-tags">{extras(p)}</div>
                  </div>
                  <div className="pr-acts">
                    <button className="btn sm ghost" onClick={() => setModal({ kind: 'edit', p })}><Icon name="edit" size={15} />Edit</button>
                    <button className="btn sm ghost" onClick={() => setModal({ kind: 'pw', p })} aria-label={`New password for ${p.name}`}><Icon name="key" size={15} /><span className="hide-s">Password</span></button>
                    {p.id !== user.id && <button className="btn sm danger" onClick={() => setModal({ kind: 'rm', p })} aria-label={`Remove ${p.name}`}><Icon name="trash" size={15} /></button>}
                  </div>
                </div>
              )) : <Empty text={q ? 'Nobody matches your search.' : `No ${plural(role, t).toLowerCase()} yet.`} />}
            </div>
          </div>
        )}
      </Async>
      )}
      {modal?.kind === 'add' && <PersonForm role={role} courses={state.data?.courses.courses || []} onClose={close} onSaved={saved} onCreated={(d) => { setCreds({ name: d.person.name, sid: d.person.sid, email: d.person.email, password: d.temporaryPassword }); state.reload(); refreshMeta(); setModal(null); }} />}
      {modal?.kind === 'import' && <ImportModal role={role} onClose={close} onDone={() => { state.reload(); refreshMeta(); }} />}
      {creds && <Modal title="Account created" sub="Hand these sign-in details to the person." onClose={() => setCreds(null)} footer={<button className="btn" onClick={() => setCreds(null)}>Done</button>}><Credentials {...creds} /></Modal>}
      {modal?.kind === 'edit' && <PersonForm role={modal.p.role} person={modal.p} courses={state.data?.courses.courses || []} onClose={close} onSaved={saved} />}
      {modal?.kind === 'pw' && <PasswordForm person={modal.p} onClose={close} />}
      {modal?.kind === 'rm' && <RemoveForm person={modal.p} onClose={close} onSaved={saved} />}
    </>
  );
}
