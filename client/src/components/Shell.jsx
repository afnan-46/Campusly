import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import Logo from './Logo';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { fmtStamp, initials, shortDate, subFor } from '../lib/format';
import { roleLabel } from '../lib/terms';

// [path, long label, short label (phone), icon, main?]  "main" items stay on the phone's bottom bar; the rest go under "More".
function navFor(role, t) {
  return {
    student: [['/', 'Home', 'Home', 'home', 1], ['/advisor', `My ${t.advisor.toLowerCase()}`, t.advisor.split(' ')[0], 'advisor', 1], ['/instructors', `${t.instructor}s`, t.courses, 'course', 1], ['/appointments', 'Appointments', 'Bookings', 'cal', 1], ['/reports', 'Reports', 'Reports', 'ticket', 1]],
    faculty: [['/', 'Home', 'Home', 'home', 1], ['/schedule', 'Schedule', 'Schedule', 'cal', 1], ['/hours', 'Office hours', 'Hours', 'clock', 1], ['/reports', 'Reports', 'Reports', 'ticket', 1]],
    staff: [['/queue', 'Reports', 'Reports', 'inbox', 1], ['/insights', 'Insights', 'Insights', 'chart', 1]],
    admin: [['/', 'Overview', 'Home', 'home', 1], ['/people', 'People', 'People', 'users', 1], ['/courses', t.courses, t.courses, 'course'], ['/join-codes', 'Class codes', 'Codes', 'key'], ['/offices', 'Offices', 'Offices', 'building'],
      ['/queue', 'Reports', 'Reports', 'inbox', 1], ['/insights', 'Insights', 'Insights', 'chart'], ['/billing', 'Billing', 'Billing', 'wallet', 1], ['/settings', 'Settings', 'Settings', 'settings']],
    company: [['/', 'Overview', 'Home', 'home', 1], ['/applications', 'Applications', 'Inbox', 'inbox', 1], ['/institutions', 'Institutions', 'Schools', 'university', 1], ['/payments', 'Payments', 'Payments', 'wallet', 1], ['/team', 'Team', 'Team', 'users'], ['/account', 'My account', 'Account', 'key']],
  }[role === 'superadmin' ? 'company' : role];
}

function titleFor(path, role, t) {
  return {
    '/': role === 'admin' ? 'Overview' : role === 'superadmin' || role === 'company' ? 'Overview' : 'Home',
    '/advisor': `Book my ${t.advisor.toLowerCase()}`, '/instructors': `Meet a ${t.instructor.toLowerCase()}`, '/appointments': 'Appointments',
    '/reports': 'Reports', '/reports/new': 'Report a problem', '/schedule': 'Schedule', '/hours': 'Office hours',
    '/queue': role === 'admin' ? 'Reports from every office' : 'Reports', '/insights': 'Insights',
    '/people': 'People', '/courses': t.courses, '/offices': 'Offices and report routing', '/settings': 'Settings', '/account': 'My account',
    '/join-codes': 'Class codes', '/billing': 'Plan and billing', '/applications': 'Applications', '/institutions': 'Institutions',
    '/payments': 'Payments', '/team': 'Team',
  }[path] || '';
}

function toggleTheme() {
  const root = document.documentElement;
  const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('campusly-theme', next); } catch { /* ignore */ }
}

// Waiting-work counts shown on the nav.
function useBadges(user, liveTick, path) {
  const [badges, setBadges] = useState({});
  useEffect(() => {
    let live = true;
    if (user.role === 'faculty') {
      api('/appointments').then((d) => live && setBadges({ '/': d.appointments.filter((a) => a.status === 'Pending' && !a.past).length })).catch(() => {});
    } else if (user.role === 'staff') {
      api('/reports/summary').then((d) => live && setBadges({ '/queue': d.counts.Submitted })).catch(() => {});
    } else if (user.role === 'admin') {
      Promise.all([api('/reports/summary'), api('/admin/people')]).then(([r, p]) => live && setBadges({ '/queue': r.counts.Submitted, '/people': p.pending.length })).catch(() => {});
    } else if (user.role === 'superadmin' || user.role === 'company') {
      api('/company/dashboard').then((d) => live && setBadges({ '/applications': d.pending.applications, '/payments': d.pending.payments })).catch(() => {});
    }
    return () => { live = false; };
  }, [user, liveTick, path]);
  return badges;
}

