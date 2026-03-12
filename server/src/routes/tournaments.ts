import { Router, Request } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../index';
import { sendMagicLink, sendEliminationNotification } from '../services/email';
import { sendPushToTournamentPlayers } from '../services/pushNotification';
import {
  emitTournamentUpdate,
  emitPlayerEliminated,
  emitMergeSuggestion,
  emitBeerToast,
  emitPlayerStatusChange,
  emitTablesMerged,
  emitTournamentFinished,
} from '../services/websocket';
import { v4 as uuid } from 'uuid';

const router = Router();

const MERGE_THRESHOLD = 4; // Suggest merge when table has fewer than this many active players

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
  const tables = await prisma.tournamentTable.findMany({
    where: { tournamentId, isActive: true },
    include: {
      players: { where: { status: { in: ['ACTIVE', 'AFK'] } } },
    },
    orderBy: { tableNumber: 'asc' },
  });

  const activeTables = tables.filter((t) => t.players.length > 0);

  if (activeTables.length <= 1) return;

  // Find tables below threshold
  const lowTables = activeTables.filter((t) => t.players.length < MERGE_THRESHOLD);

  if (lowTables.length > 0) {
    // Suggest merging the smallest table into the one with most room
    const smallest = lowTables.sort((a, b) => a.players.length - b.players.length)[0];
    const targetCandidates = activeTables
      .filter((t) => t.id !== smallest.id)
      .map((t) => ({ ...t, room: 8 - t.players.length }))
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
    // Last player standing wins
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

// ─── LIST tournaments ───────────────────────────────────────────────
router.get('/', async (_req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { players: true } },
    },
  });
  res.json(tournaments);
});

// ─── GET single tournament (full state) ─────────────────────────────
router.get('/:id', async (req, res) => {
  const tournament = await getFullTournament(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  res.json(tournament);
});

// ─── CREATE tournament ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, playerIds } = req.body as { name: string; playerIds: string[] };

    if (!name || !playerIds?.length) {
      return res.status(400).json({ error: 'Name and player IDs required' });
    }

    if (playerIds.length > 80) {
      return res.status(400).json({ error: 'Maximum 80 players (10 tables x 8)' });
    }

    const tournament = await prisma.tournament.create({ data: { name } });

    // Calculate table layout
    const numTables = Math.ceil(playerIds.length / 8);
    const playersPerTable = Math.ceil(playerIds.length / numTables);

    // Create tables
    const tables = [];
    for (let i = 0; i < numTables; i++) {
      const table = await prisma.tournamentTable.create({
        data: { tournamentId: tournament.id, tableNumber: i + 1 },
      });
      tables.push(table);
    }

    // Assign players to tables with shuffled seating
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

    // Send magic links to all players
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
    });

    for (const player of players) {
      const token = uuid();
      await prisma.magicLink.create({
        data: {
          playerId: player.id,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
      await sendMagicLink(player.email, player.name, token, name);
    }

    const fullTournament = await getFullTournament(tournament.id);
    res.status(201).json(fullTournament);
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// ─── START tournament ───────────────────────────────────────────────
router.post('/:id/start', async (req, res) => {
  const io: SocketIOServer = req.app.get('io');
  try {
    await prisma.tournament.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });

    const fullTournament = await getFullTournament(req.params.id);
    emitTournamentUpdate(io, req.params.id, fullTournament);
    res.json(fullTournament);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start tournament' });
  }
});

// ─── ELIMINATE player ───────────────────────────────────────────────
router.post('/:id/eliminate/:playerId', async (req, res) => {
  const io: SocketIOServer = req.app.get('io');
  const { id: tournamentId, playerId } = req.params;

  try {
    const tp = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      include: { player: true },
    });

    if (!tp || tp.status === 'ELIMINATED') {
      return res.status(400).json({ error: 'Player not active in tournament' });
    }

    // Calculate finish position
    const activePlayers = await prisma.tournamentPlayer.count({
      where: { tournamentId, status: { in: ['ACTIVE', 'AFK'] } },
    });

    const finishPosition = activePlayers; // e.g., if 10 active, eliminated player gets #10

    await prisma.tournamentPlayer.update({
      where: { id: tp.id },
      data: {
        status: 'ELIMINATED',
        eliminatedAt: new Date(),
        finishPosition,
      },
    });

    // Emit elimination event
    emitPlayerEliminated(io, tournamentId, {
      playerId,
      playerName: tp.player.name,
      finishPosition,
      remaining: activePlayers - 1,
      tableId: tp.tableId,
    });

    // Send push notifications (web)
    await sendPushToTournamentPlayers(tournamentId, {
      title: 'Player Eliminated!',
      body: `${tp.player.name} has been knocked out (#${finishPosition})`,
      tag: `elimination-${playerId}`,
    }, playerId);

    // Send email notifications to remaining active players
    const remainingPlayers = await prisma.tournamentPlayer.findMany({
      where: {
        tournamentId,
        status: { in: ['ACTIVE', 'AFK'] },
        playerId: { not: playerId },
      },
      include: { player: true },
    });

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });

    for (const rp of remainingPlayers) {
      sendEliminationNotification(
        rp.player.email,
        rp.player.name,
        tp.player.name,
        tournament?.name || 'Tournament',
        finishPosition,
        activePlayers - 1
      ).catch(console.error);
    }

    // Check if tournament should end
    const ended = await checkTournamentEnd(io, tournamentId);

    if (!ended) {
      // Check for merge suggestions
      await checkMergeSuggestions(io, tournamentId);

      // Send updated tournament state
      const fullTournament = await getFullTournament(tournamentId);
      emitTournamentUpdate(io, tournamentId, fullTournament);
    }

    res.json({ message: 'Player eliminated', finishPosition });
  } catch (error) {
    console.error('Eliminate error:', error);
    res.status(500).json({ error: 'Failed to eliminate player' });
  }
});

