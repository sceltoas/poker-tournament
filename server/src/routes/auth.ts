import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { prisma } from '../index';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth';
import { sendMagicLink } from '../services/email';

const router = Router();

function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// Request magic link
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !email.endsWith('@scelto.no')) {
      return res.status(400).json({ error: 'Must use a @scelto.no email address' });
    }

    let player = await prisma.player.findUnique({ where: { email } });
    if (!player) {
      player = await prisma.player.create({
        data: { name: deriveNameFromEmail(email), email },
      });
    }

    const token = uuid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.magicLink.create({
      data: { playerId: player.id, token, expiresAt },
    });

    // Find any active tournament for the email subject
    const activeTournament = await prisma.tournament.findFirst({
      where: { status: 'ACTIVE' },
    });

    try {
      await sendMagicLink(
        player.email,
        player.name,
        token,
        activeTournament?.name || 'Scelto Poker'
      );
    } catch (emailError) {
      console.error('Email send failed (login link still created):', emailError);
      return res.status(200).json({
        message: 'Login link created but email delivery failed. Check server logs.',
        emailError: true,
      });
    }

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
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const player = await prisma.player.findUnique({
    where: { id: req.playerId! },
  });

  if (!player) return res.status(404).json({ error: 'Player not found' });

  res.json({
    id: player.id,
    name: player.name,
    email: player.email,
    isAdmin: player.isAdmin,
  });
});

export default router;
