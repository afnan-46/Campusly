import { useState } from 'react';
import Icon from '../../components/Icon';
import Modal, { FieldErr, FormAlert, useSave } from '../../components/Modal';
import Credentials from '../../components/Credentials';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { age, fmtDay, fmtStamp, taka } from '../../lib/format';
import { typeLabel } from '../../lib/terms';

const TABS = [['open', 'Open'], ['approved', 'Approved'], ['rejected', 'Rejected']];
const stateOf = (s) => ({ new: ['warn', 'New'], reviewing: ['warn', 'Reviewing'], approved: ['ok', 'Approved'], rejected: ['bad', 'Rejected'] }[s]);

function Detail({ app, onClose, onChanged }) {
  const [run, busy, errs, msg] = useSave();
  const [mode, setMode] = useState(null); // reject | approve
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [creds, setCreds] = useState(null);
  const [cur, setCur] = useState(app);
  const open = ['new', 'reviewing'].includes(cur.status);
  const p = cur.payment;
  const post = (path, body, ok) => run(() => api(`/company/applications/${cur.id}/${path}`, { method: 'POST', body }), ok);

  async function approve() {
    const d = await post('approve', {}, 'Approved. The institution and its admin are ready.');
    if (d && d.credentials) { setCreds(d.credentials); setCur(d.application); onChanged(); }
  }
  async function reject() {
    const d = await post('reject', { reason }, 'Application rejected.');
    if (d && d.application) { setCur(d.application); setMode(null); onChanged(); }
  }
  async function review() { const d = await post('review', {}); if (d && d.application) { setCur(d.application); onChanged(); } }
  async function addNote() { const d = await post('note', { text: note }); if (d && d.application) { setCur(d.application); setNote(''); } }

  if (creds) {
    return (
      <Modal title="Institution is ready" sub="Send these sign-in details to the contact person." onClose={onClose}
        footer={<button className="btn" onClick={onClose}>Done</button>}>
        <Credentials {...creds} note="Send this to the admin by phone or email. This password is shown only now. They must change it on first sign-in." />
      </Modal>
    );
  }

  return (
    <Modal wide title={cur.institution.name} sub={`${cur.code}, applied ${age(cur.createdAt)}`} onClose={onClose}
      footer={open ? (mode === 'reject' ? (
        <><button className="btn ghost" onClick={() => setMode(null)}>Back</button><button className="btn" disabled={busy} onClick={reject}>Reject application</button></>
      ) : mode === 'approve' ? (
        <><button className="btn ghost" onClick={() => setMode(null)}>Back</button><button className="btn" disabled={busy} onClick={approve}>{busy ? 'Creating…' : 'Yes, approve and create'}</button></>
      ) : (
        <>
          {cur.status === 'new' && <button className="btn ghost" disabled={busy} onClick={review}>Start review</button>}
          <button className="btn danger" onClick={() => setMode('reject')}>Reject</button>
          <button className="btn" onClick={() => setMode('approve')}>Approve</button>
        </>
      )) : <button className="btn ghost" onClick={onClose}>Close</button>}>
      <FormAlert msg={msg} />
      {mode === 'approve' && <div className="alert warn" role="status"><Icon name="info" size={18} /><span>This creates {cur.institution.name} on {cur.planName}{p.trial ? ' (free trial)' : ''} and an admin account for {cur.contact.name}. Make sure the {p.trial ? 'application looks right' : `payment ${p.trxId} arrived`}.</span></div>}
      {mode === 'reject' && (
        <div className="field"><label htmlFor="rj">Reason (the institution can see this)</label><textarea id="rj" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Transaction ID not found in our bKash account." /></div>
      )}
      <div className="row-between"><h3>Status</h3><span className={`dotline ${stateOf(cur.status)[0]}`}>{stateOf(cur.status)[1]}</span></div>
      {cur.rejectReason && <p className="muted mt-xs">Reason: {cur.rejectReason}</p>}
      <dl className="detail-grid mt-s">
        <dt>Institution</dt><dd>{typeLabel(cur.institution.type)}, {cur.institution.city}{cur.institution.address ? `, ${cur.institution.address}` : ''}</dd>
        <dt>Students</dt><dd>About {cur.students}</dd>
        <dt>Contact</dt><dd>{cur.contact.name}{cur.contact.designation ? `, ${cur.contact.designation}` : ''}</dd>
        <dt>Email</dt><dd>{cur.contact.email}</dd>
        <dt>Phone</dt><dd>{cur.contact.phone}</dd>
        <dt>Plan</dt><dd>{cur.planName}, {cur.cycleName}</dd>
        <dt>Payment</dt><dd>{p.trial ? 'Free trial, nothing to pay' : <>{taka(p.amount)} by {cur.methodLabel} from {p.payerNumber}<br />Transaction ID: <b className="mono">{p.trxId}</b></>}</dd>
        {cur.message && <><dt>Message</dt><dd>{cur.message}</dd></>}
      </dl>
      <h3 style={{ marginTop: 18 }}>Team notes</h3>
      <ul className="note-list">{(cur.notes || []).map((n, i) => <li key={i}>{n.text}<small>{n.by}, {fmtStamp(n.at)}</small></li>)}{!(cur.notes || []).length && <li>No notes yet.</li>}</ul>
      {open && (
        <div className="inline"><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a private note for the team" aria-label="Add a note" />
          <button className="btn soft sm" disabled={busy || !note.trim()} onClick={addNote}>Add note</button></div>
      )}
    </Modal>
  );
}

export default function Applications() {
  const [tab, setTab] = useState('open');
  const [openApp, setOpenApp] = useState(null);
  const state = useApi(`/company/applications?status=${tab}`, [tab]);
  const counts = state.data ? state.data.counts : { new: 0, reviewing: 0, approved: 0, rejected: 0 };
  const n = { open: counts.new + counts.reviewing, approved: counts.approved, rejected: counts.rejected };
  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}<span className={`n${k === 'open' && n.open ? ' hot' : ''}`}>{n[k]}</span></button>)}
      </div>
      <Async state={state}>
        {(d) => (d.applications.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Institution</th><th>Plan</th><th>Payment</th><th>Applied</th><th>Status</th></tr></thead>
            <tbody>
              {d.applications.map((a) => (
                <tr key={a.id} className="click" tabIndex={0} onClick={() => setOpenApp(a)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenApp(a); }}>
                  <td><b>{a.institution.name}</b><small>{a.code}, {typeLabel(a.institution.type)}, {a.institution.city}</small></td>
                  <td>{a.planName}<small>{a.cycleName}</small></td>
                  <td>{a.payment.trial ? 'Free trial' : <>{taka(a.payment.amount)}<small>{a.methodLabel} {a.payment.trxId}</small></>}</td>
                  <td className="nowrap">{age(a.createdAt)}</td>
                  <td><span className={`dotline ${stateOf(a.status)[0]}`}>{stateOf(a.status)[1]}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <div className="empty"><p>{tab === 'open' ? 'No applications waiting. New ones appear here.' : `No ${tab} applications yet.`}</p></div>)}
      </Async>
      {openApp && <Detail app={openApp} onClose={() => { setOpenApp(null); state.reload(); }} onChanged={state.reload} />}
    </>
  );
}
