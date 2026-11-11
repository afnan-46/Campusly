import { useNavigate } from 'react-router-dom';
import Icon, { BridgeArt } from './Icon';
import { longDate, sc } from '../lib/format';
import { useApp } from '../context/AppContext';

export const Pill = ({ status, label }) => <span className={`pill ${sc(status)}`}>{label || status}</span>;

export function Empty({ text, label, to }) {
  const nav = useNavigate();
  return (
    <div className="empty">
      <p>{text}</p>
      {label && <button className="btn ghost sm" onClick={() => nav(to)}>{label}</button>}
    </div>
  );
}

export function Hero({ title, text, actions, right }) {
  return (
    <section className="hero">
      <div className="blob b1" /><div className="blob b2" />
      <div>
        <span className="hero-date">{longDate()}</span>
        <h2>{title}</h2>
        <p>{text}</p>
        {actions && <div className="hero-actions">{actions}</div>}
      </div>
      <div>{right}</div>
      <BridgeArt className="hero-bridge" />
    </section>
  );
}

// items: [icon, colour, number, label, link?]
export function Stats({ items }) {
  const nav = useNavigate();
  return (
    <div className="stats">
      {items.map(([ic, c, n, l, to]) => {
        const inner = (
          <>
            <span className="top"><span className="si"><Icon name={ic} /></span>{to && <span className="go"><Icon name="arrowr" size={18} /></span>}</span>
            <span><b className={typeof n === 'string' && /[a-z]/i.test(n) ? 'txt' : ''}>{n}</b><span>{l}</span></span>
          </>
        );
        return to
          ? <button key={l} className={`stat ${c}`} onClick={() => (typeof to === 'function' ? to() : nav(to))} aria-label={`${l}: ${n}. Open.`}>{inner}</button>
          : <div key={l} className={`stat ${c}`}>{inner}</div>;
      })}
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{text}</div>;
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="alert" role="alert">
      <Icon name="info" size={18} />
      <span>{error?.message || 'Something went wrong.'} {onRetry && <button className="link" onClick={onRetry}>Try again</button>}</span>
    </div>
  );
}

export function Toast() {
  const { toastMsg } = useApp();
  return (
    <div className="toast" role="status" aria-live="polite" hidden={!toastMsg}>
      {toastMsg && <><span className="tc"><Icon name="check" size={14} /></span><span>{toastMsg}</span></>}
    </div>
  );
}

// Wraps a page: shows a spinner while loading and an error box if it failed.
export function Async({ state, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorBox error={state.error} onRetry={state.reload} />;
  return children(state.data);
}
