import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendMagicLink } from '../services/email';
import { sendPushToTournamentPlayers } from '../services/pushNotification';
import {
  emitTournamentUpdate,
  emitPlayerEliminated,
  emitMergeSuggestion,
  emitBeerToast,
  emitPlayerStatusChange,
  emitTablesMerged,
  emitTournamentFinished,
  emitPlayerJoined,
} from '../services/websocket';
import { v4 as uuid } from 'uuid';

const router = Router();

// Merge threshold is calculated dynamically as half of maxSeatsPerTable

// ─── Helper: get full tournament state ──────────────────────────────
async function getFullTournament(tournamentId: string) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      tables: {
        orderBy: { tableNumber: 'asc' },
        include: {
          players: {
            include: { player: { select: { id: true, name: true, email: true } } },
            orderBy: { seatNumber: 'asc' },
          },
        },
      },
      players: {
        include: { player: { select: { id: true, name: true, email: true } } },
        orderBy: [{ finishPosition: 'asc' }, { eliminatedAt: 'desc' }],
      },
    },
  });
}

// ─── Helper: check for merge suggestions ────────────────────────────
async function checkMergeSuggestions(io: SocketIOServer, tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  const maxSeats = tournament?.maxSeatsPerTable ?? 8;
  const mergeThreshold = Math.ceil(maxSeats / 2);

  const tables = await prisma.tournamentTable.findMany({
    where: { tournamentId, isActive: true },
    include: {
      players: { where: { status: { in: ['ACTIVE', 'AFK'] } } },
    },
    orderBy: { tableNumber: 'asc' },
  });

  const activeTables = tables.filter((t) => t.players.length > 0);

  if (activeTables.length <= 1) return;

  const lowTables = activeTables.filter((t) => t.players.length < mergeThreshold);

  if (lowTables.length > 0) {
    const smallest = lowTables.sort((a, b) => a.players.length - b.players.length)[0];
    const targetCandidates = activeTables
      .filter((t) => t.id !== smallest.id)
      .map((t) => ({ ...t, room: maxSeats - t.players.length }))
      .filter((t) => t.room >= smallest.players.length)
      .sort((a, b) => b.room - a.room);

    if (targetCandidates.length > 0) {
      emitMergeSuggestion(io, tournamentId, {
        fromTable: { id: smallest.id, tableNumber: smallest.tableNumber, playerCount: smallest.players.length },
        toTable: { id: targetCandidates[0].id, tableNumber: targetCandidates[0].tableNumber, room: targetCandidates[0].room },
        message: `Table ${smallest.tableNumber} has only ${smallest.players.length} player(s). Merge into Table ${targetCandidates[0].tableNumber}?`,
      });
    }
  }
}

// ─── Helper: check if tournament should end ─────────────────────────
async function checkTournamentEnd(io: SocketIOServer, tournamentId: string) {
  const activePlayers = await prisma.tournamentPlayer.count({
    where: { tournamentId, status: { in: ['ACTIVE', 'AFK'] } },
  });

  if (activePlayers <= 1) {
    const winner = await prisma.tournamentPlayer.findFirst({
      where: { tournamentId, status: { in: ['ACTIVE', 'AFK'] } },
      include: { player: true },
    });

    if (winner) {
      await prisma.tournamentPlayer.update({
        where: { id: winner.id },
        data: { finishPosition: 1 },
      });
    }

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'FINISHED', endedAt: new Date() },
    });

    const finalState = await getFullTournament(tournamentId);
    emitTournamentFinished(io, tournamentId, finalState);
    return true;
  }
  return false;
}

// ─── PUBLIC: active tournament status (no auth) ────────────────────
router.get('/active-status', async (_req, res) => {
  const tournament = await prisma.tournament.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      _count: { select: { players: true } },
      players: { where: { status: { in: ['ACTIVE', 'AFK'] } } },
    },
  });

  if (!tournament) {
    return res.json({ hasActive: false });
  }

  res.json({
    hasActive: true,
    name: tournament.name,
    playerCount: tournament._count.players,
    activePlayerCount: tournament.players.length,
  });
});

// ─── LIST tournaments ───────────────────────────────────────────────
router.get('/', authenticate, async (_req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { players: true } },
    },
  });
  res.json(tournaments);
});

// ─── GET single tournament (full state) ─────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const tournament = await getFullTournament(req.params.id as string);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  res.json(tournament);
});

