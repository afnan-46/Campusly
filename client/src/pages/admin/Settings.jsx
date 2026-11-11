import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { ChangePassword, FormAlert, ListEditor, useSave } from '../../components/Modal';
import { Async } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { typeLabel } from '../../lib/terms';

export default function Settings() {
  const { terms: t, refreshMeta } = useApp();
  const state = useApi('/admin/settings');
  const [s, setS] = useState(null);
  const [run, busy, , msg] = useSave();
  useEffect(() => { if (state.data) setS(state.data.settings); }, [state.data]);

  async function save(part, ok) {
    const d = await run(() => api('/admin/settings', { method: 'PATCH', body: part }), ok);
    if (d) { setS(d.settings); refreshMeta(); }
  }

  return (
    <Async state={state}>
      {() => s && (
        <>
          <section className="card card-pad">
            <h2><Icon name={s.type} size={18} /> {s.name}</h2>
            <p className="hint mt-xs">{typeLabel(s.type)}, short name {s.shortName}. Only the Campusly owner can change the name.</p>
            <div className="add-office mt">
              <div className="input-wrap"><Icon name="pin" size={18} className="lead-ic" />
                <input type="text" value={s.city || ''} onChange={(e) => setS({ ...s, city: e.target.value })} placeholder="City" aria-label="City" /></div>
              <button className="btn ghost" disabled={busy} onClick={() => save({ city: s.city }, 'City saved.')}>Save city</button>
            </div>
          </section>
          <FormAlert msg={msg} />
          <div className="grid2 sec">
            <section className="card card-pad">
              <h2>{t.groups}</h2>
              <p className="hint mt-xs">Students pick one of these when they sign up{t.inst === 'school' ? ', for example Class 8' : ''}.</p>
              <ListEditor items={s.groups} onChange={(groups) => setS({ ...s, groups })} placeholder={`Add a ${t.group.toLowerCase()}`} label={`New ${t.group.toLowerCase()}`} />
              <button className="btn mt" disabled={busy} onClick={() => save({ groups: s.groups }, `${t.groups} saved.`)}>Save {t.groups.toLowerCase()}</button>
            </section>
            <section className="card card-pad">
              <h2>Places</h2>
              <p className="hint mt-xs">Suggested when someone reports a problem. They can still type any place.</p>
              <ListEditor items={s.locations} onChange={(locations) => setS({ ...s, locations })} placeholder="Add a room or area" label="New place" />
              <button className="btn mt" disabled={busy} onClick={() => save({ locations: s.locations }, 'Places saved.')}>Save places</button>
            </section>
          </div>
          <div className="sec"><ChangePassword /></div>
        </>
      )}
    </Async>
  );
}

// The Campusly owner's own account page.
export function Account() {
  const { user } = useApp();
  return (
    <>
      <section className="card card-pad">
        <h2><Icon name="crown" size={18} /> {user.name}</h2>
        <p className="hint mt-xs">{user.email}. Sign-in email for the Campusly company portal.</p>
      </section>
      <div className="sec"><ChangePassword /></div>
    </>
  );
}
