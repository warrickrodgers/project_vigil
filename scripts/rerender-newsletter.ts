/**
 * Re-renders the 2026-05-06 newsletter through the updated template.
 * Reconstructs the Newsletter object from the original seed data + assessments
 * so the output is identical content with the new Gmail-compatible styling.
 *
 * Run: npx tsx scripts/rerender-newsletter.ts
 * Output: data/newsletters/2026-05-06T16-12-restyled.html
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderHtmlEmail } from '../packages/agents/src/aggregator/template.js';
import type { Newsletter } from '../packages/agents/src/aggregator/types.js';

const GENERATED_AT = new Date('2026-05-06T16:12:54.275Z');

const newsletter: Newsletter = {
  generatedAt: GENERATED_AT,
  lookbackHours: 24,
  crossSectorAnalysis: 'Insufficient data for cross-sector analysis.',
  stats: {
    totalArticles: 6,
    corroborationRate: 0,
    avgTrustRating: 0.57,
    avgBiasScore: 0.075,
    sectorCounts: { local: 2, usa: 2, geopolitical: 2 },
    confidenceDistribution: { high: 1, moderate: 2, low: 0, nominal: 0 },
  },
  sections: [
    {
      region: 'local',
      label: '📍 LOCAL INTEL — Kansas City Metro',
      interpretiveSummary: '',
      articles: [
        {
          id: 'local-1',
          url: 'https://www.kcur.org/news/2025-11-10/kc-homicide-rate-decline',
          title: "Kansas City's homicide rate drops 18% in 2025, police chief attributes shift to community policing",
          summary: 'KCPD reported 142 homicides through October 2025, down from 173 in the same period last year.',
          biasScore: -0.1,
          trustRating: 0.59,
          region: 'local',
          sectorTags: '["policy","legal"]',
          collectedAt: new Date('2025-11-10T18:00:00Z'),
          publishedAt: new Date('2025-11-10T18:00:00Z'),
          corroboratedById: null,
          vettingFlag: null,
          outletName: 'KCUR',
          outletReliabilityBase: 0.82,
          rankScore: 0.59,
          isCorroborated: false,
        },
        {
          id: 'local-2',
          url: 'https://www.kansascity.com/news/local/article-kc-transit-2025',
          title: 'KC Metro approves $2.4B streetcar expansion to Overland Park',
          summary: 'The Kansas City Area Transportation Authority voted 7-2 to extend the Main Street streetcar line south into Johnson County, with construction expected to begin in late 2026.',
          biasScore: -0.15,
          trustRating: 0.53,
          region: 'local',
          sectorTags: '["policy","economy"]',
          collectedAt: new Date('2025-11-12T14:30:00Z'),
          publishedAt: new Date('2025-11-12T14:30:00Z'),
          corroboratedById: null,
          vettingFlag: null,
          outletName: 'KC Star',
          outletReliabilityBase: 0.78,
          rankScore: 0.53,
          isCorroborated: false,
        },
      ],
      structuredAssessment: {
        confidence: 'MODERATE',
        situation:
          'KCPD reports 142 homicides through October 2025, an 18% decrease from 173 during the same period in 2024. Simultaneously, the KCATA approved a $2.4B expansion of the Main Street streetcar into Overland Park, Johnson County, via a 7-2 vote, with construction scheduled for late 2026.',
        assessment:
          "The 18% reduction in homicides is LIKELY (55-80%) a result of KCPD shifting operational incentives toward community-resource allocation to stabilize high-volatility precincts. This pattern suggests a transition from reactive to preventative policing models seen in peer midwestern metros. We assess with HIGH CONFIDENCE that the $2.4B streetcar expansion is VERY LIKELY (80-95%) to trigger a speculative real estate cycle along the Metcalf Avenue and I-435 corridors. This project serves the incentive of Johnson County leadership to capture high-density commercial tax revenue while connecting the suburban labor pool to the urban core. The political viability of this cross-border investment was LIKELY (55-80%) contingent on the downward trend in urban violent crime, as Johnson County stakeholders require perceived safety to justify fiscal integration with the KCMO transit system.",
        confidenceReasoning:
          "Data is derived from two established local outlets with moderate trust scores. While the homicide figures are official KCPD data, the long-term impact of the streetcar expansion remains subject to federal matching fund availability which is not yet fully secured.",
        implications:
          "Property owners in the Crossroads and along the Main Street corridor should prepare for accelerated assessment increases. Stakeholders in Overland Park, specifically near the Metcalf corridor, should anticipate rezoning initiatives favoring high-density mixed-use development. Residents should monitor the I-435/Main Street interchange for preliminary utility surveys starting in early 2026.",
        watchList: [
          "KCPD Q4 2025 homicide totals to confirm if the 18% reduction trend holds through the holiday season",
          "Johnson County Board of Commissioners' vote on specific tax levies for streetcar operational costs",
          "New permit filings for multi-family residential units within 0.5 miles of the proposed Overland Park transit stops",
        ],
      },
    },
    {
      region: 'usa',
      label: '🇺🇸 USA INTEL — National',
      interpretiveSummary:
        "The Federal Reserve maintained interest rates at 4.75%–5.00% while signaling a shift toward gradual easing with 50 basis points of projected cuts in 2026. Concurrently, Department of Homeland Security data indicates a significant decline in southern border crossings, reaching an 18-month low of 98,000 in October 2025 following enhanced enforcement measures. These developments reflect a dual focus on stabilizing the domestic economy and tightening border security protocols. Analysts should monitor upcoming inflation metrics for impacts on the Fed's timeline and the long-term efficacy of current migration deterrents.",
      articles: [
        {
          id: 'usa-1',
          url: 'https://apnews.com/article/fed-rate-decision-november-2025',
          title: 'Federal Reserve holds rates steady, signals two cuts in 2026',
          summary:
            'The Federal Open Market Committee voted unanimously to hold the federal funds rate at 4.75%–5.00%, while revised dot-plot projections point to 50 basis points of cuts next year.',
          biasScore: 0.0,
          trustRating: 0.76,
          region: 'usa',
          sectorTags: '["economy","policy"]',
          collectedAt: new Date('2025-11-06T19:00:00Z'),
          publishedAt: new Date('2025-11-06T19:00:00Z'),
          corroboratedById: null,
          vettingFlag: null,
          outletName: 'AP News',
          outletReliabilityBase: 0.96,
          rankScore: 0.76,
          isCorroborated: false,
        },
        {
          id: 'usa-2',
          url: 'https://www.foxnews.com/politics/border-crossings-november-2025',
          title: 'Border crossings hit 18-month low amid new enforcement surge, DHS says',
          summary:
            'Department of Homeland Security data shows illegal crossings at the southern border fell to 98,000 in October 2025, the lowest monthly figure since May 2024.',
          biasScore: 0.55,
          trustRating: 0.25,
          region: 'usa',
          sectorTags: '["policy","legal"]',
          collectedAt: new Date('2025-11-08T21:15:00Z'),
          publishedAt: new Date('2025-11-08T21:15:00Z'),
          corroboratedById: null,
          vettingFlag: null,
          outletName: 'Fox News',
          outletReliabilityBase: 0.62,
          rankScore: 0.25,
          isCorroborated: false,
        },
      ],
    },
    {
      region: 'geopolitical',
      label: '🌐 GEOPOLITICAL INTEL — Global',
      interpretiveSummary: '',
      articles: [
        {
          id: 'geo-1',
          url: 'https://www.reuters.com/world/asia-pacific/taiwan-strait-drills-2025',
          title: "China conducts 72-hour naval exercise in Taiwan Strait, Taiwan's military on heightened alert",
          summary:
            'The PLA Navy deployed two carrier groups for drills that included live-fire exercises in the northern and southern Taiwan Strait corridors.',
          biasScore: 0.0,
          trustRating: 0.77,
          region: 'geopolitical',
          sectorTags: '["conflict","policy"]',
          collectedAt: new Date('2025-11-14T06:00:00Z'),
          publishedAt: new Date('2025-11-14T06:00:00Z'),
          corroboratedById: null,
          vettingFlag: null,
          outletName: 'Reuters',
          outletReliabilityBase: 0.97,
          rankScore: 0.77,
          isCorroborated: false,
        },
        {
          id: 'geo-2',
          url: 'https://www.scmp.com/news/china/diplomacy/article-taiwan-strait-drills-2025',
          title: 'PLA drills in Taiwan Strait described as routine and defensive by Beijing spokesman',
          summary:
            "China's Ministry of National Defence characterised the exercise as a planned defensive drill responding to 'provocations by external forces'.",
          biasScore: 0.1,
          trustRating: 0.52,
          region: 'geopolitical',
          sectorTags: '["conflict","policy"]',
          collectedAt: new Date('2025-11-14T09:45:00Z'),
          publishedAt: new Date('2025-11-14T09:45:00Z'),
          corroboratedById: null,
          vettingFlag: null,
          outletName: 'SCMP',
          outletReliabilityBase: 0.75,
          rankScore: 0.52,
          isCorroborated: false,
        },
      ],
      structuredAssessment: {
        confidence: 'HIGH',
        situation:
          "The People's Liberation Army (PLA) Navy conducted a 72-hour live-fire exercise in the northern and southern corridors of the Taiwan Strait. The operation involved two carrier groups. Beijing officially characterized the maneuvers as routine defensive drills responding to external provocations. Taiwan's military transitioned to heightened alert status in response to the deployment.",
        assessment:
          "The PLA is very likely (80-95%) utilizing these drills to normalize a dual-carrier presence in the Taiwan Strait, marking a shift from the established pattern of single-carrier or destroyer-led incursions. This behavior is rational given Beijing's incentive to erode the tactical significance of the median line and reduce the strategic warning window for regional adversaries. By framing these maneuvers as 'routine,' the PLA aims to desensitize international observers to high-intensity mobilization, a playbook previously used to shift the status quo in the South China Sea. This pattern indicates a transition toward a permanent 'active blockade' capability. Geopolitically, this escalation will likely (55-80%) result in increased maritime insurance premiums for commercial shipping, which will reach global consumers via higher freight costs for semiconductor and electronics exports originating in the region.",
        confidenceReasoning:
          "Tactical details including duration, location, and asset composition (two carrier groups) are corroborated by a high-trust source (77%). Official state positioning from SCMP (52%) provides the necessary incentive context. The scale of the exercise is verifiable via regional radar and satellite telemetry.",
        implications:
          "Maritime logistics stakeholders and semiconductor supply chain managers should prepare for increased transit volatility and potential 'gray zone' lane closures. Decision-makers should monitor for the integration of civilian roll-on/roll-off (Ro-Ro) vessels into future exercises as a primary indicator of amphibious mobilization readiness.",
        watchList: [
          "Integration of civilian Ro-Ro vessels into PLA naval formations during subsequent drills",
          "Spikes in maritime 'war risk' insurance premiums for vessels transiting the Taiwan Strait",
          "PLA Southern Theater Command mobilization of long-range rocket artillery (PHL-191) at coastal launch sites",
        ],
      },
    },
  ],
};

async function main() {
  const html = renderHtmlEmail(newsletter);
  const dir = join(process.cwd(), 'data', 'newsletters');
  await mkdir(dir, { recursive: true });
  const outPath = join(dir, '2026-05-06T16-12-restyled.html');
  await writeFile(outPath, html, 'utf8');
  console.log(`Written: data/newsletters/2026-05-06T16-12-restyled.html (${html.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
