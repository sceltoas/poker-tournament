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
  chipStack: number | null;
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
  chipDenominations: ChipDenomination[] | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  tables: TournamentTable[];
  players: TournamentPlayer[];
}

export interface ChipDenomination {
  label: string;
  value: number;
  color: string;
}

export const DEFAULT_CHIP_DENOMINATIONS: ChipDenomination[] = [
  { label: 'White', value: 1, color: '#ffffff' },
  { label: 'Red', value: 5, color: '#e74c3c' },
  { label: 'Blue', value: 10, color: '#3498db' },
  { label: 'Green', value: 25, color: '#27ae60' },
  { label: 'Black', value: 100, color: '#333333' },
];

export interface ChipLeaderChangeEvent {
  playerId: string;
  playerName: string;
  chipStack: number;
}

export interface MergeSuggestion {
  removeTable: { id: string; tableNumber: number; playerCount: number };
  totalPlayers: number;
  remainingTables: number;
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
