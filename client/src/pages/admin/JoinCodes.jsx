import { useState } from 'react';
import Icon from '../../components/Icon';
import Modal, { FieldErr, FormAlert, useSave } from '../../components/Modal';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { fmtDay } from '../../lib/format';

function NewCode({ onClose, onSaved }) {
  const { meta, terms: t } = useApp();
  const [f, setF] = useState({ group: meta?.programs?.[0] || '', advisorId: '', expiresAt: '' });
  const [run, busy, errs, msg] = useSave();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() { if (await run(() => api('/admin/join-codes', { method: 'POST', body: f }), 'Code created.')) onSaved(); }
  return (
    <Modal title="New class code" sub="Students who enter this code join the right class straight away. No approval needed." onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>Create code</button></>}>
      <FormAlert msg={Object.keys(errs).length ? '' : msg} />
      <div className="field"><label htmlFor="jc-g">{t.group}</label><select id="jc-g" value={f.group} onChange={set('group')}>{(meta?.programs || []).map((p) => <option key={p}>{p}</option>)}</select><FieldErr errs={errs} k="group" /></div>
      <div className="field"><label htmlFor="jc-a">{t.advisorLong}</label><select id="jc-a" value={f.advisorId} onChange={set('advisorId')}><option value="">Not assigned</option>{(meta?.advisors || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><FieldErr errs={errs} k="advisorId" /></div>
      <div className="field"><label htmlFor="jc-e">Stops working on <span className="muted">(optional)</span></label><input id="jc-e" type="date" value={f.expiresAt} onChange={set('expiresAt')} /><FieldErr errs={errs} k="expiresAt" /></div>
    </Modal>
  );
}

export default function JoinCodes() {
  const { toast, terms: t } = useApp();
  const state = useApi('/admin/join-codes');
  const [adding, setAdding] = useState(false);
  const link = (c) => `${window.location.origin}/join/${c.code}`;
  async function copy(c) { try { await navigator.clipboard.writeText(link(c)); toast('Link copied. Share it with your students.'); } catch { toast(link(c)); } }
  async function toggle(c) { try { await api(`/admin/join-codes/${c.id}`, { method: 'PATCH', body: { active: !c.active } }); state.reload(); } catch (e) { toast(e.message); } }
  async function remove(c) { try { await api(`/admin/join-codes/${c.id}`, { method: 'DELETE' }); toast('Code deleted.'); state.reload(); } catch (e) { toast(e.message); } }
  return (
    <>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ maxWidth: 560 }}>Give each {t.group.toLowerCase()} a code. Students open the link or type the code, enter their details, and they are in. Anyone without a code waits for your approval.</p>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New code</button>
      </div>
      <Async state={state}>
        {(d) => (d.codes.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Code</th><th>{t.group}</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>{d.codes.map((c) => {
              const ended = c.expiresAt && new Date(c.expiresAt) < new Date();
              return (
                <tr key={c.id}>
                  <td><span className="joincode">{c.code}</span></td>
                  <td><b>{c.group}</b><small>{c.advisorName ? `${t.advisor}: ${c.advisorName}` : 'No teacher set'}</small></td>
                  <td>{c.uses}</td>
                  <td>{ended ? <span className="dotline grey">Ended {fmtDay(c.expiresAt)}</span> : c.active ? <span className="dotline ok">On{c.expiresAt ? ` until ${fmtDay(c.expiresAt)}` : ''}</span> : <span className="dotline grey">Off</span>}</td>
                  <td className="right nowrap">
                    <button className="btn sm soft" onClick={() => copy(c)}><Icon name="link" size={15} />Copy link</button>{' '}
                    <button className="btn sm ghost" onClick={() => toggle(c)}>{c.active ? 'Turn off' : 'Turn on'}</button>{' '}
                    <button className="btn sm danger" onClick={() => remove(c)} aria-label={`Delete code ${c.code}`}><Icon name="trash" size={15} /></button>
                  </td>
                </tr>);
            })}</tbody>
          </table></div>
        ) : <div className="empty"><p>No class codes yet. Create one and share the link in your class group.</p></div>)}
      </Async>
      {adding && <NewCode onClose={() => setAdding(false)} onSaved={() => { setAdding(false); state.reload(); }} />}
    </>
  );
}
