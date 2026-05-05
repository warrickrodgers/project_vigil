import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@vigil/db';

export const metadata: Metadata = { title: 'Dashboard — Project Vigil' };

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  regional_pro: 'Regional Pro',
  enterprise: 'Enterprise',
};

const CADENCE: Record<string, string> = {
  free: 'Weekly — Sundays at 6am CT',
  pro: 'Daily at 6am CT',
  regional_pro: 'Daily at 6am CT',
  enterprise: 'Daily at 6am CT',
};

export default async function DashboardPage() {
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const subscriber = email
    ? await prisma.subscriber.findUnique({ where: { email } })
    : null;

  const firstName = user?.firstName ?? 'there';
  const tier = subscriber?.tier ?? null;
  const active = subscriber?.active ?? false;

  return (
    <main>
      <div className="dashboard-shell">
        <div className="page-wrap">
          <div className="dashboard-header">
            <h1>Good morning, {firstName}.</h1>
            <p>{email}</p>
          </div>

          {subscriber && active ? (
            <>
              <div className="dashboard-grid">
                {/* Subscription card */}
                <div className="dashboard-card">
                  <h3>Subscription</h3>
                  <div className={`tier-badge ${tier === 'free' ? 'free' : ''}`}>
                    {TIER_LABELS[tier ?? 'free'] ?? tier}
                  </div>
                  <div className="status-row">
                    <span className="status-dot" />
                    <span>Active</span>
                  </div>
                </div>

                {/* Delivery card */}
                <div className="dashboard-card">
                  <h3>Delivery</h3>
                  <p style={{ fontSize: '0.9rem', color: '#b0b0c8', marginBottom: '0.5rem' }}>
                    {CADENCE[tier ?? 'free']}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Delivered to {email}
                  </p>
                </div>

                {/* Upgrade card (only for free tier) */}
                {tier === 'free' && (
                  <div className="dashboard-card">
                    <h3>Upgrade</h3>
                    <p style={{ fontSize: '0.875rem', color: '#b0b0c8', marginBottom: '1rem', lineHeight: 1.5 }}>
                      Get the full daily brief, analyst assessment, and corroboration indicators.
                    </p>
                    <Link href="/pricing" className="pricing-cta pricing-cta-primary" style={{ display: 'inline-block' }}>
                      View Pro plans →
                    </Link>
                  </div>
                )}
              </div>

              {/* Newsletter archive placeholder */}
              <div className="dashboard-card" style={{ marginTop: '1rem' }}>
                <h3>Recent Briefs</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                  Newsletter archive coming soon. Briefs are delivered directly to your inbox.
                </p>
              </div>
            </>
          ) : (
            /* Not a subscriber yet */
            <div className="upgrade-prompt">
              <h2>You&apos;re not subscribed yet.</h2>
              <p>
                Pick a plan to start receiving your daily intelligence brief. Free weekly digest
                available — no credit card required.
              </p>
              <Link href="/pricing" className="btn-primary">View plans →</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
