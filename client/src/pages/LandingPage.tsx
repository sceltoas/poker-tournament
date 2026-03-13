import { useState, useEffect } from 'react';
import { api } from '../hooks/useApi';

interface ActiveStatus {
  hasActive: boolean;
  name?: string;
  playerCount?: number;
  activePlayerCount?: number;
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ActiveStatus | null>(null);

  useEffect(() => {
    api('/api/tournaments/active-status')
      .then(setStatus)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api('/api/auth/login', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card landing-card">
        <div className="login-header">
          <span className="logo-icon">♠</span>
          <h1>Scelto Poker</h1>
        </div>

        {status?.hasActive && (
          <div className="landing-tournament-info">
            <span className="landing-tournament-name">{status.name}</span>
            <span className="landing-tournament-players">
              {status.activePlayerCount} player{status.activePlayerCount !== 1 ? 's' : ''} at the tables
            </span>
          </div>
        )}

        {sent ? (
          <div className="login-success">
            <p>Check your email for a login link!</p>
            <p className="hint">
              Using Mailhog? Visit{' '}
              <a href="http://localhost:8025" target="_blank" rel="noreferrer">
                localhost:8025
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="your.name@scelto.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit">
              {status?.hasActive ? 'Sign In & Join' : 'Sign In'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
