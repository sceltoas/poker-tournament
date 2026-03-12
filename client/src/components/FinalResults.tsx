import { Tournament } from '../types';
import { Trophy, Medal, Award } from 'lucide-react';

interface Props {
  tournament: Tournament;
}

export default function FinalResults({ tournament }: Props) {
  const results = tournament.players
    .filter((p) => p.finishPosition !== null)
    .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999));

  const winner = results[0];
  const second = results[1];
  const third = results[2];

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
              <th>Position</th>
              <th>Player</th>
              <th>Eliminated</th>
            </tr>
          </thead>
          <tbody>
            {results.map((p) => (
              <tr key={p.id} className={p.finishPosition === 1 ? 'winner-row' : ''}>
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
