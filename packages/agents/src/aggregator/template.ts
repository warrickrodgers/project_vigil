import type { Newsletter, DigestSection, NewsletterStats } from './types.js';

const SECTION_COLORS: Record<string, string> = {
  local: '#4f8ef7',
  usa: '#f06070',
  geopolitical: '#8878ff',
};

const SECTION_LABELS: Record<string, string> = {
  local: '📍 LOCAL INTEL — Kansas City Metro',
  usa: '🇺🇸 USA INTEL — National',
  geopolitical: '🌐 GEOPOLITICAL INTEL — Global',
};

const MONO = `'Roboto Mono','Courier New',monospace`;
const BODY = `'Roboto Slab',Georgia,'Times New Roman',serif`;
const SUB  = `'Roboto Serif',Georgia,'Times New Roman',serif`;

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: '#22c55e',
  MODERATE: '#eab308',
  LOW: '#ef4444',
};

function trustBreakdown(a: import('./types.js').RankedArticle): string {
  const outlet = Math.round(a.outletReliabilityBase * 100);
  const biasPenalty = Math.round(Math.abs(a.biasScore) * 0.3 * 100);
  const corrobPenalty = a.isCorroborated ? 0 : 20;
  const parts: string[] = [`outlet: ${outlet}%`];
  if (biasPenalty > 0) parts.push(`bias: -${biasPenalty}%`);
  if (corrobPenalty > 0) parts.push(`single-source: -${corrobPenalty}%`);
  return parts.join(', ');
}

