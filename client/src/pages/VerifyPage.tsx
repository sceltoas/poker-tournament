import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../hooks/useApi';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No token provided');
      return;
    }

    api(`/api/auth/verify?token=${token}`)
      .then((data) => {
        login(data.token, data.player);
        navigate('/');
      })
      .catch((err) => setError(err.message));
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Login Failed</h1>
          <p className="error">{error}</p>
          <a href="/login">Try again</a>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Verifying...</p>
    </div>
  );
}
