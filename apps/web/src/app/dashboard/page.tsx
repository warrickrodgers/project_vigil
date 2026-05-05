import type { Metadata } from 'next';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@vigil/db';

export const metadata: Metadata = { title: 'Dashboard — Project Vigil' };

const TIER_LABELS: Record<string, string> = {
  free: 'Free — Pre-Alpha',
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
  const tier = subscriber?.tier ?? 'free';
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
                <div className="dashboard-card">
                  <h3>Subscription</h3>
                  <div className={`tier-badge ${tier === 'free' ? 'free' : ''}`}>
                    {TIER_LABELS[tier] ?? tier}
                  </div>
                  <div className="status-row" style={{ marginTop: '0.75rem' }}>
                    <span className="status-dot" />
                    <span>Active</span>
                  </div>
                </div>

                <div className="dashboard-card">
                  <h3>Delivery</h3>
                  <p style={{ fontSize: '0.9rem', color: '#b0b0c8', marginBottom: '0.5rem' }}>
                    {CADENCE[tier]}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Delivered to {email}
                  </p>
                </div>
              </div>

              <div className="dashboard-card" style={{ marginTop: '1.25rem' }}>
                <h3>Recent Briefs</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                  Brief archive coming soon. Each edition is delivered directly to your inbox at 6am CT.
                </p>
              </div>
            </>
          ) : (
            <div className="upgrade-prompt">
              <h2>You&apos;re on the list.</h2>
              <p>
                You&apos;ll receive an email when your pre-alpha access is activated.
                Briefs go out Sunday mornings at 6am CT.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
