import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';

// A plain centred card used by sign-in, join and password pages.
export default function SignLayout({ children, wide }) {
  return (
    <div className="sign">
      <div className="sign-top">
        <Link to="/" className="pub-logo" aria-label="Campusly home"><Logo /></Link>
        <Link className="link small" to="/pricing">Plans and pricing</Link>
      </div>
      <div className="sign-wrap"><div className="sign-card" style={wide ? { maxWidth: 520 } : undefined}>{children}</div></div>
    </div>
  );
}
