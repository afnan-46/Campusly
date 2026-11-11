import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { Loading } from '../components/ui';
import { api, outbox } from '../lib/api';
import { useApp } from '../context/AppContext';

const blank = { category: null, title: '', location: '', description: '', priority: 'Normal', anonymous: false };

export default function ReportForm() {
  const { meta, toast, user, terms: t } = useApp();
  const nav = useNavigate();
  const [d, setD] = useState(blank);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!photo) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if (!meta) return <Loading />;
  const cat = meta.categories.find((c) => c.name === d.category);
  const sensitive = d.category === 'Safety incident' || d.category === 'Misconduct or bullying';
  const e = (k) => errs[k] && <span className="err">{errs[k]}</span>;

  function pickCat(name) {
    setD((x) => ({ ...x, category: name, priority: name === 'Safety incident' && x.priority === 'Normal' ? 'Urgent' : x.priority }));
    setErrs((x) => ({ ...x, category: undefined }));
  }

  function pickPhoto(ev) {
    const file = ev.target.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) { setErrs((x) => ({ ...x, photo: 'The photo must be smaller than 5 MB.' })); ev.target.value = ''; return; }
    setErrs((x) => ({ ...x, photo: undefined }));
    setPhoto(file);
  }

  async function submit() {
    // Quick checks here; the server validates again.
    const v = {};
    if (!d.category) v.category = 'Choose the kind of problem.';
    if (d.title.trim().length < 6) v.title = 'Add a title of at least 6 characters.';
    if (!d.location.trim()) v.location = 'Say where the problem is.';
    if (d.description.trim().length < 15) v.description = 'Describe the problem in a sentence or two.';
    setErrs(v);
    if (Object.keys(v).length) {
      const id = { title: 'r-title', location: 'r-loc', description: 'r-desc' }[Object.keys(v).find((k) => k !== 'category')];
      if (id) document.getElementById(id)?.focus();
      return;
    }
    const form = new FormData();
    Object.entries(d).forEach(([k, val]) => form.append(k, String(val)));
    if (photo) form.append('photo', photo);
    setBusy(true);
    setErr('');
    try {
      const res = await api('/reports', { method: 'POST', form });
      toast(`Report ${res.report.id} sent to ${res.report.dept}.`);
      nav('/reports', { state: { justFiled: res.report.id } });
    } catch (ex) {
      if (ex.status === 0) {
        // No internet: keep the report on this phone and send it later.
        outbox.add({ owner: user.id, body: d });
        toast(photo ? 'Saved on this device without the photo. It will be sent when you are back online.' : 'Saved on this device. It will be sent when you are back online.');
        nav('/reports');
        return;
      }
      setErrs(ex.fields || {});
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="filters"><Link className="link back" to="/reports"><Icon name="arrowl" size={16} />Back to my reports</Link></div>
      <p className="lead">Tell your {t.inst} what's wrong and where. Your report gets a tracking number and goes straight to the office responsible for it.</p>
      <div className="card card-pad sec">
        <div className="step-h"><span className="step-n">1</span><h2 id="cat-l">What kind of problem is it?</h2></div>
        <div className="cats" role="group" aria-labelledby="cat-l">
          {meta.categories.map((c, i) => (
            <button key={c.name} className="cat" data-t={i} aria-pressed={d.category === c.name} onClick={() => pickCat(c.name)}>
              <span className="ct"><Icon name={c.ic} size={19} /></span><span><b>{c.name}</b><span>{c.desc}</span></span>
            </button>
          ))}
        </div>
        {e('category')}
        {cat && <p className="routed"><Icon name="send" size={16} /><span>This report goes to <b>{cat.dept}</b>.</span></p>}
        {sensitive && <p className="callout"><Icon name="alert" size={18} /><span>If someone is in danger right now, call 999 or tell a teacher or security guard first. Then file this report so it is on record.</span></p>}

        <div className="step-h mt"><span className="step-n">2</span><h2>Describe it</h2></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="r-title">Short title</label>
            <input id="r-title" type="text" maxLength={90} value={d.title} onChange={(ev) => set('title', ev.target.value)} placeholder="e.g. PC 12 in Lab 532 won't start" />{e('title')}</div>
          <div className="field"><label htmlFor="r-loc">Where is it?</label>
            <div className="input-wrap"><Icon name="pin" size={18} className="lead-ic" />
              <input id="r-loc" type="text" list="locs" maxLength={80} value={d.location} onChange={(ev) => set('location', ev.target.value)} placeholder="Room, lab or area" /></div>
            <datalist id="locs">{meta.locations.map((l) => <option key={l} value={l} />)}</datalist>{e('location')}</div>
        </div>
        <div className="field"><label htmlFor="r-desc">What happened?</label>
          <textarea id="r-desc" maxLength={2000} value={d.description} onChange={(ev) => set('description', ev.target.value)} placeholder="Describe the problem, when you noticed it, and who is affected." />{e('description')}</div>
        <div className="form-grid">
          <div className="field"><span className="label" id="prio-l">How urgent is it?</span>
            <div className="seg" role="group" aria-labelledby="prio-l">
              {['Low', 'Normal', 'Urgent'].map((p) => <button key={p} aria-pressed={d.priority === p} onClick={() => set('priority', p)}>{p}</button>)}
            </div>
            <span className="hint">Urgent reports go to the top of the office's queue.</span></div>
          <div className="field"><label htmlFor="r-photo">Photo (optional)</label>
            <input id="r-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickPhoto} />
            {preview && <div className="photo-preview"><img src={preview} alt="Selected photo" /><button className="link small" onClick={() => { setPhoto(null); document.getElementById('r-photo').value = ''; }}>Remove photo</button></div>}
            {e('photo') || <span className="hint">JPG, PNG, WebP or GIF, up to 5 MB.</span>}</div>
        </div>
        <div className="field"><label className="check"><input type="checkbox" checked={d.anonymous} onChange={(ev) => set('anonymous', ev.target.checked)} />
          <span><b>Report anonymously</b><br /><span className="hint">The office won't see your name. You can still follow the report and get updates here.</span></span></label></div>
        {err && <div className="alert" role="alert"><Icon name="info" size={18} /><span>{err}</span></div>}
        <div className="summary"><p className="muted">You'll get a notification each time the status changes.</p>
          <button className="btn" onClick={submit} disabled={busy}><Icon name="send" size={16} />{busy ? 'Sending…' : 'Submit report'}</button></div>
      </div>
    </>
  );
}
