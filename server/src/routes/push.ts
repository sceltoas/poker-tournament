import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Save push subscription
router.post('/subscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const { endpoint, keys } = req.body;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, playerId: req.playerId! },
      create: {
        playerId: req.playerId!,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    res.json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Remove push subscription
router.post('/unsubscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ message: 'Unsubscribed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
