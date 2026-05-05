import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@vigil/db';

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return new Response('Missing CLERK_WEBHOOK_SECRET', { status: 500 });

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTs = headerPayload.get('svix-timestamp');
  const svixSig = headerPayload.get('svix-signature');

  if (!svixId || !svixTs || !svixSig) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTs,
      'svix-signature': svixSig,
    }) as WebhookEvent;
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (evt.type) {
    case 'user.created': {
      const email = evt.data.email_addresses?.[0]?.email_address;
      if (email) {
        await prisma.subscriber.upsert({
          where: { email },
          update: { active: true },
          create: { email, tier: 'free', active: true },
        });
      }
      break;
    }

    case 'user.deleted': {
      // UserDeletedJSON only carries the Clerk user id, not email addresses.
      // Subscribers are keyed by email and don't store clerkUserId yet, so we
      // log the deletion and rely on manual deactivation via add-subscriber.ts for now.
      console.log(`[clerk webhook] user.deleted: ${evt.data.id}`);
      break;
    }
  }

  return new Response('OK', { status: 200 });
}
