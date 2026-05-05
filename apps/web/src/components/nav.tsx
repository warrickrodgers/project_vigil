'use client';

import Link from 'next/link';
import { SignedIn, SignedOut, UserButton, ClerkLoaded, ClerkLoading } from '@clerk/nextjs';

export function Nav() {
  return (
    <nav>
      <div className="page-wrap nav-inner">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-circle">V</div>
          <span>Project Vigil</span>
        </Link>
        <div className="nav-actions">
          {/* Placeholder while Clerk JS loads — prevents layout shift */}
          <ClerkLoading>
            <Link href="/sign-up" className="nav-cta">Get early access</Link>
          </ClerkLoading>

          <ClerkLoaded>
            <SignedOut>
              <Link href="/sign-in" className="nav-link">Sign in</Link>
              <Link href="/sign-up" className="nav-cta">Get early access</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="nav-link">Dashboard</Link>
              <UserButton />
            </SignedIn>
          </ClerkLoaded>
        </div>
      </div>
    </nav>
  );
}
