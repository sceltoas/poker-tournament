import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player } from '../types';
import { api } from '../hooks/useApi';

interface AuthContextType {
  player: Player | null;
  token: string | null;
  loading: boolean;
  login: (token: string, player: Player) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  player: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage?.getItem?.('poker_token') || null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api('/api/auth/me', { token })
        .then((data) => setPlayer(data))
        .catch(() => {
          setToken(null);
          try { localStorage.removeItem('poker_token'); } catch {}
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newPlayer: Player) => {
    setToken(newToken);
    setPlayer(newPlayer);
    try { localStorage.setItem('poker_token', newToken); } catch {}
  };

  const logout = () => {
    setToken(null);
    setPlayer(null);
    try { localStorage.removeItem('poker_token'); } catch {}
  };

  return (
    <AuthContext.Provider value={{ player, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
