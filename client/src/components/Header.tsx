import { Beer, Wifi, WifiOff, Shield, LogOut, Coffee, ArrowRight, Bell, BellOff, BellRing } from 'lucide-react';
import { Player, Tournament } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { NavigateFunction } from 'react-router-dom';

interface Props {
  player: Player;
  tournament: Tournament | null;
  onToggleAfk: () => void;
  onBeerToast: () => void;
  onStartTournament: () => void;
  isAfk: boolean;
  isActive: boolean;
  navigate: NavigateFunction;
}

export default function Header({
  player,
  tournament,
  onToggleAfk,
  onBeerToast,
  isAfk,
  isActive,
  navigate,
}: Props) {
  const { logout } = useAuth();
  const { connected } = useSocket();
  const { pushState, subscribe } = usePushNotifications();

  const activePlayers = tournament?.players.filter(
    (p) => p.status === 'ACTIVE' || p.status === 'AFK'
  ).length || 0;
  const totalPlayers = tournament?.players.length || 0;

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="app-title">
          <span className="spade">♠</span> Scelto Poker
        </h1>
        {tournament && (
          <span className="tournament-name">{tournament.name}</span>
        )}
        <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className="header-center">
        {tournament && tournament.status === 'ACTIVE' && (
          <div className="player-count">
            {activePlayers} / {totalPlayers} players remaining
          </div>
        )}
      </div>

      <div className="header-right">
        {tournament?.status === 'ACTIVE' && (isActive || isAfk) && (
          <>
            <button
              onClick={onBeerToast}
              className="btn-beer"
              title="Raise a toast!"
            >
              <Beer size={20} />
            </button>

            <button
              onClick={onToggleAfk}
              className={`btn-afk ${isAfk ? 'is-afk' : ''}`}
              title={isAfk ? "I'm back!" : 'Going AFK'}
            >
              <Coffee size={16} />
              {isAfk ? "I'm Back" : 'AFK'}
            </button>

            {!player.isAdmin && isActive && (
              <button
                onClick={() => {/* handled in parent */}}
                className="btn-eliminate-self"
                title="I'm out"
              >
                Knocked Out
              </button>
            )}
          </>
        )}

        {player.isAdmin && (
          <button onClick={() => navigate('/admin')} className="btn-admin" title="Admin">
            <Shield size={16} /> Admin
          </button>
        )}

        {pushState !== 'unsupported' && (
          <button
            onClick={pushState === 'prompt' ? subscribe : undefined}
            className={`btn-notify ${pushState}`}
            title={
              pushState === 'subscribed'
                ? 'Notifications enabled'
                : pushState === 'denied'
                ? 'Notifications blocked — enable in browser settings'
                : 'Enable notifications'
            }
            disabled={pushState !== 'prompt'}
          >
            {pushState === 'subscribed' ? (
              <BellRing size={16} />
            ) : pushState === 'denied' ? (
              <BellOff size={16} />
            ) : (
              <Bell size={16} />
            )}
          </button>
        )}

        <div className="user-info">
          <span className="user-name">{player.name}</span>
          <button onClick={logout} className="btn-logout" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
