const MONO = `'Roboto Mono','Courier New',monospace`;
const CONDENSED = `'Roboto Condensed','Arial Narrow',Arial,sans-serif`;
const SLAB = `'Roboto Slab',Georgia,'Times New Roman',serif`;
const SERIF = `'Roboto Serif',Georgia,'Times New Roman',serif`;

export function NewsletterPreview() {
  return (
    <div className="nl-preview-outer">
      {/* Glow behind the card */}
      <div className="nl-preview-glow" />

      {/* Floating card shell */}
      <div className="nl-preview-card">
        {/* Scale wrapper */}
        <div className="nl-preview-scale">

          {/* ── EMAIL HEADER ── */}
          <div style={{ padding: '20px 32px 18px', borderBottom: '3px solid #4f8ef7', background: '#1a1a2e' }}>
            <p style={{ margin: '0 0 5px', fontFamily: MONO, fontSize: '8px', color: '#9898b0', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Open Source Intelligence // For Operator Use
            </p>
            <h1 style={{ margin: '0 0 5px', fontSize: '22px', fontWeight: 600, color: '#4f8ef7', letterSpacing: '3px', fontFamily: MONO, textTransform: 'uppercase' }}>
              Project Vigil
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#a0a0b8', fontFamily: MONO, letterSpacing: '1px' }}>
              Daily Intelligence Brief — Thursday, April 23, 2026 · 12:20 PM CDT
            </p>
          </div>

          {/* ── LOCAL SECTION ── */}
          {/* Section bar */}
          <div style={{ background: '#4f8ef7', padding: '7px 32px' }}>
            <p style={{ margin: 0, fontSize: '9px', color: 'rgba(255,255,255,0.85)', fontFamily: MONO, letterSpacing: '2px', textTransform: 'uppercase' }}>
              Intel Report
            </p>
          </div>
          <div style={{ padding: '16px 32px 4px', background: '#1a1a2e' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 600, color: '#4f8ef7', letterSpacing: '2px', fontFamily: MONO, textTransform: 'uppercase' }}>
              📍 LOCAL INTEL — Kansas City Metro
            </h2>
          </div>

          {/* Articles */}
          <div style={{ padding: '2px 30px 6px', background: '#1a1a2e' }}>

            {/* Article 1 — single source */}
            <div style={{ padding: '10px 0 10px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', borderLeft: '2px solid #4f8ef7' }}>
              <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#a0a0b8', fontFamily: MONO }}>
                1. KANSAS CITY STAR · Trust: <span style={{ color: '#4f8ef7' }}>72%</span> (outlet: 78%, bias: -2%, single-source: -20%) · Published 2 days ago
              </p>
              <p style={{ margin: '0 0 5px', fontSize: '13px', fontWeight: 700, color: '#f5f5f0', fontFamily: CONDENSED, letterSpacing: '0.02em', lineHeight: 1.3 }}>
                KC Mayor announces $200M transit expansion for metro corridor
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#c8c8de', lineHeight: 1.6, fontFamily: SLAB, fontWeight: 300 }}>
                Mayor Quinton Lucas unveiled a $200M transit expansion covering the KC metro area, with new bus rapid transit routes connecting the east side to downtown and the Plaza corridor.
              </p>
            </div>

            {/* Article 2 — corroborated */}
            <div style={{ padding: '10px 0 10px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', borderLeft: '2px solid #4f8ef7' }}>
              <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#a0a0b8', fontFamily: MONO }}>
                2. KANSAS CITY BUSINESS JOURNAL · Trust: <span style={{ color: '#4f8ef7' }}>81%</span> (outlet: 85%, bias: -4%) · <span style={{ color: '#4f8ef7', fontWeight: 600 }}>✓ Corroborated</span>
              </p>
              <p style={{ margin: '0 0 5px', fontSize: '13px', fontWeight: 700, color: '#f5f5f0', fontFamily: CONDENSED, letterSpacing: '0.02em', lineHeight: 1.3 }}>
                Overland Park approves $45M tech district development near College Blvd
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#c8c8de', lineHeight: 1.6, fontFamily: SLAB, fontWeight: 300 }}>
                The Overland Park City Council voted 8-1 to approve a mixed-use tech campus development. The project is expected to bring 1,200 jobs and $12M in annual tax revenue once fully occupied.
              </p>
            </div>

            {/* Article 3 — flagged/unverified */}
            <div style={{ padding: '10px 0 10px 10px', borderLeft: '2px solid rgba(255,255,255,0.08)', opacity: 0.7 }}>
              <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#a0a0b8', fontFamily: MONO }}>
                3. THE PITCH KC · Trust: <span style={{ color: '#4f8ef7' }}>48%</span> (outlet: 62%, bias: -8%, single-source: -20%) · <span style={{ color: '#f0a040' }}>🔍 UNVERIFIED</span>
              </p>
              <p style={{ margin: '0 0 5px', fontSize: '13px', fontWeight: 700, color: '#9898b0', fontFamily: CONDENSED, letterSpacing: '0.02em', lineHeight: 1.3 }}>
                City Hall sources say downtown convention center expansion on hold
              </p>
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#707088', lineHeight: 1.6, fontFamily: SLAB, fontWeight: 300 }}>
                Anonymous sources at City Hall indicate that the planned convention center expansion may be indefinitely delayed due to revised cost projections.
              </p>
              <p style={{ margin: 0, fontSize: '10px', color: '#808096', fontStyle: 'italic', fontFamily: SERIF }}>
                Note: This article has not been corroborated across multiple sources.
              </p>
            </div>
          </div>

          {/* Analyst Assessment */}
          <div style={{ padding: '10px 32px 18px', background: '#1a1a2e' }}>
            <div style={{ background: '#12121f', borderLeft: '3px solid #4f8ef7', padding: '12px 16px', borderRadius: '0 4px 4px 0' }}>
              <p style={{ margin: '0 0 5px', fontSize: '9px', color: '#a0a0b8', fontFamily: MONO, letterSpacing: '2px', textTransform: 'uppercase' }}>
                Analyst Assessment
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#c8c8de', lineHeight: 1.75, fontFamily: SLAB, fontWeight: 300 }}>
                The transit expansion and Overland Park tech district signal continued infrastructure investment in the metro. Homeowners along the planned BRT corridors should monitor rezoning notices — BRT typically accelerates commercial conversion of adjacent parcels within 18 months of groundbreak.
              </p>
            </div>
          </div>

          {/* ── USA SECTION — partial, fades out ── */}
          <div style={{ background: '#f06070', padding: '7px 32px' }}>
            <p style={{ margin: 0, fontSize: '9px', color: 'rgba(255,255,255,0.85)', fontFamily: MONO, letterSpacing: '2px', textTransform: 'uppercase' }}>
              Intel Report
            </p>
          </div>
          <div style={{ padding: '16px 32px 4px', background: '#1a1a2e' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 600, color: '#f06070', letterSpacing: '2px', fontFamily: MONO, textTransform: 'uppercase' }}>
              🇺🇸 USA INTEL — National
            </h2>
          </div>
          <div style={{ padding: '2px 30px 20px', background: '#1a1a2e' }}>
            <div style={{ padding: '10px 0 10px 10px', borderLeft: '2px solid #f06070' }}>
              <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#a0a0b8', fontFamily: MONO }}>
                1. REUTERS · Trust: <span style={{ color: '#f06070' }}>88%</span> (outlet: 90%, bias: -2%) · <span style={{ color: '#f06070', fontWeight: 600 }}>✓ Corroborated</span>
              </p>
              <p style={{ margin: '0 0 5px', fontSize: '13px', fontWeight: 700, color: '#f5f5f0', fontFamily: CONDENSED, letterSpacing: '0.02em', lineHeight: 1.3 }}>
                Fed signals rate pause through Q3 as inflation data shows sustained decline
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#c8c8de', lineHeight: 1.6, fontFamily: SLAB, fontWeight: 300 }}>
                Federal Reserve Chair signaled no rate cuts before Q4 2026 despite three consecutive months of CPI improvement. Markets interpreted the statement as hawkish.
              </p>
            </div>
          </div>

        </div>{/* end scale */}

        {/* Fade out overlay */}
        <div className="nl-preview-fade" />

        {/* CTA overlay at bottom */}
        <div className="nl-preview-cta-bar">
          <span className="nl-preview-cta-text">Your 6am brief, every morning</span>
        </div>
      </div>
    </div>
  );
}
