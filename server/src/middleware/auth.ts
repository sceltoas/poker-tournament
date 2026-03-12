import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod';

export interface AuthRequest extends Request {
  playerId?: string;
  isAdmin?: boolean;
}

export function generateToken(playerId: string): string {
  return jwt.sign({ playerId }, JWT_SECRET, { expiresIn: '7d' });
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, JWT_SECRET) as { playerId: string };
    const player = await prisma.player.findUnique({ where: { id: payload.playerId } });

    if (!player) {
      return res.status(401).json({ error: 'Player not found' });
    }

    req.playerId = player.id;
    req.isAdmin = player.isAdmin;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
