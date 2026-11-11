import { useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { fmtStamp, sc, STEPS } from '../lib/format';
import Icon from './Icon';

const hLabel = (h) => (h.kind === 'comment' ? 'More information from reporter' : h.kind === 'update' ? 'Message from office'
  : h.kind === 'reassign' ? 'Moved to another office' : h.kind === 'reopen' ? 'Reopened' : h.status);

export function Timeline({ history }) {
  return (
    <ol className="timeline">
      {history.map((h, i) => (
        <li key={i}><time>{fmtStamp(h.at)}</time><b>{hLabel(h)}</b>{h.by && <> <span className="muted">by {h.by}</span></>}{h.note && <p>{h.note}</p>}</li>
      ))}
    </ol>
  );
}

export function Photo({ photo }) {
  if (!photo) return null;
  return (
    <a className="photo-link" href={photo.url} target="_blank" rel="noreferrer">
      <img src={photo.url} alt={`Photo attached to the report: ${photo.name}`} loading="lazy" />
      <span><Icon name="image" size={14} />{photo.name}</span>
    </a>
  );
}

// A report shown as a ticket stub with a status track. `full` adds details and actions.
export default function Stub({ r, full, expanded, onToggle, onChanged }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const idx = STEPS.indexOf(r.status);
  const last = [...r.history].reverse().find((h) => h.note && h.kind !== 'comment');

  async function post(path, body, msg) {
    setBusy(true);
    try {
      await api(`/reports/${r.id}/${path}`, { method: 'POST', body });
      setText('');
      toast(msg);
      onChanged?.();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="stub" data-s={sc(r.status)}>
      <div className="stub-id"><span className="id">{r.id}</span><span className="cat-name">{r.category}</span>{r.priority === 'Urgent' && <span className="tag urgent">Urgent</span>}</div>
      <div className="stub-body">
        <h3>{r.title}</h3>
        <p className="muted small">{r.location}. Sent to {r.dept} on {fmtStamp(r.createdAt)}.</p>
        <ol className="track" aria-label={`Status: ${r.status}`}>
          {STEPS.map((s, i) => <li key={s} className={`${i < idx || r.status === 'Resolved' ? 'done' : ''} ${i === idx ? 'now' : ''}`}>{s}</li>)}
        </ol>
        {last && <p className="latest"><b>{last.by}:</b> {last.note}</p>}
        {full && <button className="link mt-s small" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Hide details' : `Details and history (${r.history.length})`}</button>}
        {full && expanded && (
          <div className="details">
            <p>{r.description}</p>
            <Photo photo={r.photo} />
            {r.anonymous && <p className="hint mt-s">Filed anonymously. The office cannot see your name.</p>}
            <Timeline history={r.history} />
            {r.status !== 'Resolved' ? (
              <>
                <div className="field"><label htmlFor={`c-${r.id}`}>Add information</label>
                  <textarea id={`c-${r.id}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. it's getting worse, or another room has the same problem" /></div>
                <button className="btn sm ghost mt-s" disabled={busy} onClick={() => {
                  if (!text.trim()) { toast('Write something before adding it to the report.'); return; }
                  post('comment', { note: text }, `Added to ${r.id}.`);
                }}>Add to report</button>
              </>
            ) : <button className="btn sm ghost mt-s" disabled={busy} onClick={() => post('reopen', {}, `${r.id} reopened. The office has been told.`)}>It's still not fixed</button>}
          </div>
        )}
      </div>
    </article>
  );
}
