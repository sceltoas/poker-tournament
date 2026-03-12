import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { prisma } from '../index';
import { generateToken } from '../middleware/auth';
import { sendMagicLink } from '../services/email';

const router = Router();

// Request magic link
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    const player = await prisma.player.findUnique({ where: { email } });
    if (!player) {
      return res.status(404).json({ error: 'No player found with that email' });
    }

    const token = uuid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.magicLink.create({
      data: { playerId: player.id, token, expiresAt },
    });

    // Find any active tournament for the email subject
    const activeTournament = await prisma.tournament.findFirst({
      where: { status: { in: ['REGISTRATION', 'ACTIVE'] } },
    });

    await sendMagicLink(
      player.email,
      player.name,
      token,
      activeTournament?.name || 'Scelto Poker'
    );

    res.json({ message: 'Login link sent to your email' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to send login link' });
  }
});

// Verify magic link
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }

    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
      include: { player: true },
    });

    if (!magicLink) {
      return res.status(404).json({ error: 'Invalid link' });
    }

    if (magicLink.usedAt) {
      return res.status(400).json({ error: 'Link already used' });
    }

    if (magicLink.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Link expired' });
    }

    // Mark as used
    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    });

    const jwt = generateToken(magicLink.player.id);

    res.json({
      token: jwt,
      player: {
        id: magicLink.player.id,
        name: magicLink.player.name,
        email: magicLink.player.email,
        isAdmin: magicLink.player.isAdmin,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get current player
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const jwt = await import('jsonwebtoken');
    const payload = jwt.verify(
      authHeader.substring(7),
      process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod'
    ) as { playerId: string };

    const player = await prisma.player.findUnique({
      where: { id: payload.playerId },
    });

    if (!player) return res.status(404).json({ error: 'Player not found' });

    res.json({
      id: player.id,
      name: player.name,
      email: player.email,
      isAdmin: player.isAdmin,
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
