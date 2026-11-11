import { useState } from 'react';
import Modal, { FieldErr, FormAlert, useSave } from '../../components/Modal';
import Credentials from '../../components/Credentials';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { fmtDay, taka } from '../../lib/format';
import { typeLabel } from '../../lib/terms';

const stateOf = (i) => {
  const a = i.access;
  if (a.state === 'suspended') return ['bad', 'Paused'];
  if (a.state === 'expired') return ['bad', 'Expired'];
  return a.trial ? ['warn', 'Free trial'] : ['ok', 'Active'];
};

function Detail({ inst: first, owner, onClose }) {
  const [run, busy, errs, msg] = useSave();
  const [i, setI] = useState(first);
  const [mode, setMode] = useState(null);
  const [text, setText] = useState('');
  const [adm, setAdm] = useState({ name: '', email: '' });
  const [creds, setCreds] = useState(null);
  const [s, label] = stateOf(i);
  const post = (path, body, ok) => run(() => api(`/company/institutions/${i.id}/${path}`, { method: 'POST', body }), ok);
  async function go(path, body, ok) {
    const d = await post(path, body, ok);
    if (d && d.institution) { setI(d.institution); setMode(null); setText(''); if (d.credentials) setCreds(d.credentials); }
  }
  if (creds) return <Modal title="Admin added" sub={i.name} onClose={() => setCreds(null)} footer={<button className="btn" onClick={() => setCreds(null)}>Done</button>}><Credentials {...creds} /></Modal>;
  return (
    <Modal wide title={i.name} sub={`${typeLabel(i.type)}, ${i.city}`} onClose={onClose}
      footer={<button className="btn ghost" onClick={onClose}>Close</button>}>
      <FormAlert msg={msg} />
      <div className="row-between"><h3>Plan</h3><span className={`dotline ${s === 'ok' ? 'ok' : s === 'warn' ? 'warn' : 'bad'}`}>{label}</span></div>
      <dl className="detail-grid mt-s">
        <dt>Plan</dt><dd>{i.access.plan || 'No plan'}{i.subscription ? `, ${i.subscription.cycle}` : ''}</dd>
        <dt>Ends</dt><dd>{i.subscription ? `${fmtDay(i.subscription.endsAt)} (${i.access.daysLeft} days left)` : 'No end date'}</dd>
        <dt>People</dt><dd>{i.counts.student} students, {i.counts.faculty} teachers, {i.counts.staff} staff</dd>
        <dt>Open reports</dt><dd>{i.counts.openReports}</dd>
        <dt>Paid so far</dt><dd>{taka(i.totalPaid)}</dd>
        {i.suspendReason && <><dt>Paused because</dt><dd>{i.suspendReason}</dd></>}
        <dt>Admins</dt><dd>{i.admins.map((a) => <div key={a.id}>{a.name}, {a.email}{a.phone ? `, ${a.phone}` : ''}</div>)}</dd>
      </dl>
      {owner ? (
        <>
          {mode === 'suspend' && (<div className="field"><label htmlFor="sp">Why are you pausing access? (the admin sees this)</label><input id="sp" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Payment overdue" />
            <div className="inline"><button className="btn sm" disabled={busy} onClick={() => go('suspend', { reason: text }, 'Access paused.')}>Pause access</button><button className="btn sm ghost" onClick={() => setMode(null)}>Cancel</button></div></div>)}
          {mode === 'extend' && (<div className="field"><label htmlFor="ex">Add how many days?</label><input id="ex" type="number" min="1" max="365" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 7" />
            <div className="inline"><button className="btn sm" disabled={busy} onClick={() => go('extend', { days: Number(text) }, 'Plan extended.')}>Extend plan</button><button className="btn sm ghost" onClick={() => setMode(null)}>Cancel</button></div></div>)}
          {mode === 'admin' && (<div className="field"><span className="label">Add another admin</span>
            <div className="two"><div><input type="text" value={adm.name} onChange={(e) => setAdm({ ...adm, name: e.target.value })} placeholder="Full name" aria-label="Admin name" /><FieldErr errs={errs} k="name" /></div>
              <div><input type="text" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} placeholder="Email" aria-label="Admin email" /><FieldErr errs={errs} k="email" /></div></div>
            <div className="inline"><button className="btn sm" disabled={busy} onClick={() => go('admins', adm, 'Admin added.')}>Create admin</button><button className="btn sm ghost" onClick={() => setMode(null)}>Cancel</button></div></div>)}
          {!mode && (
            <div className="inline" style={{ marginTop: 18 }}>
              {i.access.state === 'suspended'
                ? <button className="btn sm" disabled={busy} onClick={() => go('reactivate', {}, 'Access restored.')}>Restore access</button>
                : <button className="btn sm danger" onClick={() => setMode('suspend')}>Pause access</button>}
              <button className="btn sm ghost" onClick={() => setMode('extend')}>Give extra days</button>
              <button className="btn sm ghost" onClick={() => setMode('admin')}>Add an admin</button>
            </div>
          )}
        </>
      ) : <p className="hint mt-s">Only the owner can pause, extend or add admins.</p>}
    </Modal>
  );
}

export default function Institutions() {
  const { user } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const state = useApi('/company/institutions');
  return (
    <>
      <div className="toolbar"><input className="grow" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search institutions" aria-label="Search institutions" /></div>
      <Async state={state}>
        {(d) => {
          const list = d.institutions.filter((i) => `${i.name} ${i.city} ${i.shortName}`.toLowerCase().includes(q.toLowerCase()));
          return list.length ? (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Institution</th><th>Plan</th><th>Status</th><th>Students</th><th>Paid</th></tr></thead>
              <tbody>{list.map((i) => { const [s, l] = stateOf(i); return (
                <tr key={i.id} className="click" tabIndex={0} onClick={() => setOpen(i)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(i); }}>
                  <td><b>{i.name}</b><small>{typeLabel(i.type)}, {i.city}</small></td>
                  <td>{i.access.plan || '-'}<small>{i.subscription ? `${i.access.daysLeft} days left` : ''}</small></td>
                  <td><span className={`dotline ${s}`}>{l}</span></td>
                  <td>{i.counts.student}</td>
                  <td>{taka(i.totalPaid)}</td>
                </tr>); })}</tbody>
            </table></div>
          ) : <div className="empty"><p>No institutions match.</p></div>;
        }}
      </Async>
      {open && <Detail inst={open} owner={user.role === 'superadmin'} onClose={() => { setOpen(null); state.reload(); }} />}
    </>
  );
}
