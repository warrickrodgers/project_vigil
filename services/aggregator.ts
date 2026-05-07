// Minimal Lambda handler type — avoids @types/aws-lambda dep until AWS is bootstrapped.
type LambdaHandler<TEvent, TResult> = (event: TEvent) => Promise<TResult>;

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import { prisma } from '@vigil/db';
import { APICallTracker, GeminiClient, logger } from '@vigil/clients';
import { AggregatorAgent, makeVigilDB, renderHtmlEmail, renderPlainText } from '@vigil/agents';
import type { AggregatorEmitter } from '@vigil/agents';

export interface AggregatorEvent {
  /** Hours to look back for articles. Defaults to 24. */
  lookbackHours?: number;
  /** True when invoked from the Sunday free-tier weekly schedule. */
  isFreeWeekly?: boolean;
}

export interface AggregatorResult {
  success: boolean;
  totalArticles: number;
  recipientCount: number;
}

const PAID_TIERS = ['pro', 'regional_pro', 'enterprise'];

const noopEmitter: AggregatorEmitter = {
  generalChannelId: '',
  sendMessage: async (msg: string) => { logger.info('[aggregator-lambda]', { msg }); },
  sendEmbeds: async () => {},
};

export const handler: LambdaHandler<AggregatorEvent, AggregatorResult> = async (event) => {
  const tracker = new APICallTracker();
  const gemini = new GeminiClient(process.env['GEMINI_API_KEY'] ?? '', tracker);
  const agent = new AggregatorAgent(gemini, noopEmitter, makeVigilDB(prisma));

  const newsletter = await agent.digest(event.lookbackHours);
  const html = renderHtmlEmail(newsletter);
  const plain = renderPlainText(newsletter);

  // Query active subscribers from DB, filtered by cadence
  const tierFilter = event.isFreeWeekly ? { tier: 'free' } : { tier: { in: PAID_TIERS } };
  const subscribers = await prisma.subscriber.findMany({
    where: { active: true, ...tierFilter },
    select: { email: true },
  });

  // Fall back to env var for backward compat (pre-subscriber-table deploys)
  const recipients: string[] = subscribers.length > 0
    ? subscribers.map((s) => s.email)
    : (process.env['NEWSLETTER_RECIPIENTS'] ?? '').split(',').map((r) => r.trim()).filter(Boolean);

  if (recipients.length === 0) {
    logger.warn('No subscribers or NEWSLETTER_RECIPIENTS configured — skipping send');
    await tracker.flush();
    return { success: true, totalArticles: newsletter.stats.totalArticles, recipientCount: 0 };
  }

  const ses = new SESv2Client({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
  const dateLabel = newsletter.generatedAt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  });
  const subject = `[VIGIL] Intel Brief — ${dateLabel}`;

  // Send individually so each email has a personalized unsubscribe link
  let sent = 0;
  for (const email of recipients) {
    try {
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: process.env['SES_FROM_ADDRESS'] ?? '',
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: renderHtmlEmail(newsletter, email), Charset: 'UTF-8' },
                Text: { Data: plain, Charset: 'UTF-8' },
              },
            },
          },
        }),
      );
      sent++;
    } catch (err) {
      logger.error('SES send failed', { email, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await tracker.flush();
  logger.info('Newsletter dispatched via SES', { sent, total: recipients.length, totalArticles: newsletter.stats.totalArticles });

  return { success: true, totalArticles: newsletter.stats.totalArticles, recipientCount: sent };
};
