import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all players
router.get('/', authenticate, async (_req, res) => {
  const players = await prisma.player.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
  res.json(players);
});

// Create player (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, email } = req.body;

    if (!email?.endsWith('@scelto.no')) {
      return res.status(400).json({ error: 'Email must be @scelto.no' });
    }

    const player = await prisma.player.create({
      data: { name, email },
      select: { id: true, name: true, email: true, isAdmin: true },
    });

    res.status(201).json(player);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Player with that email already exists' });
    }
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Toggle admin status (admin only)
router.patch('/:id/admin', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const playerId = req.params.id as string;
    const player = await prisma.player.findUnique({ where: { id: playerId } });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (player.id === req.playerId) {
      return res.status(400).json({ error: 'Cannot change your own admin status' });
    }

    const updated = await prisma.player.update({
      where: { id: playerId },
      data: { isAdmin: !player.isAdmin },
      select: { id: true, name: true, email: true, isAdmin: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

export default router;
