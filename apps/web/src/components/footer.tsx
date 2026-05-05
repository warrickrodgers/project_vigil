import Link from 'next/link';

export function Footer() {
  return (
    <footer>
      <div className="page-wrap footer-inner">
        <Link href="/" className="nav-logo" style={{ gap: '0.5rem' }}>
          <div className="nav-logo-circle" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>V</div>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Project Vigil</span>
        </Link>
        <div className="footer-links">
          <Link href="/pricing">Pricing</Link>
          <Link href="/sign-up">Get started</Link>
          <a href="mailto:hello@initiativevigil.com">Contact</a>
        </div>
        <p className="footer-copy">© {new Date().getFullYear()} Initiative Vigil</p>
      </div>
    </footer>
  );
}
