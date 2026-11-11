import { Link, NavLink, Outlet } from 'react-router-dom';
import Logo from '../../components/Logo';

// Header and footer shared by the public pages (before signing in).
export default function PublicLayout() {
  return (
    <div className="pub">
      <header className="pub-head">
        <div className="wrap">
          <Link to="/" className="pub-logo" aria-label="Campusly home"><Logo /></Link>
          <nav className="pub-nav" aria-label="Main">
            <NavLink to="/pricing">Plans and pricing</NavLink>
            <NavLink to="/apply">Apply</NavLink>
            <NavLink to="/apply/status">Check application</NavLink>
          </nav>
          <div className="pub-cta">
            <Link className="btn ghost sm" to="/login">Sign in</Link>
            <Link className="btn sm" to="/apply">Apply for Campusly</Link>
          </div>
        </div>
      </header>
      <main className="pub-main"><Outlet /></main>
      <footer className="pub-foot">
        <div className="wrap">
          <span>© Campusly. Appointments and campus reports for schools, colleges and universities in Bangladesh.</span>
          <span><Link to="/join">Join with class code</Link><Link to="/company/login">Campusly staff</Link></span>
        </div>
      </footer>
    </div>
  );
}
