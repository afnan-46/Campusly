import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { LogoMark } from '../../components/Logo';

const FEATURES = [
  ['cal', 'Book teachers in two taps', 'Students pick a free time with their class teacher or subject teacher. No more waiting outside the staff room.'],
  ['alert', 'Report problems to the right office', 'A broken fan, an IT fault or a safety worry goes straight to the office that fixes it, and the student can follow it.'],
  ['wifi', 'Works with weak internet', 'Install it on a phone like an app. Pages already opened stay readable offline, and reports are sent when the signal returns.'],
];

export default function Home() {
  return (
    <>
      <div className="wrap hero-pub">
        <div>
          <h1>Appointments and campus reports, <em>in one place.</em></h1>
          <p className="lead">Campusly helps your school, college or university connect students, teachers and offices. Students and teachers use it free. Your institution picks a simple monthly plan.</p>
          <div className="hero-actions-pub">
            <Link className="btn" to="/apply">Apply for your institution</Link>
            <Link className="btn ghost" to="/login">Sign in</Link>
          </div>
          <div className="trust">
            <span><Icon name="check" size={16} />14-day free trial</span>
            <span><Icon name="check" size={16} />Pay with bKash or Nagad</span>
            <span><Icon name="check" size={16} />Free for students and teachers</span>
          </div>
        </div>
        <div className="mock" aria-hidden="true">
          <div className="m-top"><LogoMark size={30} />Today</div>
          <div className="m-row"><span className="m-ic"><Icon name="cal" size={18} /></span><div><b>Class teacher meeting</b><small>Tomorrow, 10:20 AM</small></div><span className="m-st ok-text">● Confirmed</span></div>
          <div className="m-row"><span className="m-ic"><Icon name="alert" size={18} /></span><div><b>Projector, Room 431</b><small>Sent to IT Support</small></div><span className="m-st warn-text">● In progress</span></div>
          <div className="m-row"><span className="m-ic"><Icon name="course" size={18} /></span><div><b>Database Systems</b><small>Office hour, Thursday</small></div><span className="m-st warn-text">● Waiting</span></div>
        </div>
      </div>

      <section className="band"><div className="wrap">
        <h2 className="big">Everything students and teachers need, nothing they don't</h2>
        <div className="three">
          {FEATURES.map(([ic, h, p]) => (
            <div className="feat" key={h}><span className="fi"><Icon name={ic} size={22} /></span><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
      </div></section>

      <section className="band"><div className="wrap">
        <h2 className="big">Ready in a day</h2>
        <p className="sub">No software to install on your side. We set everything up for you.</p>
        <div className="steps3">
          <div className="st"><h3>Apply</h3><p>Tell us about your institution and choose a plan, or start the free trial.</p></div>
          <div className="st"><h3>We set you up</h3><p>We check your application and send your admin their sign-in details.</p></div>
          <div className="st"><h3>Add your people</h3><p>Import students and teachers from Excel, or share a class code so they join themselves.</p></div>
        </div>
      </div></section>

      <div className="wrap"><div className="free-band">
        <h2>Always free for students and teachers</h2>
        <p>Only the institution pays. Starter plans begin at ৳2,000 a month.</p>
        <Link className="btn" to="/pricing">See plans and pricing</Link>
      </div></div>
    </>
  );
}