// ─── MERGE tables ───────────────────────────────────────────────────
router.post('/:id/merge', async (req, res) => {
  const io: SocketIOServer = req.app.get('io');
  const { id: tournamentId } = req.params;
  const { fromTableId, toTableId } = req.body;

  try {
    const fromTable = await prisma.tournamentTable.findUnique({
      where: { id: fromTableId },
      include: { players: { where: { status: { in: ['ACTIVE', 'AFK'] } } } },
    });

    const toTable = await prisma.tournamentTable.findUnique({
      where: { id: toTableId },
      include: { players: true },
    });

    if (!fromTable || !toTable) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Find available seats at destination (check ALL players, not just active)
    const existingSeats = new Set(toTable.players.map((p) => p.seatNumber));
    const availableSeats: number[] = [];
    for (let s = 1; s <= 8; s++) {
      if (!existingSeats.has(s)) availableSeats.push(s);
    }

    if (availableSeats.length < fromTable.players.length) {
      return res.status(400).json({ error: 'Not enough seats at destination table' });
    }

    // Detach all players from source table first (avoids unique constraint issues)
    await prisma.tournamentPlayer.updateMany({
      where: { tableId: fromTableId },
      data: { tableId: null },
    });

    // Mark the from-table as inactive
    await prisma.tournamentTable.update({
      where: { id: fromTableId },
      data: { isActive: false },
    });

    // Move active/AFK players to destination with new seats
    for (let i = 0; i < fromTable.players.length; i++) {
      await prisma.tournamentPlayer.update({
        where: { id: fromTable.players[i].id },
        data: { tableId: toTableId, seatNumber: availableSeats[i] },
      });
    }

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

// ─── TOGGLE AFK status ──────────────────────────────────────────────
router.post('/:id/afk/:playerId', async (req, res) => {
  const io: SocketIOServer = req.app.get('io');
  const { id: tournamentId, playerId } = req.params;

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
router.post('/:id/toast/:playerId', async (req, res) => {
  const io: SocketIOServer = req.app.get('io');
  const { id: tournamentId, playerId } = req.params;

  try {
    const player = await prisma.player.findUnique({ where: { id: playerId } });

    emitBeerToast(io, tournamentId, {
      playerId,
      playerName: player?.name || 'Someone',
    });

    // Web push for beer toast (not email)
    await sendPushToTournamentPlayers(tournamentId, {
      title: 'Cheers!',
      body: `${player?.name} raised a toast!`,
      tag: 'beer-toast',
    }, playerId);

    res.json({ message: 'Cheers!' });
  } catch (error) {
    res.status(500).json({ error: 'Toast failed' });
  }
});

// ─── GET final results ──────────────────────────────────────────────
router.get('/:id/results', async (req, res) => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: req.params.id },
    include: {
      players: {
        include: { player: { select: { id: true, name: true, email: true } } },
        orderBy: { finishPosition: 'asc' },
      },
    },
  });

  if (!tournament) return res.status(404).json({ error: 'Not found' });

  res.json({
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    startedAt: tournament.startedAt,
    endedAt: tournament.endedAt,
    results: tournament.players
      .filter((p) => p.finishPosition !== null)
      .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999))
      .map((p) => ({
        position: p.finishPosition,
        name: p.player.name,
        eliminatedAt: p.eliminatedAt,
      })),
  });
});

export default router;
