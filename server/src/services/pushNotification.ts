import webpush from 'web-push';
import { prisma } from '../index';

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@scelto.no',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, any>;
}

export async function sendPushToPlayer(playerId: string, payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { playerId },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        // Remove invalid subscriptions
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        throw error;
      }
    })
  );

  return results;
}

export async function sendPushToTournamentPlayers(
  tournamentId: string,
  payload: PushPayload,
  excludePlayerId?: string
) {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId,
      status: { in: ['ACTIVE', 'AFK'] },
      ...(excludePlayerId ? { playerId: { not: excludePlayerId } } : {}),
    },
    select: { playerId: true },
  });

  await Promise.allSettled(
    tournamentPlayers.map((tp) => sendPushToPlayer(tp.playerId, payload))
  );
}
