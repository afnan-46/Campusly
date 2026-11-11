import { useRef, useState } from 'react';
import Icon from '../../components/Icon';
import Modal, { FormAlert } from '../../components/Modal';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';

function save(name, text) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

// Add many students or teachers at once from an Excel or CSV file.
export default function ImportModal({ role, onClose, onDone }) {
  const { terms: t, meta } = useApp();
  const isStudent = role === 'student';
  const [step, setStep] = useState(1); // 1 choose, 2 check, 3 done
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef();

  const header = isStudent ? ['Name', 'Student ID', 'Email', t.group, 'Advisor'] : ['Name', 'Email', 'Title', 'Room'];
  const example = isStudent
    ? [['Rina Das', t.sidExample, '', (meta?.programs || [''])[0], ''], ['Karim Uddin', '', '', (meta?.programs || [''])[0], '']]
    : [['Mahmud Hasan', 'mahmud@school.edu.bd', 'Assistant Teacher', 'Room 12']];
  example.forEach((r) => { if (isStudent && !r[1]) r[1] = `${t.sidExample.slice(0, -1)}2`; });

  async function pick(file) {
    if (!file) return;
    setErr(''); setBusy(true); setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const list = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      const clean = list.filter((r) => Object.values(r).some((v) => String(v).trim() !== ''));
      if (!clean.length) throw new Error('This file has no rows. Use the template and add one person per row.');
      setRows(clean);
      const d = await api('/admin/people/import', { method: 'POST', body: { role, mode: 'preview', rows: clean } });
      setPreview(d); setStep(2);
    } catch (e) { setErr(e.message || 'We could not read this file. Use an .xlsx or .csv file.'); } finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true); setErr('');
    try { const d = await api('/admin/people/import', { method: 'POST', body: { role, mode: 'commit', rows } }); setResult(d); setStep(3); onDone(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const people = isStudent ? 'students' : t.teachers.toLowerCase();
  const bad = preview ? preview.rows.filter((r) => r.errors.length) : [];

  return (
    <Modal wide title={`Import ${people} from Excel`} onClose={onClose}
      footer={step === 1 ? <button className="btn ghost" onClick={onClose}>Cancel</button>
        : step === 2 ? <><button className="btn ghost" onClick={() => { setStep(1); setPreview(null); }}>Choose another file</button><button className="btn" disabled={busy || !preview.valid} onClick={commit}>{busy ? 'Importing…' : `Import ${preview.valid} ${preview.valid === 1 ? 'person' : 'people'}`}</button></>
          : <button className="btn" onClick={onClose}>Done</button>}>
      <div className="steps-mini" aria-label="Steps"><span className={step === 1 ? 'on' : ''}>1 Choose file</span><span className={step === 2 ? 'on' : ''}>2 Check</span><span className={step === 3 ? 'on' : ''}>3 Done</span></div>
      <FormAlert msg={err} />
      {step === 1 && (
        <>
          <p className="muted mt-s">Put one person on each row. Download the template if you want to see the columns we expect.</p>
          <div className="inline"><button className="btn soft sm" onClick={() => save(`campusly-${role}-template.csv`, csv([header, ...example]))}><Icon name="download" size={15} />Download template</button></div>
          <div className="drop mt">
            <Icon name="upload" size={26} />
            <p><b>Choose your Excel or CSV file</b></p>
            <p className="hint">.xlsx, .xls or .csv, up to 2,000 rows</p>
            <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => pick(e.target.files[0])} />
            <button className="btn mt-s" disabled={busy} onClick={() => input.current.click()}>{busy ? 'Reading…' : 'Choose file'}</button>
          </div>
          {isStudent && <p className="hint mt-s">{t.group} must match one already set up in Settings. Advisor is optional: use the {t.advisor.toLowerCase()}'s email or full name.</p>}
        </>
      )}
      {step === 2 && preview && (
        <>
          <p className="mt-s"><b>{fileName}</b>: {preview.total} rows. <span className="ok-text"><b>{preview.valid} ready</b></span>{preview.invalid ? <>, <span className="bad-text"><b>{preview.invalid} need fixing</b></span></> : null}.</p>
          {bad.length > 0 && (
            <>
              <p className="hint mt-s">Rows with problems are skipped. Fix them in your file and import again, or continue with the rest.</p>
              <div className="tbl-wrap mt-s"><table className="tbl">
                <thead><tr><th>Row</th><th>Name</th><th>Problem</th></tr></thead>
                <tbody>{bad.slice(0, 12).map((r) => <tr key={r.line} className="bad-row"><td>{r.line}</td><td>{r.name || '(empty)'}</td><td>{r.errors.join('. ')}</td></tr>)}</tbody>
              </table></div>
              {bad.length > 12 && <p className="hint mt-s">And {bad.length - 12} more.</p>}
            </>
          )}
          {preview.valid > 0 && <p className="hint mt-s">Each person gets a temporary password and must choose their own on first sign-in. You can download the sign-in sheet after importing.</p>}
        </>
      )}
      {step === 3 && result && (
        <>
          <div className="alert ok mt-s" role="status"><Icon name="check" size={18} /><span>{result.created} {result.created === 1 ? 'person' : 'people'} imported{result.skipped ? `, ${result.skipped} skipped` : ''}.</span></div>
          <p className="muted mt-s">Download the sign-in sheet now. The temporary passwords are not shown again.</p>
          <div className="inline"><button className="btn" onClick={() => save(`campusly-${role}-sign-in-sheet.csv`, csv([['Name', isStudent ? t.sid : 'Email', 'Email', 'Temporary password'], ...result.credentials.map((c) => [c.name, isStudent ? c.sid : c.email, c.email, c.password])]))}><Icon name="download" size={16} />Download sign-in sheet</button></div>
        </>
      )}
    </Modal>
  );
}
