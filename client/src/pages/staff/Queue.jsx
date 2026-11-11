import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Timeline, Photo } from '../../components/Stub';
import { Async, Empty, Hero, Pill, Stats } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { age, firstName, fmtStamp, greet, STEP_COLOR, STEPS } from '../../lib/format';

const STATUS_FILTERS = [['open', 'Open'], ['Submitted', 'New'], ['Acknowledged', 'Acknowledged'], ['In progress', 'In progress'], ['Resolved', 'Resolved'], ['all', 'All']];
const NEXT_LABEL = { Acknowledged: 'Acknowledge', 'In progress': 'Start work', Resolved: 'Mark resolved' };

function Drawer({ code, onClose, onChanged }) {
  const { meta, toast } = useApp();
  const [r, setR] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setR(null); setNote(''); setErr('');
    api(`/reports/${code}`).then((d) => live && setR(d.report)).catch((e) => { toast(e.message); onClose(); });
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { live = false; document.removeEventListener('keydown', onKey); };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn, msg) {
    setBusy(true);
    setErr('');
    try {
      const d = await fn();
      setR(d.report);
      setNote('');
      toast(msg(d.report));
      onChanged();
      if (d.stillVisible === false) onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const next = r && STEPS[STEPS.indexOf(r.status) + 1];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer enter" role="dialog" aria-modal="true" aria-labelledby="dt">
        {!r ? <div className="drawer-body"><div className="loading"><span className="spinner" />Loading report…</div></div> : (
          <>
            <div className="drawer-top">
              <div className="row"><div><span className="rid">{r.id}</span><h2 id="dt">{r.title}</h2></div>
                <button className="x" autoFocus onClick={onClose} aria-label="Close report">×</button></div>
              <div className="badges"><Pill status={r.status} />{r.priority === 'Urgent' ? <span className="tag urgent">Urgent</span> : <span className="small" style={{ opacity: 0.8 }}>{r.priority} priority</span>}</div>
            </div>
            <div className="drawer-body">
              <dl className="dl">
                <dt>Type</dt><dd>{r.category}</dd><dt>Where</dt><dd>{r.location}</dd><dt>Reported by</dt><dd>{r.reporterName}</dd>
                <dt>Filed</dt><dd>{fmtStamp(r.createdAt)}, {age(r.createdAt)}</dd><dt>Photo</dt><dd>{r.photo ? r.photo.name : 'None'}</dd>
              </dl>
              <p className="desc">{r.description}</p>
              <Photo photo={r.photo} />
              <div className="field"><label htmlFor="d-dept">Responsible office</label>
                <select id="d-dept" value={r.dept} disabled={busy} onChange={(e) => {
                  const dept = e.target.value;
                  run(() => api(`/reports/${r.id}/dept`, { method: 'PATCH', body: { dept } }), () => `${r.id} moved to ${dept}.`);
                }}>{meta.depts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
              <div className="field"><label htmlFor="d-note">Message to the reporter</label>
                <textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Technician assigned, visiting at 2 PM today." />{err && <span className="err">{err}</span>}</div>
              <div className="drawer-acts">
                {next && <button className="btn" disabled={busy} onClick={() => run(() => api(`/reports/${r.id}/advance`, { method: 'POST', body: { note } }), (x) => `${x.id} marked as ${x.status.toLowerCase()}. The reporter has been notified.`)}><Icon name="check" size={16} />{NEXT_LABEL[next]}</button>}
                <button className="btn ghost" disabled={busy} onClick={() => {
                  if (!note.trim()) { setErr('Write a message for the reporter first.'); document.getElementById('d-note')?.focus(); return; }
                  run(() => api(`/reports/${r.id}/message`, { method: 'POST', body: { note } }), () => 'Message sent to the reporter.');
                }}><Icon name="send" size={16} />Send message only</button>
              </div>
              <h3 className="mt">History</h3>
              <Timeline history={r.history} />
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export default function Queue() {
  const { user, meta } = useApp();
  const [status, setStatus] = useState('open');
  const [dept, setDept] = useState('all');
  const [openCode, setOpenCode] = useState(null);
  const q = new URLSearchParams({ status, dept }).toString();
  const state = useApi({ sum: '/reports/summary', list: `/reports?${q}` });

  return (
    <Async state={state}>
      {(d) => {
        const s = d.sum;
        const list = d.list.reports;
        const top = s.top;
        const right = top
          ? <div className="glass"><small>{top.priority === 'Urgent' ? 'Most urgent' : 'Waiting longest'}</small><b>{top.id}, {top.title}</b><p>{top.location}, {age(top.createdAt)}</p>
              <button className="btn white sm mt-s" onClick={() => setOpenCode(top.id)}>Open report</button></div>
          : <div className="glass"><small>All clear</small><b>No reports are waiting</b><p>New reports for your office show up here.</p></div>;
        const show = (st) => () => { setStatus(st); document.getElementById('queue-list')?.scrollIntoView({ behavior: 'smooth' }); };
        return (
          <>
            <Hero title={`${greet()}, ${firstName(user)}`} right={right}
              text={`${user.isAdmin ? 'All offices' : user.office}: ${s.counts.Submitted} new, ${s.total - s.counts.Resolved} open in total. Acknowledge new reports quickly so students know they were heard.`} />
            <Stats items={[
              ['inbox', 'sky', s.counts.Submitted, 'New reports', show('Submitted')],
              ['alert', 'peach', s.urgent.length, 'Urgent and open', show('open')],
              ['clock', 'butter', s.counts.Acknowledged + s.counts['In progress'], 'Being handled', show('open')],
              ['check', 'mint', s.resolvedWeek, 'Resolved this week', show('Resolved')],
            ]} />
            <section className="card card-pad sec">
              <h2>Status of {s.total} reports</h2>
              <div className="sbar" role="img" aria-label={STEPS.map((x) => `${s.counts[x]} ${x.toLowerCase()}`).join(', ')}>
                {STEPS.map((x) => (s.counts[x] ? <span key={x} style={{ flex: s.counts[x], background: STEP_COLOR[x] }} /> : null))}
              </div>
              <div className="legend">{STEPS.map((x) => <span key={x}><i style={{ background: STEP_COLOR[x] }} />{x}<b>{s.counts[x]}</b></span>)}</div>
              {s.urgent.length > 0 && (
                <div className="urgent-bar"><Icon name="alert" size={18} />
                  <span><b>{s.urgent.length === 1 ? '1 urgent report needs' : `${s.urgent.length} urgent reports need`} attention:</b>{' '}
                    {s.urgent.map((r, i) => <span key={r.id}>{i > 0 && '; '}<button className="link" onClick={() => setOpenCode(r.id)}>{r.id}, {r.title}</button></span>)}</span></div>
              )}
            </section>
            <div className="filters sec" id="queue-list">
              <div className="chips" role="group" aria-label="Status">
                {STATUS_FILTERS.map(([v, l]) => <button key={v} className="chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
              </div>
              {user.isAdmin
                ? <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Office"><option value="all">All offices</option>{meta?.depts.map((x) => <option key={x} value={x}>{x}</option>)}</select>
                : <span className="pill confirmed">{user.office}</span>}
            </div>
            {list.length ? (
              <div className="card queue">
                <div className="qhead"><span>Report</span><span>Problem</span><span>Office</span><span>Filed</span><span>Status</span></div>
                {list.map((r) => (
                  <button key={r.id} className={`qrow ${r.priority === 'Urgent' && r.status !== 'Resolved' ? 'urgent' : ''}`} onClick={() => setOpenCode(r.id)}>
                    <span className="qid">{r.id}{r.priority === 'Urgent' && <span className="tag urgent">Urgent</span>}</span>
                    <span className="qtitle"><b>{r.title}</b><small>{r.location}, by {r.reporterName}</small></span>
                    <span className="qdept">{r.dept}</span><span className="qage">{age(r.createdAt)}</span><span className="qst"><Pill status={r.status} /></span>
                  </button>
                ))}
              </div>
            ) : <div className="mt-s"><Empty text="No reports match these filters." /></div>}
            {openCode && <Drawer code={openCode} onClose={() => setOpenCode(null)} onChanged={state.reload} />}
          </>
        );
      }}
    </Async>
  );
}
