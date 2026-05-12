import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Project Vigil',
  description: 'Choose your intelligence tier. Bias-tracked, corroborated OSINT delivered to your inbox.',
};

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    cadence: '/ mo',
    desc: 'Early access while we validate with the first cohort.',
    features: [
      'Daily 6am newsletter',
      'All three sectors',
      'Bias scores included',
      'Source corroboration flags',
    ],
    cta: 'Request access',
    ctaHref: '/sign-up',
    ctaStyle: 'pricing-cta pricing-cta-secondary',
    highlighted: false,
    badge: null,
  },
  {
    name: 'Pro',
    price: '$4.99',
    cadence: '/ mo',
    desc: 'Full intelligence access across all sectors, every run.',
    features: [
      'Everything in Free',
      'Full article summaries',
      'Trust rating breakdown',
      'Flash alerts (breaking)',
      'Priority inbox delivery',
    ],
    cta: 'Get Pro',
    ctaHref: '/sign-up',
    ctaStyle: 'pricing-cta pricing-cta-primary',
    highlighted: true,
    badge: 'Most popular',
  },
  {
    name: 'Regional Pro',
    price: '$14.99',
    cadence: '/ mo',
    desc: 'Deep-dive into one region with analyst commentary.',
    features: [
      'Everything in Pro',
      'Regional analyst notes',
      'Cross-sector pattern alerts',
      'Weekly trend digest',
      'Custom sector weighting',
    ],
    cta: 'Get Regional Pro',
    ctaHref: '/sign-up',
    ctaStyle: 'pricing-cta pricing-cta-secondary',
    highlighted: false,
    badge: null,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    desc: 'Team access, custom sectors, and white-label delivery.',
    features: [
      'Everything in Regional Pro',
      'Team seats',
      'Custom outlet lists',
      'API access (coming soon)',
      'Dedicated onboarding',
    ],
    cta: 'Contact us',
    ctaHref: 'mailto:hello@initiativevigil.com',
    ctaStyle: 'pricing-cta pricing-cta-secondary',
    highlighted: false,
    badge: null,
  },
];

export default function PricingPage() {
  return (
    <main>
      <section className="section" style={{ paddingTop: '4rem' }}>
        <div className="page-wrap">
          <p className="section-label">Pricing</p>
          <h2>Choose your intelligence tier.</h2>
          <p className="section-intro">
            Start free during pre-alpha. Upgrade when the product earns it.
          </p>

          <div className="pricing-grid">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`pricing-card${tier.highlighted ? ' highlighted' : ''}`}
              >
                {tier.badge && (
                  <span className="pricing-badge">{tier.badge}</span>
                )}
                <div className="pricing-tier">{tier.name}</div>
                <div className="pricing-amount">
                  <span className="pricing-price">{tier.price}</span>
                  {tier.cadence && (
                    <span className="pricing-cadence">{tier.cadence}</span>
                  )}
                </div>
                <p className="pricing-desc">{tier.desc}</p>
                <ul className="pricing-features">
                  {tier.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link href={tier.ctaHref} className={tier.ctaStyle}>
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
