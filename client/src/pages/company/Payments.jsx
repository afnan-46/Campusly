import { useState } from 'react';
import Modal, { FormAlert, useSave } from '../../components/Modal';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { age, fmtDay, taka } from '../../lib/format';

const TABS = [['pending', 'To check'], ['verified', 'Confirmed'], ['rejected', 'Rejected']];

export default function Payments() {
  const [tab, setTab] = useState('pending');
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState('');
  const [run, busy, , msg] = useSave();
  const state = useApi(`/company/payments?status=${tab}`, [tab]);
  const verify = async (p) => { if (await run(() => api(`/company/payments/${p.id}/verify`, { method: 'POST' }), `Confirmed. ${p.institutionName} is active.`)) state.reload(); };
  const reject = async () => { if (await run(() => api(`/company/payments/${rej.id}/reject`, { method: 'POST', body: { reason } }), 'Payment rejected.')) { setRej(null); setReason(''); state.reload(); } };
  return (
    <>
      <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      <p className="hint" style={{ marginBottom: 12 }}>Check each transaction ID in the bKash or Nagad merchant account before confirming. Confirming extends the institution's plan.</p>
      <Async state={state}>
        {(d) => (d.payments.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Institution</th><th>For</th><th>Amount</th><th>Transaction</th><th>Sent</th>{tab === 'pending' && <th />}</tr></thead>
            <tbody>{d.payments.map((p) => (
              <tr key={p.id}>
                <td><b>{p.institutionName}</b><small>{p.kind === 'new' ? 'First payment' : p.kind === 'change' ? 'Plan change' : 'Renewal'}</small></td>
                <td>{p.planName}<small>{p.cycleName}</small></td>
                <td><b>{taka(p.amount)}</b></td>
                <td><span className="mono">{p.trxId}</span><small>{p.methodLabel} from {p.payerNumber}</small></td>
                <td className="nowrap">{age(p.createdAt)}{p.rejectReason && <small>{p.rejectReason}</small>}</td>
                {tab === 'pending' && <td className="right nowrap"><button className="btn sm" disabled={busy} onClick={() => verify(p)}>Confirm</button> <button className="btn sm ghost" onClick={() => setRej(p)}>Reject</button></td>}
              </tr>))}</tbody>
          </table></div>
        ) : <div className="empty"><p>{tab === 'pending' ? 'No payments waiting. Renewals show up here.' : 'Nothing here yet.'}</p></div>)}
      </Async>
      {rej && (
        <Modal title="Reject payment" sub={`${rej.institutionName}, ${rej.trxId}`} onClose={() => setRej(null)}
          footer={<><button className="btn ghost" onClick={() => setRej(null)}>Cancel</button><button className="btn" disabled={busy} onClick={reject}>Reject payment</button></>}>
          <FormAlert msg={msg} />
          <div className="field"><label htmlFor="pr">Reason (the admin sees this)</label><input id="pr" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Transaction ID not found" /></div>
        </Modal>
      )}
    </>
  );
}
