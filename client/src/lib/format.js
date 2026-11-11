export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const STEPS = ['Submitted', 'Acknowledged', 'In progress', 'Resolved'];
export const STEP_COLOR = { Submitted: '#B6B2AB', Acknowledged: '#E3A84C', 'In progress': '#5E9BC8', Resolved: '#5CA883' };
export const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', staff: 'Office staff', admin: 'Admin', superadmin: 'Campusly owner', company: 'Campusly staff' };

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export const fmtDate = (s) => {
  const d = parseYmd(s);
  return `${s === ymd(new Date()) ? 'Today, ' : ''}${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const fmtTime = (t) => {
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ap}`;
};
export const fmtStamp = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
};
export const longDate = () => { const d = new Date(); return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; };
export const shortDate = () => { const d = new Date(); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

export function age(iso) {
  const m = (Date.now() - new Date(iso)) / 6e4;
  if (m < 60) return `${Math.max(1, Math.round(m))} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
export const sc = (s) => s.toLowerCase().replace(/\s+/g, '-');
export const initials = (n = '') => n.replace('Dr. ', '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
// "Dr. Mahfuz" and "Prof. Selina" keep the title; "Md." and "Mst." are skipped.
export const firstName = (u) => {
  const p = u.name.split(' ');
  if (['Dr.', 'Prof.'].includes(p[0]) && p[1]) return `${p[0]} ${p[1]}`;
  if (['Md.', 'Mst.', 'Mohammad', 'Mohammed', 'Muhammad'].includes(p[0]) && p[1]) return p[1];
  return p[0];
};
export const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
export const byDT = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
export const isUpcoming = (a) => (a.status === 'Pending' || a.status === 'Confirmed') && !a.past;
// `t` is the institution's terms (lib/terms.js); without it the university words are used.
export const apptLabel = (a, t) => (a.type === 'Advising' ? (t ? t.apptShort : 'Advising') : `${a.course} ${t ? t.courseAppt : 'office hour'}`);
export const subFor = (u) => ({
  student: () => `${u.sid}, ${u.dept}`,
  faculty: () => u.title,
  staff: () => `${u.title}, ${u.office}`,
  admin: () => u.title || 'Administrator',
  superadmin: () => 'Campusly owner',
  company: () => u.title || 'Campusly staff',
}[u.role] || (() => ''))();
export const nextFreeShort = (f) => (f && f.nextFree ? `${fmtDate(f.nextFree.date)} at ${fmtTime(f.nextFree.time)}` : 'no free slots this week');
export const hoursSorted = (hours = []) => [...hours].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

// Money in taka, e.g. ৳5,000
export const taka = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`;
export const fmtDay = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
