import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import LoginPage from './pages/LoginPage';
import VerifyPage from './pages/VerifyPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { player, loading } = useAuth();
  usePushNotifications();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/verify" element={<VerifyPage />} />
      <Route path="/login" element={player ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={player ? <DashboardPage /> : <Navigate to="/login" />} />
      <Route
        path="/admin"
        element={
          player?.isAdmin ? <AdminPage /> : <Navigate to="/" />
        }
      />
    </Routes>
  );
}
