import { Server as SocketIOServer } from 'socket.io';

export function setupWebSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a tournament room
    socket.on('join-tournament', (tournamentId: string) => {
      socket.join(`tournament:${tournamentId}`);
      console.log(`${socket.id} joined tournament:${tournamentId}`);
    });

    socket.on('leave-tournament', (tournamentId: string) => {
      socket.leave(`tournament:${tournamentId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
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
