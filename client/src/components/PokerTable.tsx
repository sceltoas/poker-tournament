import { useState, useRef } from 'react';
import { TournamentTable, TournamentPlayer, ChipDenomination, DEFAULT_CHIP_DENOMINATIONS } from '../types';
import { X, RotateCcw } from 'lucide-react';
import { useFolk } from '../hooks/useFolk';
import { formatChipCount } from './ChipInputModal';

interface Props {
  table: TournamentTable;
  currentPlayerId: string;
  isAdmin: boolean;
  maxSeats?: number;
  onlinePlayers?: Set<string>;
  chipLeaders?: Map<string, 1 | 2 | 3>;
  chipDenominations?: ChipDenomination[] | null;
  onEliminate: (playerId: string) => void;
  onReinstate?: (playerId: string) => void;
  onSwap?: (playerId1: string, playerId2: string) => void;
  onMove?: (playerId: string, toTableId: string, toSeat: number) => void;
  onChipClick?: (playerId: string) => void;
}

// Total visual chips across all columns
const TOTAL_VISUAL_CHIPS = 20;
const MAX_CHIPS_PER_COLUMN = 6;

// Distribute visual chips evenly across denominations based on value share
function chipColumns(total: number, denoms: ChipDenomination[]): { color: string; discs: number }[] {
  // Greedy breakdown to know which denominations are used
  const sorted = [...denoms].sort((a, b) => b.value - a.value);
  const used: { color: string; value: number; count: number }[] = [];
  let remaining = total;
  for (const d of sorted) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / d.value);
    if (count > 0) {
      used.push({ color: d.color, value: d.value, count });
      remaining -= count * d.value;
    }
  }
  if (used.length === 0) return [];

  // Calculate each denomination's share of total value
  const totalValue = used.reduce((s, u) => s + u.value * u.count, 0);

  // Distribute TOTAL_VISUAL_CHIPS proportionally by value share
  let chipsLeft = TOTAL_VISUAL_CHIPS;
  const columns = used.map((u, i) => {
    const share = (u.value * u.count) / totalValue;
    // Last column gets whatever remains to avoid rounding issues
    const discs = i === used.length - 1
      ? chipsLeft
      : Math.max(1, Math.min(MAX_CHIPS_PER_COLUMN, Math.round(share * TOTAL_VISUAL_CHIPS)));
    chipsLeft -= discs;
    return { color: u.color, discs: Math.max(1, Math.min(MAX_CHIPS_PER_COLUMN, discs)) };
  });

  return columns;
}

