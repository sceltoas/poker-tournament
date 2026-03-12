import { TournamentPlayer } from '../types';
import { Skull } from 'lucide-react';

interface Props {
  players: TournamentPlayer[];
}

export default function EliminatedList({ players }: Props) {
  return (
    <div className="eliminated-list">
      <h3><Skull size={18} /> Knocked Out</h3>
      <div className="eliminated-grid">
        {players.map((p) => (
          <div key={p.id} className="eliminated-card">
            <span className="position">#{p.finishPosition}</span>
            <span className="name">{p.player.name}</span>
            {p.eliminatedAt && (
              <span className="time">
                {new Date(p.eliminatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
