// The Campusly mark: a red rounded square with a C.
export function LogoMark({ size = 38 }) {
  return <span className="logo-mark" style={{ width: size, height: size, display: 'grid', placeItems: 'center' }} aria-hidden="true">C</span>;
}
export default function Logo({ sub }) {
  return <span className="logo"><LogoMark /><span>Campusly{sub && <small>{sub}</small>}</span></span>;
}
