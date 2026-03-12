import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApiClient } from '../hooks/useApi';
import { Player } from '../types';
import { ArrowLeft, Plus, Users, Trophy } from 'lucide-react';

export default function AdminPage() {
  const { player, token } = useAuth();
  const apiClient = useApiClient(token);
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [tournamentName, setTournamentName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/api/players').then(setPlayers).catch(console.error);
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedPlayerIds.size === players.length) {
      setSelectedPlayerIds(new Set());
    } else {
      setSelectedPlayerIds(new Set(players.map((p) => p.id)));
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const newPlayer = await apiClient.post('/api/players', {
        name: newPlayerName,
        email: newPlayerEmail,
      });
      setPlayers([...players, newPlayer]);
      setNewPlayerName('');
      setNewPlayerEmail('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) {
      setError('Tournament name required');
      return;
    }
    if (selectedPlayerIds.size < 2) {
      setError('Select at least 2 players');
      return;
    }

    setCreating(true);
    setError('');

    try {
      await apiClient.post('/api/tournaments', {
        name: tournamentName,
        playerIds: Array.from(selectedPlayerIds),
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button onClick={() => navigate('/')} className="btn-back">
          <ArrowLeft size={20} /> Back
        </button>
        <h1><Trophy size={24} /> Create Tournament</h1>
      </header>

      <div className="admin-content">
        <div className="admin-section">
          <input
            type="text"
            placeholder="Tournament Name (e.g. Spring 2026 Championship)"
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            className="tournament-name-input"
          />
        </div>

        <div className="admin-section">
          <div className="section-header">
            <h2><Users size={20} /> Select Players ({selectedPlayerIds.size}/{players.length})</h2>
            <button onClick={selectAll} className="btn-secondary">
              {selectedPlayerIds.size === players.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="player-grid">
            {players.map((p) => (
              <button
                key={p.id}
                className={`player-select-card ${selectedPlayerIds.has(p.id) ? 'selected' : ''}`}
                onClick={() => togglePlayer(p.id)}
              >
                <span className="player-name">{p.name}</span>
                <span className="player-email">{p.email}</span>
                {p.isAdmin && <span className="admin-badge">Admin</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-section">
          <h2><Plus size={20} /> Add New Player</h2>
          <form onSubmit={handleAddPlayer} className="add-player-form">
            <input
              type="text"
              placeholder="Full Name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="name@scelto.no"
              value={newPlayerEmail}
              onChange={(e) => setNewPlayerEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-secondary">Add Player</button>
          </form>
        </div>

        {error && <p className="error">{error}</p>}

        <button
          onClick={handleCreateTournament}
          disabled={creating || selectedPlayerIds.size < 2 || !tournamentName.trim()}
          className="btn-create-tournament"
        >
          {creating ? 'Creating...' : `Create Tournament (${selectedPlayerIds.size} players)`}
        </button>
      </div>
    </div>
  );
}