// Render chip columns side by side, each column is one color stacked vertically
function ChipStackVisual({ chipStack, denominations }: { chipStack: number; denominations: ChipDenomination[] }) {
  const columns = chipColumns(chipStack, denominations);
  if (columns.length === 0) return null;

  return (
    <div className="chip-stack-visual">
      {columns.map((col, ci) => (
        <div key={ci} className="chip-column">
          {Array.from({ length: col.discs }, (_, di) => (
            <div
              key={di}
              className="chip-disc"
              style={{
                background: col.color,
                borderColor: col.color === '#ffffff' ? '#999' : 'rgba(0,0,0,0.35)',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Positions for seats around an oval table (up to 12 seats)
const SEAT_POSITIONS: React.CSSProperties[] = [
  { top: '6%', left: '50%', transform: 'translate(-50%, 0)' },       // seat 1  - top center
  { top: '14%', right: '14%', transform: 'translate(0, 0)' },        // seat 2  - top right
  { top: '50%', right: '2%', transform: 'translate(0, -50%)' },      // seat 3  - right
  { bottom: '14%', right: '14%', transform: 'translate(0, 0)' },     // seat 4  - bottom right
  { bottom: '6%', left: '50%', transform: 'translate(-50%, 0)' },    // seat 5  - bottom center
  { bottom: '14%', left: '14%', transform: 'translate(0, 0)' },      // seat 6  - bottom left
  { top: '50%', left: '2%', transform: 'translate(0, -50%)' },       // seat 7  - left
  { top: '14%', left: '14%', transform: 'translate(0, 0)' },         // seat 8  - top left
  { top: '6%', left: '30%', transform: 'translate(-50%, 0)' },       // seat 9  - top left-center
  { top: '6%', right: '30%', transform: 'translate(50%, 0)' },       // seat 10 - top right-center
  { bottom: '6%', left: '30%', transform: 'translate(-50%, 0)' },    // seat 11 - bottom left-center
  { bottom: '6%', right: '30%', transform: 'translate(50%, 0)' },    // seat 12 - bottom right-center
];

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

function PlayerSeat({
  tp,
  position,
  isMe,
  isAdmin,
  isOnline,
  leaderRank,
  avatarUrl,
  chipDenominations,
  onEliminate,
  onReinstate,
  onSwap,
  onChipClick,
}: {
  tp: TournamentPlayer;
  position: React.CSSProperties;
  isMe: boolean;
  isAdmin: boolean;
  isOnline: boolean;
  leaderRank?: 1 | 2 | 3;
  avatarUrl?: string;
  chipDenominations: ChipDenomination[];
  onEliminate: (playerId: string) => void;
  onReinstate?: (playerId: string) => void;
  onSwap?: (playerId1: string, playerId2: string) => void;
  onChipClick?: (playerId: string) => void;
}) {
  const isEliminated = tp.status === 'ELIMINATED';
  const isAfk = tp.status === 'AFK';
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

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
        dragCounter.current = 0;
        setIsDragOver(false);
      }}
      onDragOver={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        dragCounter.current++;
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        dragCounter.current--;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
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
      {!isEliminated && <span className={`online-dot ${isOnline ? 'online' : 'offline'}`} />}
      {leaderRank && <span className="chip-leader-badge">{MEDAL[leaderRank]}</span>}
      {!isEliminated && (
        <div
          className={`chip-area ${(isMe || isAdmin) && onChipClick ? 'clickable' : ''}`}
          onClick={(e) => { if ((isMe || isAdmin) && onChipClick) { e.stopPropagation(); onChipClick(tp.playerId); } }}
        >
          {tp.chipStack != null && tp.chipStack > 0 && (
            <ChipStackVisual chipStack={tp.chipStack} denominations={chipDenominations} />
          )}
          <span className="chip-count-label">
            {tp.chipStack != null && tp.chipStack > 0 ? formatChipCount(tp.chipStack) : (isMe || isAdmin) ? '💰' : ''}
          </span>
        </div>
      )}

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

      {isEliminated && isAdmin && onReinstate && (
        <button
          className="btn-reinstate-badge"
          onClick={() => {
            if (confirm(`Reinstate ${tp.player.name}?`)) {
              onReinstate(tp.playerId);
            }
          }}
          title="Reinstate player"
        >
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
}

// Empty seat placeholder (also a drop target for moves)
function EmptySeat({ position, tableId, seatNumber, onMove }: {
  position: React.CSSProperties;
  tableId: string;
  seatNumber: number;
  onMove?: (playerId: string, toTableId: string, toSeat: number) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  return (
    <div
      className={`player-seat empty ${isDragOver ? 'drag-over' : ''}`}
      style={{ position: 'absolute', ...position }}
      onDragOver={(e) => {
        if (!onMove) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        if (!onMove) return;
        e.preventDefault();
        dragCounter.current++;
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        dragCounter.current--;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragOver(false);
        if (!onMove) return;
        const fromPlayerId = e.dataTransfer.getData('text/plain');
        if (fromPlayerId) {
          onMove(fromPlayerId, tableId, seatNumber);
        }
      }}
    >
      <div className="seat-chip empty-chip">
        <span className="seat-name">—</span>
      </div>
    </div>
  );
}

export default function PokerTable({ table, currentPlayerId, isAdmin, maxSeats = 8, onlinePlayers, chipLeaders, chipDenominations, onEliminate, onReinstate, onSwap, onMove, onChipClick }: Props) {
  const activePlayers = table.players.filter((p) => p.status !== 'ELIMINATED');
  const getAvatar = useFolk();
  const seatCount = Math.min(maxSeats, SEAT_POSITIONS.length);
  const denoms = chipDenominations && chipDenominations.length > 0 ? chipDenominations : DEFAULT_CHIP_DENOMINATIONS;

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

        {Array.from({ length: seatCount }, (_, i) => {
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
                isOnline={onlinePlayers?.has(tp.playerId) || false}
                leaderRank={chipLeaders?.get(tp.playerId)}
                avatarUrl={getAvatar(tp.player.name)}
                chipDenominations={denoms}
                onEliminate={onEliminate}
                onReinstate={onReinstate}
                onSwap={onSwap}
                onChipClick={onChipClick}
              />
            );
          }

          return <EmptySeat key={`empty-${seatNum}`} position={SEAT_POSITIONS[i]} tableId={table.id} seatNumber={seatNum} onMove={onMove} />;
        })}
      </div>
    </div>
  );
}
