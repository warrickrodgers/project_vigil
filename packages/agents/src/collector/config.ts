import type { Region } from '@vigil/shared';

export interface RegionConfig {
  region: Region;
  displayName: string;
  contextPrompt: string;
  baseTopics: string[];
}

export const REGION_CONFIGS: Record<Region, RegionConfig> = {
  local: {
    region: 'local',
    displayName: 'Kansas City Metro',
    contextPrompt:
      'Focus on Kansas City, MO and surrounding metro area including Overland Park and Independence. ' +
      'Cover city council, county government, Missouri/Kansas state legislature, local economy, ' +
      'regional infrastructure, and public safety.',
    baseTopics: [
      'kansas city politics government',
      'KC metro development infrastructure',
      'missouri state legislature',
      'kansas city economy business',
      'KC public safety crime',
    ],
  },
  usa: {
    region: 'usa',
    displayName: 'USA National',
    contextPrompt:
      'Focus on US federal government, Congress, Supreme Court, federal regulations, ' +
      'national economic trends, and domestic policy developments affecting Americans broadly.',
    baseTopics: [
      'US Congress legislation',
      'federal policy regulation',
      'US economy inflation jobs',
      'Supreme Court ruling',
      'executive branch policy',
    ],
  },
  geopolitical: {
    region: 'geopolitical',
    displayName: 'Geopolitical',
    contextPrompt:
      'Focus on international relations, geopolitical conflicts, global trade, foreign policy, ' +
      'and cross-border economic developments. Prioritize events with implications for US interests ' +
      'or global stability.',
    baseTopics: [
      'international security conflict',
      'global trade economics',
      'foreign policy diplomacy',
      'geopolitical tensions military',
      'international institutions NATO UN',
    ],
  },
};