// ─── CREATE tournament (admin) ──────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, playerIds, maxSeatsPerTable: rawMaxSeats } = req.body as { name: string; playerIds?: string[]; maxSeatsPerTable?: number };
    const maxSeats = Math.min(12, Math.max(2, rawMaxSeats || 8));

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Tournament name is required' });
    }

    const maxPlayers = maxSeats * 10;
    if (playerIds && playerIds.length > maxPlayers) {
      return res.status(400).json({ error: `Maximum ${maxPlayers} players (10 tables x ${maxSeats})` });
    }

    const tournament = await prisma.tournament.create({
      data: { name, status: 'ACTIVE', maxSeatsPerTable: maxSeats, startedAt: new Date() },
    });

    if (playerIds && playerIds.length > 0) {
      const numTables = Math.ceil(playerIds.length / maxSeats);
      const playersPerTable = Math.ceil(playerIds.length / numTables);

      const tables = [];
      for (let i = 0; i < numTables; i++) {
        const table = await prisma.tournamentTable.create({
          data: { tournamentId: tournament.id, tableNumber: i + 1 },
        });
        tables.push(table);
      }

      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

      for (let i = 0; i < shuffled.length; i++) {
        const tableIndex = Math.floor(i / playersPerTable);
        const seatNumber = (i % playersPerTable) + 1;

        await prisma.tournamentPlayer.create({
          data: {
            tournamentId: tournament.id,
            playerId: shuffled[i],
            tableId: tables[tableIndex].id,
            seatNumber,
          },
        });
      }

      const players = await prisma.player.findMany({
        where: { id: { in: playerIds } },
      });

      for (const player of players) {
        const token = uuid();
        await prisma.magicLink.create({
          data: {
            playerId: player.id,
            token,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        await sendMagicLink(player.email, player.name, token, name);
      }
    }

    const fullTournament = await getFullTournament(tournament.id);
    res.status(201).json(fullTournament);
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// ─── JOIN tournament (self-service) ─────────────────────────────────
router.post('/:id/join', authenticate, async (req: AuthRequest, res) => {
  const io: SocketIOServer = req.app.get('io');
  const tournamentId = req.params.id as string;
  const playerId = req.playerId!;

  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.status !== 'ACTIVE') return res.status(400).json({ error: 'Tournament is not active' });

    const existing = await prisma.tournamentPlayer.findFirst({
      where: { tournamentId, playerId },
    });
    if (existing) return res.status(409).json({ error: 'Already in tournament' });

    const maxSeats = tournament.maxSeatsPerTable;
    const maxPlayers = maxSeats * 10;
    const totalPlayers = await prisma.tournamentPlayer.count({ where: { tournamentId } });
    if (totalPlayers >= maxPlayers) return res.status(400).json({ error: 'Tournament is full' });

    // Find table with most available seats
    const tables = await prisma.tournamentTable.findMany({
      where: { tournamentId, isActive: true },
      include: { players: { where: { status: { in: ['ACTIVE', 'AFK'] } } } },
    });

    let targetTable = tables
      .map((t) => ({ ...t, room: maxSeats - t.players.length }))
      .filter((t) => t.room > 0)
      .sort((a, b) => b.room - a.room)[0];

    // No room at existing tables — create a new one
    if (!targetTable) {
      const tableCount = await prisma.tournamentTable.count({ where: { tournamentId } });
      if (tableCount >= 10) return res.status(400).json({ error: 'No available seats' });

      const maxTableNum = tables.length > 0 ? Math.max(...tables.map((t) => t.tableNumber)) : 0;
      const newTable = await prisma.tournamentTable.create({
        data: { tournamentId, tableNumber: maxTableNum + 1 },
      });
      targetTable = { ...newTable, players: [], room: maxSeats };
    }

    // Find first available seat (check ALL players at table for unique constraint)
    const allPlayersAtTable = await prisma.tournamentPlayer.findMany({
      where: { tableId: targetTable.id },
    });
    const occupiedSeats = new Set(allPlayersAtTable.map((p) => p.seatNumber));
    let seatNumber = 1;
    while (occupiedSeats.has(seatNumber) && seatNumber <= maxSeats) seatNumber++;

    await prisma.tournamentPlayer.create({
      data: { tournamentId, playerId, tableId: targetTable.id, seatNumber },
    });

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    const fullTournament = await getFullTournament(tournamentId);

    emitPlayerJoined(io, tournamentId, { playerName: player?.name });
    emitTournamentUpdate(io, tournamentId, fullTournament);

    res.status(201).json(fullTournament);
  } catch (error) {
    console.error('Join tournament error:', error);
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

// ─── ELIMINATE player ───────────────────────────────────────────────
router.post('/:id/eliminate/:playerId', authenticate, async (req: AuthRequest, res) => {
  const io: SocketIOServer = req.app.get('io');
  const tournamentId = req.params.id as string;
  const playerId = req.params.playerId as string;

  try {
    if (!req.isAdmin && req.playerId !== playerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const tp = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      include: { player: true },
    });

    if (!tp || tp.status === 'ELIMINATED') {
      return res.status(400).json({ error: 'Player not active in tournament' });
    }

    const activePlayers = await prisma.tournamentPlayer.count({
      where: { tournamentId, status: { in: ['ACTIVE', 'AFK'] } },
    });

    const finishPosition = activePlayers;

    await prisma.tournamentPlayer.update({
      where: { id: tp.id },
      data: {
        status: 'ELIMINATED',
        eliminatedAt: new Date(),
        finishPosition,
      },
    });

    emitPlayerEliminated(io, tournamentId, {
      playerId,
      playerName: tp.player.name,
      finishPosition,
      remaining: activePlayers - 1,
      tableId: tp.tableId,
    });

    await sendPushToTournamentPlayers(tournamentId, {
      title: 'Player Eliminated!',
      body: `${tp.player.name} has been knocked out (#${finishPosition})`,
      tag: `elimination-${playerId}`,
    }, playerId);

    const ended = await checkTournamentEnd(io, tournamentId);

    if (!ended) {
      await checkMergeSuggestions(io, tournamentId);
      const fullTournament = await getFullTournament(tournamentId);
      emitTournamentUpdate(io, tournamentId, fullTournament);
    }

    res.json({ message: 'Player eliminated', finishPosition });
  } catch (error) {
    console.error('Eliminate error:', error);
    res.status(500).json({ error: 'Failed to eliminate player' });
  }
});

// ─── MERGE tables (admin) ───────────────────────────────────────────
router.post('/:id/merge', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const io: SocketIOServer = req.app.get('io');
  const tournamentId = req.params.id as string;
  const { fromTableId, toTableId } = req.body;

  try {
    const fromTable = await prisma.tournamentTable.findUnique({
      where: { id: fromTableId },
      include: { players: { where: { status: { in: ['ACTIVE', 'AFK'] } } } },
    });

    const toTable = await prisma.tournamentTable.findUnique({
      where: { id: toTableId },
      include: { players: { where: { status: { in: ['ACTIVE', 'AFK'] } } } },
    });

    if (!fromTable || !toTable) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (!fromTable.isActive) {
      return res.status(400).json({ error: 'Source table is already inactive' });
    }

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    const maxSeats = tournament?.maxSeatsPerTable || 8;

    const totalPlayers = fromTable.players.length + toTable.players.length;
    if (totalPlayers > maxSeats) {
      return res.status(400).json({ error: 'Not enough seats at destination table' });
    }

    await prisma.$transaction(async (tx) => {
      // Detach ALL players from source table
      await tx.tournamentPlayer.updateMany({
        where: { tableId: fromTableId },
        data: { tableId: null },
      });

      // Detach eliminated players from destination (free their seats)
      await tx.tournamentPlayer.updateMany({
        where: { tableId: toTableId, status: 'ELIMINATED' },
        data: { tableId: null },
      });

      // Mark source table inactive
      await tx.tournamentTable.update({
        where: { id: fromTableId },
        data: { isActive: false },
      });

      // Compute available seats at destination (only active/AFK remain)
      const remaining = await tx.tournamentPlayer.findMany({
        where: { tableId: toTableId },
      });
      const occupiedSeats = new Set(remaining.map((p) => p.seatNumber));
      const availableSeats: number[] = [];
      for (let s = 1; s <= maxSeats; s++) {
        if (!occupiedSeats.has(s)) availableSeats.push(s);
      }

      // Move active/AFK players from source to destination
      for (let i = 0; i < fromTable.players.length; i++) {
        await tx.tournamentPlayer.update({
          where: { id: fromTable.players[i].id },
          data: { tableId: toTableId, seatNumber: availableSeats[i] },
        });
      }
    });

    const fullTournament = await getFullTournament(tournamentId);

    emitTablesMerged(io, tournamentId, {
      fromTableNumber: fromTable.tableNumber,
      toTableNumber: toTable.tableNumber,
      tournament: fullTournament,
    });

    emitTournamentUpdate(io, tournamentId, fullTournament);

    res.json(fullTournament);
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Failed to merge tables' });
  }
});

// ─── SWAP players (admin) ────────────────────────────────────────────
router.post('/:id/swap', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const io: SocketIOServer = req.app.get('io');
  const tournamentId = req.params.id as string;
  const { playerId1, playerId2 } = req.body;

  try {
    if (!playerId1 || !playerId2 || playerId1 === playerId2) {
      return res.status(400).json({ error: 'Two different player IDs required' });
    }

    const tp1 = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId: playerId1 } },
    });
    const tp2 = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId: playerId2 } },
    });

    if (!tp1 || !tp2) {
      return res.status(404).json({ error: 'Player not found in tournament' });
    }

    if (tp1.status === 'ELIMINATED' || tp2.status === 'ELIMINATED') {
      return res.status(400).json({ error: 'Cannot swap eliminated players' });
    }

    // Swap tableId + seatNumber atomically
    // Temporarily null out tableIds to avoid unique constraint violation
    await prisma.$transaction(async (tx) => {
      const table1 = tp1.tableId;
      const seat1 = tp1.seatNumber;
      const table2 = tp2.tableId;
      const seat2 = tp2.seatNumber;

      // Detach both players
      await tx.tournamentPlayer.update({
        where: { id: tp1.id },
        data: { tableId: null },
      });
      await tx.tournamentPlayer.update({
        where: { id: tp2.id },
        data: { tableId: null },
      });

      // Assign swapped positions
      await tx.tournamentPlayer.update({
        where: { id: tp1.id },
        data: { tableId: table2, seatNumber: seat2 },
      });
      await tx.tournamentPlayer.update({
        where: { id: tp2.id },
        data: { tableId: table1, seatNumber: seat1 },
      });
    });

    const fullTournament = await getFullTournament(tournamentId);
    emitTournamentUpdate(io, tournamentId, fullTournament);

    res.json(fullTournament);
  } catch (error) {
    console.error('Swap error:', error);
    res.status(500).json({ error: 'Failed to swap players' });
  }
});

