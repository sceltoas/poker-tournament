import { Server as SocketIOServer } from 'socket.io';

// Track online players: tournamentId -> Set of playerIds
const tournamentOnlinePlayers = new Map<string, Set<string>>();
// Track which socket belongs to which player/tournament
const socketMeta = new Map<string, { playerId: string; tournamentId: string }>();

function broadcastOnlinePlayers(io: SocketIOServer, tournamentId: string) {
  const online = tournamentOnlinePlayers.get(tournamentId);
  io.to(`tournament:${tournamentId}`).emit('online-players', online ? Array.from(online) : []);
}

export function setupWebSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a tournament room with player identity
    socket.on('join-tournament', (tournamentId: string, playerId?: string) => {
      socket.join(`tournament:${tournamentId}`);

      if (playerId) {
        socketMeta.set(socket.id, { playerId, tournamentId });
        if (!tournamentOnlinePlayers.has(tournamentId)) {
          tournamentOnlinePlayers.set(tournamentId, new Set());
        }
        tournamentOnlinePlayers.get(tournamentId)!.add(playerId);
        broadcastOnlinePlayers(io, tournamentId);
      }
    });

    socket.on('leave-tournament', (tournamentId: string) => {
      socket.leave(`tournament:${tournamentId}`);
      const meta = socketMeta.get(socket.id);
      if (meta && meta.tournamentId === tournamentId) {
        removePlayerFromTracking(io, socket.id);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      removePlayerFromTracking(io, socket.id);
    });
  });
}

function removePlayerFromTracking(io: SocketIOServer, socketId: string) {
  const meta = socketMeta.get(socketId);
  if (!meta) return;
  socketMeta.delete(socketId);

  // Only remove player if no other sockets for them in this tournament
  const { playerId, tournamentId } = meta;
  const hasOtherSocket = Array.from(socketMeta.values()).some(
    (m) => m.playerId === playerId && m.tournamentId === tournamentId
  );

  if (!hasOtherSocket) {
    const online = tournamentOnlinePlayers.get(tournamentId);
    if (online) {
      online.delete(playerId);
      if (online.size === 0) tournamentOnlinePlayers.delete(tournamentId);
    }
    broadcastOnlinePlayers(io, tournamentId);
  }
}

// Emit helpers used by routes
export function emitTournamentUpdate(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('tournament-update', data);
}

export function emitPlayerEliminated(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('player-eliminated', data);
}

export function emitMergeSuggestion(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('merge-suggestion', data);
}

export function emitBeerToast(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('beer-toast', data);
}

export function emitPlayerStatusChange(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('player-status-change', data);
}

export function emitTablesMerged(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('tables-merged', data);
}

export function emitTournamentFinished(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('tournament-finished', data);
}

export function emitPlayerJoined(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('player-joined', data);
}

export function emitChipLeaderChange(io: SocketIOServer, tournamentId: string, data: any) {
  io.to(`tournament:${tournamentId}`).emit('chip-leader-change', data);
}
