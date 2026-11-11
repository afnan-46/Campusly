import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import Modal, { FormAlert, useSave } from '../../components/Modal';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';

export default function Offices() {
  const { refreshMeta } = useApp();
  const nav = useNavigate();
  const state = useApi('/admin/offices');
  const [name, setName] = useState('');
  const [modal, setModal] = useState(null);
  const [val, setVal] = useState('');
  const [run, busy, , msg] = useSave();
  const [runRoute] = useSave();

  // Every change returns the full list, so show it straight away.
  const apply = (d) => { if (d && d.offices) { state.setData(d); refreshMeta(); } return d; };
  const close = () => { setModal(null); setVal(''); };

  async function add(e) {
    e.preventDefault();
    if (apply(await run(() => api('/admin/offices', { method: 'POST', body: { name } }), `${name.trim()} added.`))) setName('');
  }

  return (
    <Async state={state}>
      {(d) => (
        <>
          <p className="lead">Offices receive reports and work through them. Choose which office handles each kind of report, and add staff to each office on the People page.</p>
          <form className="add-office sec" onSubmit={add}>
            <div className="input-wrap"><Icon name="building" size={18} className="lead-ic" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="New office name, e.g. Library" aria-label="New office name" /></div>
            <button className="btn" type="submit" disabled={busy || !name.trim()}><Icon name="plus" size={16} />Add office</button>
          </form>
          {!modal && <FormAlert msg={msg} />}
          <div className="office-grid sec">
            {d.offices.map((o, i) => (
              <article className="office-card" key={o.name} style={{ '--i': i }}>
                <div className="oc-top">
                  <span className="oc-ic"><Icon name="building" size={20} /></span>
                  <h3>{o.name}</h3>
                  {o.open > 0 && <span className="tag soft">{o.open} open</span>}
                </div>
                <p className="cc-line"><Icon name="users" size={15} />{o.staff.length ? o.staff.join(', ') : <span className="tag warn">No staff yet</span>}</p>
                <div className="pr-tags">{o.categories.length ? o.categories.map((c) => <span className="tag soft" key={c}>{c}</span>) : <span className="hint">Receives no report types yet.</span>}</div>
                <div className="cc-acts">
                  {!o.staff.length && <button className="btn sm soft" onClick={() => nav('/people?role=staff&add=1')}><Icon name="plus" size={15} />Add staff</button>}
                  <button className="btn sm ghost" onClick={() => { setModal({ kind: 'rename', o }); setVal(o.name); }}><Icon name="edit" size={15} />Rename</button>
                  {d.offices.length > 1 && <button className="btn sm danger" onClick={() => { setModal({ kind: 'rm', o }); setVal(d.offices.find((x) => x.name !== o.name).name); }} aria-label={`Remove ${o.name}`}><Icon name="trash" size={15} /></button>}
                </div>
              </article>
            ))}
          </div>
          <section className="card sec">
            <div className="card-head"><h2><Icon name="send" size={18} />Where each kind of report goes</h2><span className="hint">Changes apply to new reports.</span></div>
            <div className="card-body">
              {d.categories.map((c) => (
                <div className="route-row" key={c.name}>
                  <span className="ct"><Icon name={c.ic} size={18} /></span>
                  <span className="rr-txt"><b>{c.name}</b><small>{c.desc}</small></span>
                  <Icon name="arrowr" size={16} className="muted hide-s" />
                  <select value={c.dept} aria-label={`Office for ${c.name}`}
                    onChange={async (e) => { const dept = e.target.value; apply(await runRoute(() => api('/admin/categories', { method: 'PATCH', body: { name: c.name, dept } }), `${c.name} reports now go to ${dept}.`)); }}>
                    {d.offices.map((o) => <option key={o.name}>{o.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>
          {modal?.kind === 'rename' && (
            <Modal title={`Rename ${modal.o.name}`} sub="Staff, report types and existing reports move to the new name." onClose={close}
              footer={<><button className="btn ghost" onClick={close}>Cancel</button>
                <button className="btn" disabled={busy} onClick={async () => { if (apply(await run(() => api('/admin/offices', { method: 'PATCH', body: { from: modal.o.name, to: val } }), 'Office renamed.'))) close(); }}>Save</button></>}>
              <FormAlert msg={msg} />
              <div className="field"><label htmlFor="o-name">Office name</label><input id="o-name" type="text" value={val} onChange={(e) => setVal(e.target.value)} /></div>
            </Modal>
          )}
          {modal?.kind === 'rm' && (
            <Modal title={`Remove ${modal.o.name}?`} sub="Its staff, report types and reports move to the office you choose." onClose={close}
              footer={<><button className="btn ghost" onClick={close}>Keep</button>
                <button className="btn danger" disabled={busy} onClick={async () => { if (apply(await run(() => api('/admin/offices', { method: 'DELETE', body: { name: modal.o.name, moveTo: val } }), `${modal.o.name} removed.`))) close(); }}><Icon name="trash" size={16} />Remove</button></>}>
              <FormAlert msg={msg} />
              <div className="field"><label htmlFor="o-move">Move everything to</label>
                <select id="o-move" value={val} onChange={(e) => setVal(e.target.value)}>{d.offices.filter((o) => o.name !== modal.o.name).map((o) => <option key={o.name}>{o.name}</option>)}</select></div>
            </Modal>
          )}
        </>
      )}
    </Async>
  );
}
