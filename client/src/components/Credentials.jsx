import { useState } from 'react';
import Icon from './Icon';

// Sign-in details to hand over: shown once, with copy buttons.
export default function Credentials({ name, email, sid, password, institution, note }) {
  const [copied, setCopied] = useState('');
  const login = `${window.location.origin}/login`;
  const text = `Hello ${name},\n${institution ? `Your ${institution} account on Campusly is ready.\n` : 'Your Campusly account is ready.\n'}Sign in: ${login}\n${sid ? `ID: ${sid}\n` : ''}${email ? `Email: ${email}\n` : ''}Temporary password: ${password}\nYou will be asked to choose your own password when you sign in.`;
  async function copy(what, value) {
    try { await navigator.clipboard.writeText(value); setCopied(what); setTimeout(() => setCopied(''), 1800); } catch { setCopied('select'); }
  }
  return (
    <div>
      <div className="cred">
        {institution && <div><span>Institution</span><b>{institution}</b></div>}
        <div><span>Name</span><b>{name}</b></div>
        {sid && <div><span>ID</span><b>{sid}</b></div>}
        {email && <div><span>Email</span><b>{email}</b></div>}
        <div><span>Temporary password</span><b className="mono">{password}</b></div>
      </div>
      <p className="hint mt-s">{note || 'This password is shown only now. The person must change it the first time they sign in.'}</p>
      <div className="inline">
        <button type="button" className="btn soft sm" onClick={() => copy('pw', password)}><Icon name="copy" size={15} />{copied === 'pw' ? 'Copied' : 'Copy password'}</button>
        <button type="button" className="btn soft sm" onClick={() => copy('msg', text)}><Icon name="copy" size={15} />{copied === 'msg' ? 'Copied' : 'Copy message to send'}</button>
      </div>
      {copied === 'select' && <p className="hint mt-s">Copy is blocked here. Select the text above and copy it.</p>}
    </div>
  );
}
