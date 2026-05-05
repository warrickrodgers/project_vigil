import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Early Access — Project Vigil',
  description: 'Join the pre-alpha. Bias-tracked, corroborated intelligence delivered to your inbox.',
};

export default function EarlyAccessPage() {
  return (
    <main>
      <section className="section" style={{ paddingTop: '4rem' }}>
        <div className="page-wrap">
          <p className="section-label">Pre-Alpha Access</p>
          <h2 style={{ marginBottom: '0.75rem' }}>Join the early cohort.</h2>
          <p className="section-intro" style={{ marginBottom: '3rem' }}>
            Vigil is in pre-alpha. Sign up for free access while we validate the product
            with a small group of early testers. No credit card required.
          </p>
          <div className="auth-page" style={{ minHeight: 'unset', padding: 0, justifyContent: 'flex-start' }}>
            <SignUp />
          </div>
        </div>
      </section>
    </main>
  );
}
