import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// Get all players
router.get('/', async (_req, res) => {
  const players = await prisma.player.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
  res.json(players);
});

// Create player
router.post('/', async (req, res) => {
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

export default router;
