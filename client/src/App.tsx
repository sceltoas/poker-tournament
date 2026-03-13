import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import VerifyPage from './pages/VerifyPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { player, loading } = useAuth();

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
      <Route path="/" element={player ? <DashboardPage /> : <LandingPage />} />
      <Route
        path="/admin"
        element={
          player?.isAdmin ? <AdminPage /> : <Navigate to="/" />
        }
      />
    </Routes>
  );
}
