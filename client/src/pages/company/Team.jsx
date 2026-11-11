import { useState } from 'react';
import Modal, { FieldErr, FormAlert, useSave } from '../../components/Modal';
import Credentials from '../../components/Credentials';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';

export default function Team() {
  const { user } = useApp();
  const state = useApi('/company/team');
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: '', email: '', title: '' });
  const [creds, setCreds] = useState(null);
  const [run, busy, errs, msg] = useSave();
  async function create() {
    const d = await run(() => api('/company/team', { method: 'POST', body: f }), 'Team member added.');
    if (d && d.credentials) { setCreds(d.credentials); setAdd(false); setF({ name: '', email: '', title: '' }); state.reload(); }
  }
  async function remove(m) { if (await run(() => api(`/company/team/${m.id}`, { method: 'DELETE' }), `${m.name} was removed.`)) state.reload(); }
  return (
    <Async state={state}>
      {(d) => (
        <>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <p className="muted">People who can sign in to the Campusly company portal. Staff read applications and confirm payments. Only the owner can pause institutions and manage the team.</p>
            {d.canManage && <button className="btn" onClick={() => setAdd(true)}>Add team member</button>}
          </div>
          <FormAlert msg={!add ? msg : ''} />
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Name</th><th>Role</th><th>Email</th>{d.canManage && <th />}</tr></thead>
            <tbody>{d.team.map((m) => (
              <tr key={m.id}><td><b>{m.name}</b><small>{m.title}</small></td><td>{m.role === 'superadmin' ? 'Owner' : 'Office staff'}</td><td>{m.email}</td>
                {d.canManage && <td className="right">{m.role === 'company' && <button className="btn sm danger" disabled={busy} onClick={() => remove(m)}>Remove</button>}</td>}</tr>))}</tbody>
          </table></div>
          {add && (
            <Modal title="Add team member" sub="They get a temporary password and choose their own on first sign-in." onClose={() => setAdd(false)}
              footer={<><button className="btn ghost" onClick={() => setAdd(false)}>Cancel</button><button className="btn" disabled={busy} onClick={create}>Create account</button></>}>
              <FormAlert msg={msg} />
              <div className="field"><label htmlFor="t-n">Full name</label><input id="t-n" type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><FieldErr errs={errs} k="name" /></div>
              <div className="field"><label htmlFor="t-e">Work email</label><input id="t-e" type="text" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /><FieldErr errs={errs} k="email" /></div>
              <div className="field"><label htmlFor="t-t">Job title</label><input id="t-t" type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Accounts" /></div>
            </Modal>
          )}
          {creds && <Modal title="Team member added" onClose={() => setCreds(null)} footer={<button className="btn" onClick={() => setCreds(null)}>Done</button>}><Credentials {...creds} /></Modal>}
        </>
      )}
    </Async>
  );
}