export default function Shell() {
  const { user, setUser, logout, notifs, markAllRead, liveTick, terms: t, online, queued } = useApp();
  const inst = user.institution;
  const isCompany = user.role === 'superadmin' || user.role === 'company';
  const role = roleLabel(user.role, t);
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [snap, setSnap] = useState([]);
  const panel = useRef();
  const lastMe = useRef(0);
  const badges = useBadges(user, liveTick, loc.pathname);
  const items = navFor(user.role, t);
  const mainItems = items.filter((i) => i[4]);
  const moreItems = items.filter((i) => !i[4]);

  useEffect(() => { document.body.classList.toggle('company', isCompany); return () => document.body.classList.remove('company'); }, [isCompany]);
  useEffect(() => { setOpen(false); setMore(false); window.scrollTo(0, 0); }, [loc.pathname]);
  // Keep the plan status fresh (after a renewal is confirmed, for example).
  useEffect(() => {
    if (isCompany || Date.now() - lastMe.current < 45000 || !online) return;
    lastMe.current = Date.now();
    api('/auth/me').then((d) => setUser(d.user)).catch(() => {});
  }, [loc.pathname, liveTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!e.target.closest('.notif') && !e.target.closest('[data-bell]')) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function bell() {
    if (open) { setOpen(false); return; }
    setSnap(notifs.notifications.filter((n) => !n.read).map((n) => n.id));
    setOpen(true);
    if (notifs.unread) markAllRead();
  }
  const isOn = (to) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const unread = notifs.unread;
  const acc = user.access;
  const paused = acc && acc.state !== 'active';
  const lowDays = acc && acc.state === 'active' && acc.daysLeft !== null && acc.daysLeft <= 7;

  const btn = (to, l, s, ic, extra = '') => (
    <button key={to} className={extra} onClick={() => nav(to)} aria-current={isOn(to) ? 'page' : undefined}>
      <Icon name={ic} /><span className="long">{l}</span><span className="short">{s}</span>
      {badges[to] ? <span className="count" aria-label={`${badges[to]} waiting`}>{badges[to]}</span> : null}
    </button>
  );

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-logo"><Logo sub={isCompany ? 'Company portal' : `${inst ? inst.shortName : ''}, ${role.toLowerCase()}`} /></div>
        <nav className="nav" aria-label="Main">
          {items.map(([to, l, s, ic, main]) => btn(to, l, s, ic, main ? '' : 'nav-sec'))}
          {moreItems.length > 0 && (
            <button className="more-btn" onClick={() => setMore(!more)} aria-expanded={more}><Icon name="settings" /><span className="short">More</span></button>
          )}
        </nav>
        {more && (
          <div className="more-sheet" role="menu">
            {moreItems.map(([to, l, , ic]) => (
              <button key={to} role="menuitem" onClick={() => nav(to)}><Icon name={ic} />{l}{badges[to] ? <span className="count">{badges[to]}</span> : null}</button>
            ))}
            <button role="menuitem" onClick={logout}><Icon name="out" />Sign out</button>
          </div>
        )}
        <div className="rail-user">
          <span className="avatar">{initials(user.name)}</span>
          <span className="ru-info"><b>{user.name}</b><small>{subFor(user)}</small></span>
          <button className="ru-out" onClick={logout} aria-label="Sign out"><Icon name="out" size={18} /></button>
        </div>
      </aside>
      <div className="main">
        {!online && <div className="offline-bar" role="status"><Icon name="offline" size={15} />You are offline. You can read pages you opened before.{queued ? ` ${queued} saved ${queued === 1 ? 'report' : 'reports'} will be sent when you are back.` : ''}</div>}
        <header className="topbar">
          <div><div className="crumb">{isCompany ? 'Campusly company portal' : inst ? `${inst.name}, ${role.toLowerCase()}` : ''}</div><h1>{titleFor(loc.pathname, user.role, t)}</h1></div>
          <div className="top-actions">
            <span className="datechip">{shortDate()}</span>
            <button className="icon-btn" data-bell onClick={bell} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
              <Icon name="bell" />{unread ? <span className="dot">{unread}</span> : null}
            </button>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Switch between light and dark theme"><Icon name="moon" /></button>
            <button className="icon-btn m-only" onClick={logout} aria-label="Sign out"><Icon name="out" /></button>
            {open && (
              <div className="notif" role="region" aria-label="Notifications" ref={panel}>
                <h2><Icon name="bell" size={16} />Notifications</h2>
                {notifs.notifications.length ? notifs.notifications.map((n) => (
                  <button key={n.id} className={snap.includes(n.id) ? 'unread' : ''} onClick={() => { setOpen(false); nav(n.link || '/'); }}>
                    <span className="n-dot" /><span>{n.text}<time>{fmtStamp(n.at)}</time></span>
                  </button>
                )) : <p className="none">You have no notifications yet.</p>}
              </div>
            )}
          </div>
        </header>
        <div className="content">
          {paused && user.role === 'admin' && loc.pathname !== '/billing' && (
            <div className="banner bad" role="alert"><span><b>{acc.state === 'suspended' ? 'Your institution\'s access is paused.' : 'Your plan has ended.'}</b> Students and teachers can read but not book or report.</span><button className="btn sm" onClick={() => nav('/billing')}>{acc.state === 'suspended' ? 'See details' : 'Renew now'}</button></div>
          )}
          {paused && user.role !== 'admin' && !isCompany && (
            <div className="banner grey" role="status"><span><b>Access is paused.</b> You can look at your saved information, but booking and reporting are switched off. Please contact your admin.</span></div>
          )}
          {lowDays && user.role === 'admin' && loc.pathname !== '/billing' && (
            <div className="banner warn"><span><b>{acc.daysLeft} {acc.daysLeft === 1 ? 'day' : 'days'} left</b> on your {acc.trial ? 'free trial' : 'plan'}.</span><button className="btn sm" onClick={() => nav('/billing')}>{acc.trial ? 'Choose a plan' : 'Renew'}</button></div>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
