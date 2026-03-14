import { useState } from 'react';
import { TournamentTable, TournamentPlayer } from '../types';
import { X } from 'lucide-react';
import { useFolk } from '../hooks/useFolk';

interface Props {
  table: TournamentTable;
  currentPlayerId: string;
  isAdmin: boolean;
  onEliminate: (playerId: string) => void;
  onSwap?: (playerId1: string, playerId2: string) => void;
}

// Positions for seats around an oval table (up to 8 seats)
// Arranged in a circle: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left
const SEAT_POSITIONS: React.CSSProperties[] = [
  { top: '6%', left: '50%', transform: 'translate(-50%, 0)' },       // seat 1 - top center
  { top: '14%', right: '14%', transform: 'translate(0, 0)' },        // seat 2 - top right
  { top: '50%', right: '2%', transform: 'translate(0, -50%)' },      // seat 3 - right
  { bottom: '14%', right: '14%', transform: 'translate(0, 0)' },     // seat 4 - bottom right
  { bottom: '6%', left: '50%', transform: 'translate(-50%, 0)' },    // seat 5 - bottom center
  { bottom: '14%', left: '14%', transform: 'translate(0, 0)' },      // seat 6 - bottom left
  { top: '50%', left: '2%', transform: 'translate(0, -50%)' },       // seat 7 - left
  { top: '14%', left: '14%', transform: 'translate(0, 0)' },         // seat 8 - top left
];

function PlayerSeat({
  tp,
  position,
  isMe,
  isAdmin,
  avatarUrl,
  onEliminate,
  onSwap,
}: {
  tp: TournamentPlayer;
  position: React.CSSProperties;
  isMe: boolean;
  isAdmin: boolean;
  avatarUrl?: string;
  onEliminate: (playerId: string) => void;
  onSwap?: (playerId1: string, playerId2: string) => void;
}) {
  const isEliminated = tp.status === 'ELIMINATED';
  const isAfk = tp.status === 'AFK';
  const [isDragOver, setIsDragOver] = useState(false);

  const canDrag = isAdmin && !isEliminated && !!onSwap;

  return (
    <div
      className={`player-seat ${isEliminated ? 'eliminated' : ''} ${isAfk ? 'afk' : ''} ${isMe ? 'is-me' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{ position: 'absolute', ...position }}
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return;
        e.dataTransfer.setData('text/plain', tp.playerId);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).classList.add('dragging');
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).classList.remove('dragging');
      }}
      onDragOver={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!canDrag) return;
        const fromPlayerId = e.dataTransfer.getData('text/plain');
        if (fromPlayerId && fromPlayerId !== tp.playerId) {
          onSwap!(fromPlayerId, tp.playerId);
        }
      }}
    >
      <div className={`seat-chip ${avatarUrl ? 'has-avatar' : ''}`}>
        {avatarUrl && <img src={avatarUrl} alt="" className="seat-avatar" />}
        {isAfk && <span className="afk-overlay">AFK</span>}
        <span className="seat-name">{tp.player.name.split(' ')[0]}</span>
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
function EmptySeat({ position }: { position: React.CSSProperties }) {
  return (
    <div className="player-seat empty" style={{ position: 'absolute', ...position }}>
      <div className="seat-chip empty-chip">
        <span className="seat-name">—</span>
      </div>
    </div>
  );
}

export default function PokerTable({ table, currentPlayerId, isAdmin, onEliminate, onSwap }: Props) {
  const activePlayers = table.players.filter((p) => p.status !== 'ELIMINATED');
  const getAvatar = useFolk();

  return (
    <div className="poker-table-wrapper">
      <div className="poker-table">
        <div className="table-felt">
          <div className="table-center">
            <span className="table-label-top">Bord #{table.tableNumber}</span>
            <img src="/scelto_as_logo.jpeg" alt="Scelto" className="table-logo" />
            <span className="table-label-bottom">{activePlayers.length} Spillere</span>
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
                avatarUrl={getAvatar(tp.player.name)}
                onEliminate={onEliminate}
                onSwap={onSwap}
              />
            );
          }

          return <EmptySeat key={`empty-${seatNum}`} position={SEAT_POSITIONS[i]} />;
        })}
      </div>
    </div>
  );
}
