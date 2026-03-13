import { useState } from 'react';
import { api } from '../hooks/useApi';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api('/api/auth/login', { method: 'POST', body: { email } });
      if (result.emailError) {
        setError('Login link created but email delivery failed. Contact admin.');
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="logo-icon">♠</span>
          <h1>Scelto Poker</h1>
          <p>Tournament Dashboard</p>
        </div>

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
            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Login Link'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
