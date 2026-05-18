import type { Region } from '@vigil/shared';

export interface QueryTemplates {
  hardNews: string[];
  influenceMapping: string[];
  patternDetection: string[];
  chessboardConnectors: string[];
}

export interface RegionConfig {
  region: Region;
  displayName: string;
  contextPrompt: string;
  queryTemplates: QueryTemplates;
  /** Maximum age of Tavily search results in days for daily collection runs. */
  maxAgeDays: number;
  metro?: string;
  states?: string[];
  commodities?: string[];
}

export const REGION_CONFIGS: Record<Region, RegionConfig> = {
  local: {
    region: 'local',
    displayName: 'Kansas City Metro',
    contextPrompt:
      'Focus on Kansas City, MO and surrounding metro area including Overland Park and Independence. ' +
      'Cover city council, county government, Missouri/Kansas state legislature, local economy, ' +
      'regional infrastructure, and public safety.',
    metro: 'Kansas City',
    states: ['Missouri', 'Kansas'],
    commodities: ['grain', 'livestock', 'natural gas'],
    queryTemplates: {
      hardNews: [
        'Kansas City city council {month} {year} vote ordinance legislation',
        'KC mayor announcement decision {month} {year}',
        '{state} state legislature {month} {year} new bill law signed',
        'Kansas City metro infrastructure development project {month} {year}',
      ],
      influenceMapping: [
        'Kansas City political donor lobbying contract award {year}',
        'KC development project contractor bid award {month} {year}',
        '{state} federal grant contract award {month} {year}',
        'Kansas City PAC campaign spending political influence {year}',
      ],
      patternDetection: [
        'Kansas City crime statistics homicide trend {month} {year}',
        'KC metro housing market home prices {month} {year}',
        '{state} employment jobs economic indicator {month} {year}',
        'Kansas City public safety police incident {month} {year}',
      ],
      chessboardConnectors: [
        'federal tariff {commodity} {state} farmer agriculture impact {month} {year}',
        'US immigration policy Kansas City workforce labor {month} {year}',
        'defense contractor Kansas City {state} federal budget {year}',
        'global supply chain logistics Kansas City {month} {year}',
      ],
    },
    maxAgeDays: 2,
  },
  usa: {
    region: 'usa',
    displayName: 'USA National',
    contextPrompt:
      'Focus on US federal government, Congress, Supreme Court, federal regulations, ' +
      'national economic trends, and domestic policy developments affecting Americans broadly.',
    commodities: ['oil', 'grain', 'semiconductors'],
    queryTemplates: {
      hardNews: [
        'Congress legislation vote {month} {year} passed signed',
        'federal agency rule regulation enforcement {month} {year}',
        'Supreme Court ruling decision {month} {year}',
        'White House executive order presidential action {month} {year}',
      ],
      influenceMapping: [
        'lobbying spending federal Congress {month} {year}',
        'corporate PAC political donation candidate {month} {year}',
        'think tank policy brief federal recommendation {month} {year}',
        'revolving door federal regulator industry executive {year}',
      ],
      patternDetection: [
        'US CPI inflation employment jobs report {month} {year}',
        'federal deficit debt ceiling spending {month} {year}',
        'US housing starts mortgage rates {month} {year}',
        'consumer confidence retail spending index {month} {year}',
      ],
      chessboardConnectors: [
        'foreign policy impact US domestic economy {month} {year}',
        'global {commodity} price US market inflation {month} {year}',
        'China trade tariff US manufacturing jobs {month} {year}',
        'NATO alliance US military commitment defense {month} {year}',
      ],
    },
    maxAgeDays: 2,
  },
  geopolitical: {
    region: 'geopolitical',
    displayName: 'Geopolitical',
    contextPrompt:
      'Focus on international relations, geopolitical conflicts, global trade, foreign policy, ' +
      'and cross-border economic developments. Prioritize events with implications for US interests ' +
      'or global stability.',
    commodities: ['oil', 'grain', 'rare earth minerals'],
    queryTemplates: {
      hardNews: [
        'armed conflict military escalation offensive {month} {year}',
        'diplomatic summit agreement treaty signing {month} {year}',
        'UN Security Council resolution vote {month} {year}',
        'sanctions enforcement new restriction {month} {year}',
      ],
      influenceMapping: [
        'foreign influence operation disinformation propaganda {month} {year}',
        'intelligence covert operation activity {month} {year}',
        'sovereign wealth fund strategic investment {month} {year}',
        'foreign government lobbying US Congress {month} {year}',
      ],
      patternDetection: [
        'global trade disruption supply chain {commodity} {month} {year}',
        'refugee migration crisis border {month} {year}',
        'cyber attack critical infrastructure nation-state {month} {year}',
        '{commodity} price market energy commodity {month} {year}',
      ],
      chessboardConnectors: [
        'geopolitical conflict impact US Midwest economy {month} {year}',
        'global {commodity} price US agriculture Midwest {month} {year}',
        'foreign adversary investment US heartland infrastructure {month} {year}',
        'China Russia strategic competition US national interest {month} {year}',
      ],
    },
    maxAgeDays: 2,
  },
};