function temporalLabel(publishedAt: Date, relativeTo: Date): string {
  const diffDays = Math.floor((relativeTo.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return '';
  if (diffDays === 1) return 'Published yesterday';
  return `Published ${diffDays} days ago`;
}

function biasLabel(score: number): string {
  if (score <= -0.5) return 'Hard Left';
  if (score <= -0.15) return 'Left-Leaning';
  if (score < 0.15) return 'Center';
  if (score < 0.5) return 'Right-Leaning';
  return 'Hard Right';
}

function biasBar(avg: number): string {
  const pos = Math.round((avg + 1) * 5);
  return Array.from({ length: 11 }, (_, i) => (i === pos ? '▼' : '─')).join('');
}

function renderNominalSection(section: DigestSection): string {
  const color = SECTION_COLORS[section.region] ?? '#4f8ef7';
  const label = SECTION_LABELS[section.region] ?? section.region.toUpperCase();
  const lastCollection = section.lastCollectionAt
    ? new Date(section.lastCollectionAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Chicago',
        timeZoneName: 'short',
      })
    : 'Unknown';

  return `
  <tr>
    <td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="background:${color};padding:8px 40px;">
            <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.85);font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Intel Report</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 6px;background:#1a1a2e;">
            <h2 style="margin:0 0 4px;font-size:14px;font-weight:600;color:${color};letter-spacing:2px;font-family:${MONO};text-transform:uppercase;">${label}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 40px 22px;background:#1a1a2e;border-left:3px solid #333;">
            <p style="margin:0;font-family:${MONO};font-size:13px;color:#555;letter-spacing:2px;">
              ▬▬▬ NO NEW DEVELOPMENTS — ${section.region.toUpperCase()} NOMINAL ▬▬▬
            </p>
            <p style="margin:8px 0 0;font-family:${MONO};font-size:11px;color:#444;">
              Monitoring continues. Last collection: ${lastCollection}.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderStructuredAssessmentHtml(
  assessment: import('@vigil/shared').StructuredAssessment,
  color: string,
): string {
  const confColor = CONFIDENCE_COLORS[assessment.confidence] ?? '#eab308';
  const watchItems = assessment.watchList
    .map((w) => `▸ ${w}`)
    .join('<br>\n            ');

  return `
            <div style="background:#0d0d0d;border-left:3px solid ${color};padding:16px 20px;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Situation</p>
              <p style="margin:0 0 12px;font-size:13px;color:#ccc;line-height:1.6;font-family:${BODY};font-weight:300;">${assessment.situation}</p>

              <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Assessment</p>
              <p style="margin:0 0 12px;font-size:13px;color:#e8e8e8;line-height:1.6;font-family:${BODY};font-weight:300;">${assessment.assessment}</p>

              <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Confidence</p>
              <p style="margin:0 0 12px;font-size:13px;color:${confColor};line-height:1.6;font-family:${MONO};">${assessment.confidence} — ${assessment.confidenceReasoning}</p>

              <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Implications</p>
              <p style="margin:0 0 12px;font-size:13px;color:#c9a227;line-height:1.6;font-family:${BODY};font-weight:300;">${assessment.implications}</p>

              <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Watch List</p>
              <p style="margin:0;font-size:12px;color:#aaa;line-height:1.8;font-family:${MONO};">${watchItems}</p>
            </div>`;
}

function renderSectionHtml(section: DigestSection, generatedAt: Date): string {
  if (section.isNominal) return renderNominalSection(section);

  const color = SECTION_COLORS[section.region] ?? '#4f8ef7';
  const label = SECTION_LABELS[section.region] ?? section.region.toUpperCase();
  const FLAG_LABELS: Record<string, string> = {
    BIAS: '⚠️ BIAS',
    UNVERIFIED: '🔍 UNVERIFIED',
    DUPLICATE: '♻️ DUPLICATE',
    LOW_TRUST: '📉 LOW TRUST',
    UNKNOWN_OUTLET: '❓ UNKNOWN OUTLET',
  };

  const items = section.articles
    .slice(0, 4)
    .map((a, i) => {
      const flagLabel = a.vettingFlag ? FLAG_LABELS[a.vettingFlag] ?? a.vettingFlag : null;
      const muted = flagLabel !== null;
      const titleColor = muted ? '#9898b0' : '#f5f5f0';
      const summaryColor = muted ? '#707088' : '#c8c8de';
      const temporal = temporalLabel(a.publishedAt, generatedAt);
      const corrobBadge = a.isCorroborated
        ? ` · <span style="color:${color};font-weight:600;">✓ Corroborated</span>`
        : '';
      return `
      <tr>
        <td style="padding:12px 0 12px 10px;border-bottom:1px solid rgba(255,255,255,0.07);border-left:2px solid ${muted ? 'rgba(255,255,255,0.08)' : color};${muted ? 'opacity:0.7;' : ''}">
          <p style="margin:0 0 5px;font-size:11px;color:#a0a0b8;font-family:${MONO};">${i + 1}. ${a.outletName.toUpperCase()} · Trust: <span style="color:${color};">${(a.trustRating * 100).toFixed(0)}%</span> (${trustBreakdown(a)})${corrobBadge}${temporal ? ` · ${temporal}` : ''}${flagLabel ? ` · <span style="color:#f0a040;">${flagLabel}</span>` : ''}</p>
          <p style="margin:0 0 7px;font-size:15px;font-weight:700;color:${titleColor};font-family:'Roboto Condensed','Arial Narrow',Arial,sans-serif;letter-spacing:0.02em;line-height:1.3;"><a href="${a.url}" style="color:${titleColor};text-decoration:none;">${a.title}</a></p>
          <p style="margin:0 0 4px;font-size:13px;color:${summaryColor};line-height:1.65;font-family:${BODY};font-weight:300;">${a.summary}</p>
          ${muted ? `<p style="margin:0;font-size:11px;color:#808096;font-style:italic;font-family:${SUB};">Note: This article has not been corroborated across multiple sources.</p>` : ''}
        </td>
      </tr>`;
    })
    .join('');

  const assessmentBlock = section.structuredAssessment
    ? renderStructuredAssessmentHtml(section.structuredAssessment, color)
    : `<div style="background:#12121f;border-left:3px solid ${color};padding:14px 18px;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 6px;font-size:10px;color:#a0a0b8;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Analyst Assessment</p>
              <p style="margin:0;font-size:13px;color:#c8c8de;line-height:1.75;font-family:${BODY};font-weight:300;">${section.interpretiveSummary || 'No analysis available.'}</p>
            </div>`;

  return `
  <tr>
    <td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="background:${color};padding:8px 40px;">
            <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.85);font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">Intel Report</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 6px;background:#1a1a2e;">
            <h2 style="margin:0 0 4px;font-size:14px;font-weight:600;color:${color};letter-spacing:2px;font-family:${MONO};text-transform:uppercase;">${label}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 38px 8px;background:#1a1a2e;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${items || `<tr><td style="padding:12px 0 12px 10px;border-left:2px solid rgba(255,255,255,0.08);color:#9898b0;font-style:italic;font-family:${BODY};">No articles collected for this sector.</td></tr>`}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 40px 22px;background:#1a1a2e;">
            ${assessmentBlock}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderStatsHtml(stats: NewsletterStats): string {
  const confDist = stats.confidenceDistribution;
  const totalAssessments = confDist
    ? confDist.high + confDist.moderate + confDist.low
    : 0;

  const confidenceRows = confDist
    ? `
        <tr><td colspan="2" style="padding:12px 0 4px;font-size:10px;color:#a0a0b8;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">📊 Confidence Distribution</td></tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">HIGH</td>
          <td style="padding:4px 0;font-size:12px;color:#22c55e;text-align:right;font-family:${MONO};">${confDist.high} assessment${confDist.high !== 1 ? 's' : ''}${totalAssessments > 0 ? ` (${Math.round(confDist.high / totalAssessments * 100)}%)` : ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">MODERATE</td>
          <td style="padding:4px 0;font-size:12px;color:#eab308;text-align:right;font-family:${MONO};">${confDist.moderate} assessment${confDist.moderate !== 1 ? 's' : ''}${totalAssessments > 0 ? ` (${Math.round(confDist.moderate / totalAssessments * 100)}%)` : ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">LOW</td>
          <td style="padding:4px 0;font-size:12px;color:#ef4444;text-align:right;font-family:${MONO};">${confDist.low} assessment${confDist.low !== 1 ? 's' : ''}${totalAssessments > 0 ? ` (${Math.round(confDist.low / totalAssessments * 100)}%)` : ''}</td>
        </tr>
        ${confDist.nominal > 0 ? `<tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">NOMINAL</td>
          <td style="padding:4px 0;font-size:12px;color:#555;text-align:right;font-family:${MONO};">${confDist.nominal} sector${confDist.nominal !== 1 ? 's' : ''}</td>
        </tr>` : ''}`
    : '';

  return `
  <tr>
    <td style="padding:22px 40px;background:#12121f;border-top:1px solid rgba(255,255,255,0.08);">
      <p style="margin:0 0 12px;font-size:10px;color:#a0a0b8;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">📊 Source Reliability Summary</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">Articles analyzed</td>
          <td style="padding:4px 0;font-size:12px;color:#f5f5f0;text-align:right;font-family:${MONO};">${stats.totalArticles}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">Corroboration rate</td>
          <td style="padding:4px 0;font-size:12px;color:#f5f5f0;text-align:right;font-family:${MONO};">${(stats.corroborationRate * 100).toFixed(0)}%</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">Avg trust rating</td>
          <td style="padding:4px 0;font-size:12px;color:#f5f5f0;text-align:right;font-family:${MONO};">${(stats.avgTrustRating * 100).toFixed(0)}%</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#c8c8de;font-family:${BODY};">Avg bias score</td>
          <td style="padding:4px 0;font-size:12px;color:#f5f5f0;text-align:right;font-family:${SUB};">L ${biasBar(stats.avgBiasScore)} R · ${biasLabel(stats.avgBiasScore)}</td>
        </tr>
        ${confidenceRows}
      </table>
    </td>
  </tr>`;
}

export function renderHtmlEmail(newsletter: Newsletter, recipientEmail?: string): string {
  const date = newsletter.generatedAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  });
  const time = newsletter.generatedAt.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short',
  });

  const sections = newsletter.sections.map((s) => renderSectionHtml(s, newsletter.generatedAt)).join('');
  const stats = renderStatsHtml(newsletter.stats);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Project Vigil — Daily Intelligence Brief</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;600;700&family=Roboto+Mono:wght@400;500;600&family=Roboto+Slab:wght@300;400;500&family=Roboto+Serif:ital,wght@0,300;0,400;1,300&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: dark; }
    body { background-color: #12121f !important; color: #f5f5f0 !important; }
    .email-wrapper { background-color: #1a1a2e !important; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #12121f !important; color: #f5f5f0 !important; }
      .email-wrapper { background-color: #1a1a2e !important; }
      a { color: #f5f5f0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:20px 0;font-family:'Roboto Slab',Georgia,'Times New Roman',serif;background:#12121f;color:#f5f5f0;">
  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-collapse:collapse;">
    <!-- HEADER -->
    <tr>
      <td style="padding:28px 40px 24px;border-bottom:3px solid #4f8ef7;">
        <p style="margin:0 0 6px;font-family:${MONO};font-size:9px;color:#9898b0;letter-spacing:3px;text-transform:uppercase;">Open Source Intelligence // For Operator Use</p>
        <h1 style="margin:0 0 6px;font-size:26px;font-weight:600;color:#4f8ef7;letter-spacing:3px;font-family:${MONO};text-transform:uppercase;">Project Vigil</h1>
        <p style="margin:0;font-size:12px;color:#a0a0b8;font-family:${MONO};letter-spacing:1px;">Daily Intelligence Brief — ${date} · ${time}</p>
      </td>
    </tr>

    <!-- SECTIONS -->
    ${sections}

    <!-- CROSS-SECTOR ANALYSIS -->
    <tr>
      <td style="padding:22px 40px;background:#12121f;border-top:3px solid #4f8ef7;">
        <p style="margin:0 0 10px;font-size:10px;color:#4f8ef7;font-family:${MONO};letter-spacing:2px;text-transform:uppercase;">🔎 Analyst Interpretation — Cross-Sector</p>
        <p style="margin:0;font-size:13px;color:#c8c8de;line-height:1.8;font-family:${BODY};font-weight:300;">${newsletter.crossSectorAnalysis || 'Insufficient data for cross-sector analysis.'}</p>
      </td>
    </tr>

    <!-- STATS -->
    ${stats}

    <!-- FOOTER -->
    <tr>
      <td style="padding:14px 40px;background:#12121f;border-top:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0;font-size:10px;color:#606078;font-family:${MONO};text-align:center;letter-spacing:1px;">
          Generated by Project Vigil · ${newsletter.generatedAt.toISOString()}
          ${recipientEmail ? `· <a href="mailto:unsubscribe@vigil.local?subject=Unsubscribe&body=${encodeURIComponent(recipientEmail)}" style="color:#606078;">Unsubscribe</a>` : ''}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderPlainText(newsletter: Newsletter): string {
  const date = newsletter.generatedAt.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  });

  const sectionTexts = newsletter.sections.map((s) => {
    const label = SECTION_LABELS[s.region] ?? s.region.toUpperCase();

    if (s.isNominal) {
      const lastCollection = s.lastCollectionAt
        ? new Date(s.lastCollectionAt).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short',
          })
        : 'Unknown';
      return `${label}\n${'─'.repeat(60)}\n▬▬▬ NO NEW DEVELOPMENTS — ${s.region.toUpperCase()} NOMINAL ▬▬▬\nMonitoring continues. Last collection: ${lastCollection}.`;
    }

    const items = s.articles
      .slice(0, 4)
      .map((a, i) => {
        const temporal = temporalLabel(a.publishedAt, newsletter.generatedAt);
        return `${i + 1}. ${a.title}\n   ${a.outletName} · Trust: ${(a.trustRating * 100).toFixed(0)}% (${trustBreakdown(a)})${temporal ? ` · ${temporal}` : ''}${a.vettingFlag ? ` · ${a.vettingFlag}` : ''}\n   ${a.summary}\n   ${a.url}`;
      })
      .join('\n\n');

    let analysis = '';
    if (s.structuredAssessment) {
      const sa = s.structuredAssessment;
      analysis = [
        `SITUATION: ${sa.situation}`,
        `ASSESSMENT: ${sa.assessment}`,
        `CONFIDENCE: ${sa.confidence} — ${sa.confidenceReasoning}`,
        `IMPLICATIONS: ${sa.implications}`,
        `WATCH LIST:\n${sa.watchList.map((w) => `  ▸ ${w}`).join('\n')}`,
      ].join('\n');
    } else {
      analysis = s.interpretiveSummary || 'N/A';
    }

    return `${label}\n${'─'.repeat(60)}\n${items || 'No articles.'}\n\n${analysis}`;
  });

  const confDist = newsletter.stats.confidenceDistribution;
  const confStats = confDist
    ? `\nConfidence: HIGH ${confDist.high} · MODERATE ${confDist.moderate} · LOW ${confDist.low} · NOMINAL ${confDist.nominal}`
    : '';

  return [
    'PROJECT VIGIL — DAILY INTELLIGENCE BRIEF',
    date,
    '═'.repeat(60),
    '',
    ...sectionTexts.map((s) => s + '\n'),
    '🔎 CROSS-SECTOR ANALYSIS',
    '─'.repeat(60),
    newsletter.crossSectorAnalysis || 'N/A',
    '',
    '📊 SOURCE STATS',
    `Articles: ${newsletter.stats.totalArticles} · Corroborated: ${(newsletter.stats.corroborationRate * 100).toFixed(0)}% · Avg Trust: ${(newsletter.stats.avgTrustRating * 100).toFixed(0)}%${confStats}`,
  ].join('\n');
}
