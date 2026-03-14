export interface Player {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export type TournamentStatus = 'REGISTRATION' | 'ACTIVE' | 'FINISHED';
export type PlayerStatus = 'ACTIVE' | 'ELIMINATED' | 'AFK';

export interface TournamentPlayer {
  id: string;
  tournamentId: string;
  playerId: string;
  tableId: string | null;
  seatNumber: number;
  status: PlayerStatus;
  eliminatedAt: string | null;
  finishPosition: number | null;
  player: Pick<Player, 'id' | 'name' | 'email'>;
}

export interface TournamentTable {
  id: string;
  tournamentId: string;
  tableNumber: number;
  isActive: boolean;
  players: TournamentPlayer[];
}

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  maxSeatsPerTable: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  tables: TournamentTable[];
  players: TournamentPlayer[];
}

export interface MergeSuggestion {
  fromTable: { id: string; tableNumber: number; playerCount: number };
  toTable: { id: string; tableNumber: number; room: number };
  message: string;
}

export interface BeerToastEvent {
  playerId: string;
  playerName: string;
}

export interface EliminationEvent {
  playerId: string;
  playerName: string;
  finishPosition: number;
  remaining: number;
  tableId: string;
}

export interface TournamentResult {
  position: number;
  name: string;
  eliminatedAt: string | null;
}