// ─── TOGGLE AFK status ──────────────────────────────────────────────
router.post('/:id/afk', authenticate, async (req: AuthRequest, res) => {
  const io: SocketIOServer = req.app.get('io');
  const tournamentId = req.params.id as string;
  const playerId = req.playerId!;

  try {
    const tp = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      include: { player: true },
    });

    if (!tp || tp.status === 'ELIMINATED') {
      return res.status(400).json({ error: 'Not active in tournament' });
    }

    const newStatus = tp.status === 'AFK' ? 'ACTIVE' : 'AFK';

    await prisma.tournamentPlayer.update({
      where: { id: tp.id },
      data: { status: newStatus },
    });

    emitPlayerStatusChange(io, tournamentId, {
      playerId,
      playerName: tp.player.name,
      status: newStatus,
    });

    const fullTournament = await getFullTournament(tournamentId);
    emitTournamentUpdate(io, tournamentId, fullTournament);

    res.json({ status: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle AFK' });
  }
});

// ─── BEER TOAST ─────────────────────────────────────────────────────
router.post('/:id/toast', authenticate, async (req: AuthRequest, res) => {
  const io: SocketIOServer = req.app.get('io');
  const tournamentId = req.params.id as string;

  try {
    const player = await prisma.player.findUnique({ where: { id: req.playerId! } });

    emitBeerToast(io, tournamentId, {
      playerId: req.playerId,
      playerName: player?.name || 'Someone',
    });

    await sendPushToTournamentPlayers(tournamentId, {
      title: 'Cheers!',
      body: `${player?.name} raised a toast!`,
      tag: 'beer-toast',
    }, req.playerId);

    res.json({ message: 'Cheers!' });
  } catch (error) {
    res.status(500).json({ error: 'Toast failed' });
  }
});

// ─── GET final results ──────────────────────────────────────────────
router.get('/:id/results', authenticate, async (req, res) => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: req.params.id as string },
    include: {
      players: {
        include: { player: { select: { id: true, name: true, email: true } } },
        orderBy: { finishPosition: 'asc' },
      },
    },
  });

  if (!tournament) return res.status(404).json({ error: 'Not found' });

  const results = tournament.players
    .filter((p: typeof tournament.players[number]) => p.finishPosition !== null)
    .sort((a: typeof tournament.players[number], b: typeof tournament.players[number]) =>
      (a.finishPosition || 999) - (b.finishPosition || 999)
    )
    .map((p: typeof tournament.players[number]) => ({
      position: p.finishPosition,
      name: p.player.name,
      eliminatedAt: p.eliminatedAt,
    }));

  res.json({
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    startedAt: tournament.startedAt,
    endedAt: tournament.endedAt,
    results,
  });
});

export default router;
