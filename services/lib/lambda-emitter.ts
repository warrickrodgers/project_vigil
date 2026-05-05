import type { Region } from '@vigil/shared';
import type { CollectorEmitter } from '@vigil/agents';
import { logger } from '@vigil/clients';

/** No-op CollectorEmitter for headless Lambda runs — no Discord available. */
export function createLambdaEmitter(_region: Region): CollectorEmitter {
  return {
    channelIds: { local: '', usa: '', geopolitical: '' },
    sendEmbed: async () => {},
    sendMessage: async (msg: string) => {
      logger.info('[lambda-emitter]', { msg });
    },
    // Auto-approve all articles in Lambda — operator reviews happen via Discord bot.
    requestApproval: async () => ({ approved: true, action: 'approve' as const }),
    // Auto-skip in Lambda — low-trust / unknown-outlet articles are skipped silently.
    requestSkipReview: async () => ({ keep: false }),
  };
}
