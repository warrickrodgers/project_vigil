/**
 * Sends the restyled newsletter HTML via SES for visual testing.
 * Run: npx tsx scripts/send-test-email.ts
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const HTML_PATH = join(process.cwd(), 'data', 'newsletters', '2026-05-06T16-12-restyled.html');

const to = process.env['NEWSLETTER_RECIPIENTS'] ?? '';
const from = process.env['SES_FROM_ADDRESS'] ?? '';

if (!to || !from) {
  console.error('Missing NEWSLETTER_RECIPIENTS or SES_FROM_ADDRESS in .env');
  process.exit(1);
}

async function main() {
  const html = await readFile(HTML_PATH, 'utf8');
  const ses = new SESv2Client({ region: process.env['AWS_REGION'] ?? 'us-east-1' });

  await ses.send(new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: '[VIGIL] Intel Brief — Test (May 6)', Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    },
  }));

  console.log(`Sent to ${to} from ${from}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
