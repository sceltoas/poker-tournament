import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useApiClient } from '../hooks/useApi';
import { Tournament, MergeSuggestion, BeerToastEvent, EliminationEvent } from '../types';
import PokerTable from '../components/PokerTable';
import EliminatedList from '../components/EliminatedList';
import FinalResults from '../components/FinalResults';
import MergeBanner from '../components/MergeBanner';
import BeerToastOverlay from '../components/BeerToastOverlay';
import NotificationToast from '../components/NotificationToast';
import Header from '../components/Header';
import plingSfx from '../assets/pling.mp3';

export default function DashboardPage() {
  const { player, token } = useAuth();
  const { socket } = useSocket();
  const apiClient = useApiClient(token);
  const navigate = useNavigate();

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [mergeSuggestion, setMergeSuggestion] = useState<MergeSuggestion | null>(null);
  const [beerToast, setBeerToast] = useState<BeerToastEvent | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTournaments = useCallback(async () => {
    try {
      const data = await apiClient.get('/api/tournaments');
      setTournaments(data);

      // Auto-select active tournament
      const active = data.find((t: any) => t.status === 'ACTIVE');
      if (active) {
        const full = await apiClient.get(`/api/tournaments/${active.id}`);
        setActiveTournament(full);
      } else if (data.length > 0) {
        const full = await apiClient.get(`/api/tournaments/${data[0].id}`);
        setActiveTournament(full);
      }
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  // Join tournament room via socket
  useEffect(() => {
    if (!socket || !activeTournament) return;

    socket.emit('join-tournament', activeTournament.id);

    return () => {
      socket.emit('leave-tournament', activeTournament.id);
    };
  }, [socket, activeTournament?.id]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data: Tournament) => {
      setActiveTournament(data);
    };

    const handleElimination = (data: EliminationEvent) => {
      setNotification(`${data.playerName} eliminated! (#${data.finishPosition}) — ${data.remaining} players left`);
    };

    const handleMergeSuggestion = (data: MergeSuggestion) => {
      if (player?.isAdmin) {
        setMergeSuggestion(data);
      }
    };

    const handleBeerToast = (data: BeerToastEvent) => {
      setBeerToast(data);
      setTimeout(() => setBeerToast(null), 4000);
      if (player?.isAdmin) {
        new Audio(plingSfx).play().catch(() => {});
      }
    };

    const handleTablesMerged = (data: any) => {
      setActiveTournament(data.tournament);
      setMergeSuggestion(null);
      setNotification(`Table ${data.fromTableNumber} merged into Table ${data.toTableNumber}`);
    };

    const handleFinished = (data: Tournament) => {
      setActiveTournament(data);
      setNotification('Tournament finished!');
    };

    const handlePlayerJoined = (data: { playerName: string }) => {
      setNotification(`${data.playerName} joined the tournament!`);
    };

    socket.on('tournament-update', handleUpdate);
    socket.on('player-eliminated', handleElimination);
    socket.on('merge-suggestion', handleMergeSuggestion);
    socket.on('beer-toast', handleBeerToast);
    socket.on('tables-merged', handleTablesMerged);
    socket.on('tournament-finished', handleFinished);
    socket.on('player-joined', handlePlayerJoined);

    return () => {
      socket.off('tournament-update', handleUpdate);
      socket.off('player-eliminated', handleElimination);
      socket.off('merge-suggestion', handleMergeSuggestion);
      socket.off('beer-toast', handleBeerToast);
      socket.off('tables-merged', handleTablesMerged);
      socket.off('tournament-finished', handleFinished);
      socket.off('player-joined', handlePlayerJoined);
    };
  }, [socket, player?.isAdmin]);

  const handleEliminate = async (playerId: string) => {
    if (!activeTournament) return;
    try {
      await apiClient.post(`/api/tournaments/${activeTournament.id}/eliminate/${playerId}`);
    } catch (err: any) {
      setNotification(`Error: ${err.message}`);
    }
  };

  const handleToggleAfk = async () => {
    if (!activeTournament) return;
    try {
      const result = await apiClient.post(`/api/tournaments/${activeTournament.id}/afk`);
      setNotification(`You are now ${result.status === 'AFK' ? 'AFK' : 'back'}`);
    } catch (err: any) {
      setNotification(`Error: ${err.message}`);
    }
  };

  const handleBeerToastClick = async () => {
    if (!activeTournament) return;
    try {
      await apiClient.post(`/api/tournaments/${activeTournament.id}/toast`);
    } catch (err: any) {
      setNotification(`Error: ${err.message}`);
    }
  };

  const handleMerge = async () => {
    if (!activeTournament || !mergeSuggestion) return;
    try {
      await apiClient.post(`/api/tournaments/${activeTournament.id}/merge`, {
        fromTableId: mergeSuggestion.fromTable.id,
        toTableId: mergeSuggestion.toTable.id,
      });
    } catch (err: any) {
      setNotification(`Merge failed: ${err.message}`);
    }
  };

  const handleJoinTournament = async () => {
    if (!activeTournament) return;
    try {
      const updated = await apiClient.post(`/api/tournaments/${activeTournament.id}/join`);
      setActiveTournament(updated);
      setNotification('You joined the tournament!');
    } catch (err: any) {
      setNotification(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Get current player's tournament status
  const myTournamentPlayer = activeTournament?.players.find(
    (p) => p.playerId === player?.id
  );
  const isMyTurnActive = myTournamentPlayer?.status === 'ACTIVE';
  const amIAfk = myTournamentPlayer?.status === 'AFK';

  const activeTables = activeTournament?.tables.filter((t) => t.isActive) || [];
  const eliminatedPlayers = activeTournament?.players
    .filter((p) => p.status === 'ELIMINATED')
    .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999)) || [];

  return (
    <div className="dashboard">
      <Header
        player={player!}
        tournament={activeTournament}
        onToggleAfk={handleToggleAfk}
        onBeerToast={handleBeerToastClick}
        onKnockOut={() => player && handleEliminate(player.id)}
        isAfk={amIAfk || false}
        isActive={isMyTurnActive || false}
        navigate={navigate}
      />

      {notification && (
        <NotificationToast
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}

      {mergeSuggestion && player?.isAdmin && (
        <MergeBanner
          suggestion={mergeSuggestion}
          onAccept={handleMerge}
          onDismiss={() => setMergeSuggestion(null)}
        />
      )}

      {beerToast && <BeerToastOverlay playerName={beerToast.playerName} />}

      {!activeTournament && (
        <div className="no-tournament">
          <h2>No Active Tournament</h2>
          <p>Waiting for an admin to create one...</p>
          {player?.isAdmin && (
            <button onClick={() => navigate('/admin')} className="btn-primary">
              Create Tournament
            </button>
          )}
        </div>
      )}

      {activeTournament?.status === 'ACTIVE' && !myTournamentPlayer && (
        <div className="join-tournament-banner">
          <h2>{activeTournament.name}</h2>
          <p>
            {activeTournament.players.filter((p) => p.status !== 'ELIMINATED').length} players
            at the tables
          </p>
          <button onClick={handleJoinTournament} className="btn-primary btn-join">
            Join Tournament
          </button>
        </div>
      )}

      {activeTournament?.status === 'FINISHED' ? (
        <FinalResults tournament={activeTournament} />
      ) : (
        <>
          <div className="tables-grid">
            {activeTables.map((table) => (
              <PokerTable
                key={table.id}
                table={table}
                currentPlayerId={player?.id || ''}
                isAdmin={player?.isAdmin || false}
                onEliminate={handleEliminate}
              />
            ))}
          </div>

          {eliminatedPlayers.length > 0 && (
            <EliminatedList players={eliminatedPlayers} />
          )}
        </>
      )}

      {!activeTournament && tournaments.length > 0 && (
        <div className="tournament-list">
          <h3>Past Tournaments</h3>
          {tournaments
            .filter((t) => t.status === 'FINISHED')
            .map((t) => (
              <button
                key={t.id}
                className="tournament-list-item"
                onClick={async () => {
                  const full = await apiClient.get(`/api/tournaments/${t.id}`);
                  setActiveTournament(full);
                }}
              >
                {t.name} ({t._count?.players || 0} players)
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
