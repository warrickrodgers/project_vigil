import Link from 'next/link';
import { NewsletterPreview } from '@/components/newsletter-preview';

const FEATURES = [
  {
    icon: '⚖️',
    title: 'Bias tracking',
    desc: 'Every outlet scored on a −1 to +1 scale, anchored to AllSides and Ad Fontes medians. Bias annotates — it does not censor.',
  },
  {
    icon: '🔗',
    title: 'Source corroboration',
    desc: 'Stories cross-referenced across outlets using semantic similarity. Single-source reports are flagged, not buried.',
  },
  {
    icon: '🎯',
    title: 'Actionable intel',
    desc: 'Not "the Fed raised rates." Instead: what this means for your mortgage, your portfolio, and your local economy.',
  },
  {
    icon: '📊',
    title: 'Trust scores',
    desc: 'Every article gets a trust rating derived from outlet reliability, bias, and corroboration — with the math shown.',
  },
  {
    icon: '🌐',
    title: 'Three sectors',
    desc: 'Local (KC Metro), USA National, and Geopolitical — each with its own analyst assessment and cross-sector pattern detection.',
  },
  {
    icon: '🛡️',
    title: 'No engagement trap',
    desc: 'No outrage-bait, no viral bias. Intelligence organized by importance and reliability — not clicks.',
  },
];

const PROOF = ['50+ sources monitored', '3 sectors tracked', '4× daily collection', 'Bias-aware scoring', 'Source corroboration'];

export default function LandingPage() {
  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="page-wrap">
          <span className="hero-eyebrow">Open Source Intelligence</span>
          <h1 className="hero-h1-mono">
            Know before the <em>crowd</em> does.
          </h1>
          <p>
            Bias-tracked, corroborated intelligence across Local, National, and Geopolitical sectors.
            Delivered to your inbox at 6am CT every morning.
          </p>
          <div className="hero-actions">
            <Link href="/sign-up" className="btn-primary">Request early access →</Link>
          </div>
        </div>
      </section>

      {/* PROOF STRIP */}
      <div className="proof-strip">
        <div className="page-wrap proof-inner">
          <span className="proof-label">By the numbers</span>
          <div className="proof-tags">
            {PROOF.map((t) => (
              <span key={t} className="proof-tag">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* NEWSLETTER PREVIEW */}
      <section className="section" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
        <div className="page-wrap">
          <p className="section-label">What Arrives in Your Inbox</p>
          <h2>The actual brief — not a mockup</h2>
          <p className="section-intro" style={{ marginBottom: '2.5rem' }}>
            Bias scores, trust ratings, and analyst assessments included for every story.
            This is a live render of an actual collected brief.
          </p>
          <NewsletterPreview />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <div className="page-wrap">
          <p className="section-label">The Pipeline</p>
          <h2>Intelligence that checks itself</h2>
          <p className="section-intro">
            Every article collected, corroborated, scored, and summarized — automatically, four times a day.
          </p>
          <div className="steps">
            <div className="step">
              <div className="step-left">
                <div className="step-num">1</div>
                <div className="step-line" />
              </div>
              <div className="step-content">
                <h3>Collect</h3>
                <p>Searches 50+ sources across local, national, and geopolitical beats. 4× daily — 5am, 12pm, 6pm, and overnight CT.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-left">
                <div className="step-num">2</div>
                <div className="step-line" />
              </div>
              <div className="step-content">
                <h3>Corroborate</h3>
                <p>Stories cross-referenced across outlets using semantic similarity. Bias scored on a −1 to +1 scale. Single-source reports flagged.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-left">
                <div className="step-num">3</div>
              </div>
              <div className="step-content">
                <h3>Brief</h3>
                <p>A clean 6am email with trust scores, analyst assessment, and actionable implications — not just headlines.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        className="section"
        style={{ background: 'rgba(79,142,247,0.03)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="page-wrap">
          <p className="section-label">What You Get</p>
          <h2>Beyond news aggregation</h2>
          <p className="section-intro">
            Most feeds tell you what happened. Vigil tells you what it means — and where the reporting is shaky.
          </p>
          <div className="services-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="service-card">
                <div className="card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="page-wrap">
          <div className="cta-inner">
            <p className="section-label">Early Access</p>
            <h2>Pre-alpha — limited spots.</h2>
            <p>
              Sign up for free while we validate with an early cohort. No credit card required.
            </p>
            <Link href="/sign-up" className="btn-primary">Request early access →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
