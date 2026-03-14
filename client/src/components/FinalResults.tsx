import { useState, useRef } from 'react';
import { Tournament } from '../types';
import { Trophy, Medal, Award, GripVertical } from 'lucide-react';

interface Props {
  tournament: Tournament;
  isAdmin?: boolean;
  onReorder?: (fromPosition: number, toPosition: number) => void;
}

export default function FinalResults({ tournament, isAdmin, onReorder }: Props) {
  const results = tournament.players
    .filter((p) => p.finishPosition !== null)
    .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999));

  const winner = results[0];
  const second = results[1];
  const third = results[2];

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedPosition = useRef<number | null>(null);

  const canDrag = isAdmin && !!onReorder;

  return (
    <div className="final-results">
      <div className="results-header">
        <Trophy size={48} className="trophy-icon" />
        <h2>{tournament.name} — Final Results</h2>
      </div>

      <div className="podium">
        {second && (
          <div className="podium-spot second">
            <Medal size={32} />
            <span className="podium-position">2nd</span>
            <span className="podium-name">{second.player.name}</span>
          </div>
        )}
        {winner && (
          <div className="podium-spot first">
            <Trophy size={40} />
            <span className="podium-position">1st</span>
            <span className="podium-name">{winner.player.name}</span>
          </div>
        )}
        {third && (
          <div className="podium-spot third">
            <Award size={28} />
            <span className="podium-position">3rd</span>
            <span className="podium-name">{third.player.name}</span>
          </div>
        )}
      </div>

      <div className="results-table">
        <table>
          <thead>
            <tr>
              {canDrag && <th></th>}
              <th>Position</th>
              <th>Player</th>
              <th>Eliminated</th>
            </tr>
          </thead>
          <tbody>
            {results.map((p, index) => (
              <tr
                key={p.id}
                className={`${p.finishPosition === 1 ? 'winner-row' : ''} ${canDrag ? 'draggable-row' : ''} ${dragOverIndex === index ? 'drag-over-row' : ''}`}
                draggable={canDrag}
                onDragStart={() => {
                  draggedPosition.current = p.finishPosition;
                }}
                onDragOver={(e) => {
                  if (!canDrag) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIndex(index);
                }}
                onDragLeave={() => {
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverIndex(null);
                  if (draggedPosition.current !== null && draggedPosition.current !== p.finishPosition) {
                    onReorder!(draggedPosition.current, p.finishPosition!);
                  }
                  draggedPosition.current = null;
                }}
                onDragEnd={() => {
                  setDragOverIndex(null);
                  draggedPosition.current = null;
                }}
              >
                {canDrag && (
                  <td className="grip-cell">
                    <GripVertical size={14} />
                  </td>
                )}
                <td className="position-cell">
                  {p.finishPosition === 1 && <Trophy size={16} />}
                  #{p.finishPosition}
                </td>
                <td>{p.player.name}</td>
                <td>
                  {p.finishPosition === 1
                    ? 'Winner!'
                    : p.eliminatedAt
                      ? new Date(p.eliminatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
