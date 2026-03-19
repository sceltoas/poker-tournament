import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApiClient } from '../hooks/useApi';
import { Player, ChipDenomination, DEFAULT_CHIP_DENOMINATIONS } from '../types';
import { ArrowLeft, Plus, Users, Trophy, Shield } from 'lucide-react';
import { useFolk } from '../hooks/useFolk';

export default function AdminPage() {
  const { player, token } = useAuth();
  const apiClient = useApiClient(token);
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [tournamentName, setTournamentName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [maxSeatsPerTable, setMaxSeatsPerTable] = useState(8);
  const [sendInvites, setSendInvites] = useState(false);
  const [chipDenominations, setChipDenominations] = useState<ChipDenomination[]>([...DEFAULT_CHIP_DENOMINATIONS]);
  const [showChipConfig, setShowChipConfig] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const getAvatar = useFolk();

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

  const handleToggleAdmin = async (targetPlayer: Player) => {
    try {
      const updated = await apiClient.patch(`/api/players/${targetPlayer.id}/admin`);
      setPlayers(players.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err: any) {
      setError(err.message);
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
    setCreating(true);
    setError('');

    try {
      const body: any = { name: tournamentName, maxSeatsPerTable, sendInvites, chipDenominations };
      if (selectedPlayerIds.size > 0) {
        body.playerIds = Array.from(selectedPlayerIds);
      }
      await apiClient.post('/api/tournaments', body);
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
          <div className="table-size-row">
            <label htmlFor="maxSeats">Seats per table:</label>
            <select
              id="maxSeats"
              value={maxSeatsPerTable}
              onChange={(e) => setMaxSeatsPerTable(Number(e.target.value))}
              className="table-size-select"
            >
              {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 8 ? '(default)' : ''}
                </option>
              ))}
            </select>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={sendInvites}
              onChange={(e) => setSendInvites(e.target.checked)}
            />
            <span>Send invite emails to players when tournament is created</span>
          </label>
          <button
            className="btn-secondary chip-config-toggle"
            onClick={() => setShowChipConfig(!showChipConfig)}
            type="button"
          >
            {showChipConfig ? '▾' : '▸'} Chip Denominations
          </button>
          {showChipConfig && (
            <div className="chip-config">
              {chipDenominations.map((d, i) => (
                <div key={i} className="chip-config-row">
                  <input
                    type="color"
                    value={d.color}
                    onChange={(e) => {
                      const next = [...chipDenominations];
                      next[i] = { ...next[i], color: e.target.value };
                      setChipDenominations(next);
                    }}
                    className="chip-config-color"
                  />
                  <input
                    type="text"
                    value={d.label}
                    onChange={(e) => {
                      const next = [...chipDenominations];
                      next[i] = { ...next[i], label: e.target.value };
                      setChipDenominations(next);
                    }}
                    className="chip-config-label"
                    placeholder="Label"
                  />
                  <input
                    type="number"
                    value={d.value}
                    onChange={(e) => {
                      const next = [...chipDenominations];
                      next[i] = { ...next[i], value: parseInt(e.target.value, 10) || 0 };
                      setChipDenominations(next);
                    }}
                    className="chip-config-value"
                    placeholder="Value"
                    min="1"
                  />
                  <button
                    className="chip-config-remove"
                    onClick={() => setChipDenominations(chipDenominations.filter((_, j) => j !== i))}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn-secondary"
                onClick={() => setChipDenominations([...chipDenominations, { label: '', value: 1, color: '#888888' }])}
                type="button"
              >
                + Add Denomination
              </button>
            </div>
          )}
        </div>

        <div className="admin-section">
          <div className="section-header">
            <h2><Users size={20} /> Pre-seat Players ({selectedPlayerIds.size}/{players.length})</h2>
            <button onClick={selectAll} className="btn-secondary">
              {selectedPlayerIds.size === players.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="player-grid">
            {players.map((p) => {
              const avatarUrl = getAvatar(p.name);
              return (
                <button
                  key={p.id}
                  className={`player-select-card ${selectedPlayerIds.has(p.id) ? 'selected' : ''} ${avatarUrl ? 'has-avatar' : ''}`}
                  onClick={() => togglePlayer(p.id)}
                >
                  {avatarUrl && <img src={avatarUrl} alt="" className="player-card-avatar" />}
                  <span className="player-name">{p.name}</span>
                  <span className="player-email">{p.email}</span>
                  {p.isAdmin && <span className="admin-badge">Admin</span>}
                  {p.id !== player?.id && (
                    <button
                      className={`btn-admin-toggle ${p.isAdmin ? 'is-admin' : ''}`}
                      title={p.isAdmin ? 'Remove admin' : 'Make admin'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAdmin(p);
                      }}
                    >
                      <Shield size={14} />
                    </button>
                  )}
                </button>
              );
            })}
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
          disabled={creating || !tournamentName.trim()}
          className="btn-create-tournament"
        >
          {creating
            ? 'Creating...'
            : selectedPlayerIds.size > 0
            ? `Create Tournament (${selectedPlayerIds.size} players)`
            : 'Create Tournament'}
        </button>
      </div>
    </div>
  );
}
