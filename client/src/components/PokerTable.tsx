import { TournamentTable, TournamentPlayer } from '../types';
import { X } from 'lucide-react';

interface Props {
  table: TournamentTable;
  currentPlayerId: string;
  isAdmin: boolean;
  onEliminate: (playerId: string) => void;
}

// Positions for seats around an oval table (up to 8 seats)
// Arranged in a circle: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left
const SEAT_POSITIONS = [
  { top: '2%', left: '50%', transform: 'translate(-50%, 0)' },      // seat 1 - top center
  { top: '12%', right: '5%', transform: 'translate(0, 0)' },         // seat 2 - top right
  { top: '42%', right: '-2%', transform: 'translate(0, -50%)' },     // seat 3 - right
  { bottom: '12%', right: '5%', transform: 'translate(0, 0)' },      // seat 4 - bottom right
  { bottom: '2%', left: '50%', transform: 'translate(-50%, 0)' },    // seat 5 - bottom center
  { bottom: '12%', left: '5%', transform: 'translate(0, 0)' },       // seat 6 - bottom left
  { top: '42%', left: '-2%', transform: 'translate(0, -50%)' },      // seat 7 - left
  { top: '12%', left: '5%', transform: 'translate(0, 0)' },          // seat 8 - top left
];

function PlayerSeat({
  tp,
  position,
  isMe,
  isAdmin,
  onEliminate,
}: {
  tp: TournamentPlayer;
  position: Record<string, string>;
  isMe: boolean;
  isAdmin: boolean;
  onEliminate: (playerId: string) => void;
}) {
  const isEliminated = tp.status === 'ELIMINATED';
  const isAfk = tp.status === 'AFK';

  return (
    <div
      className={`player-seat ${isEliminated ? 'eliminated' : ''} ${isAfk ? 'afk' : ''} ${isMe ? 'is-me' : ''}`}
      style={{ position: 'absolute', ...position }}
    >
      <div className="seat-chip">
        <span className="seat-name">{tp.player.name.split(' ')[0]}</span>
        {isAfk && <span className="afk-indicator">AFK</span>}
        {isEliminated && <span className="eliminated-indicator">OUT</span>}
      </div>

      {!isEliminated && (isAdmin || isMe) && (
        <button
          className="btn-eliminate"
          onClick={() => {
            if (confirm(`${isMe ? 'Mark yourself as' : `Remove ${tp.player.name} -`} eliminated?`)) {
              onEliminate(tp.playerId);
            }
          }}
          title={isMe ? "I'm out" : 'Eliminate player'}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// Empty seat placeholder
function EmptySeat({ position }: { position: Record<string, string> }) {
  return (
    <div className="player-seat empty" style={{ position: 'absolute', ...position }}>
      <div className="seat-chip empty-chip">
        <span className="seat-name">—</span>
      </div>
    </div>
  );
}

export default function PokerTable({ table, currentPlayerId, isAdmin, onEliminate }: Props) {
  const activePlayers = table.players.filter((p) => p.status !== 'ELIMINATED');
  const eliminatedAtTable = table.players.filter((p) => p.status === 'ELIMINATED');

  return (
    <div className="poker-table-wrapper">
      <div className="table-label">Table {table.tableNumber}</div>
      <div className="poker-table">
        <div className="table-felt">
          <div className="table-center">
            <span className="table-number">T{table.tableNumber}</span>
            <span className="table-count">{activePlayers.length} players</span>
          </div>
        </div>

        {/* Render all 8 seats */}
        {Array.from({ length: 8 }, (_, i) => {
          const seatNum = i + 1;
          const tp = table.players.find((p) => p.seatNumber === seatNum);

          if (tp) {
            return (
              <PlayerSeat
                key={tp.id}
                tp={tp}
                position={SEAT_POSITIONS[i]}
                isMe={tp.playerId === currentPlayerId}
                isAdmin={isAdmin}
                onEliminate={onEliminate}
              />
            );
          }

          return <EmptySeat key={`empty-${seatNum}`} position={SEAT_POSITIONS[i]} />;
        })}
      </div>
    </div>
  );
}
