import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { apiRequest, setTokens, getBaseUrl, setServerUrl } from '../../core/api/client';
import { Sparkles, Lock, Wifi, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Server host connection state for mobile / multi-device setup
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getBaseUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Testing connection to server...');
    try {
      const cleanUrl = customServerUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/health/`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setTestStatus('success');
        setTestMessage(`Connected! ${data.service} v${data.version} (${data.status})`);
      } else {
        setTestStatus('failed');
        setTestMessage(`Server reachable but returned error ${res.status}`);
      }
    } catch (err: any) {
      setTestStatus('failed');
      setTestMessage('Unable to reach server. Verify PC IP address and Wi-Fi connection.');
    }
  };

  const handleSaveServer = () => {
    setServerUrl(customServerUrl);
    window.location.reload();
  };

  const handleResetServer = () => {
    setServerUrl('');
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        await apiRequest('/api/auth/register/', {
          method: 'POST',
          requiresAuth: false,
          body: JSON.stringify({ email, name, password }),
        });
      }

      const tokenData = await apiRequest('/api/auth/login/', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ email, password }),
      });

      if (tokenData.access && tokenData.refresh) {
        setTokens(tokenData.access, tokenData.refresh);
        onLoginSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRegistering ? 'Astrologer Registration' : 'AstroLedger Sign In'}
      maxWidth="460px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Sparkles size={24} color="#07090e" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {isRegistering ? 'Create Astrologer Account' : 'Welcome to AstroLedger'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {isRegistering
              ? 'Start managing clients and horoscopes across devices'
              : 'Enter your credentials to access your consultation registry'}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(251, 113, 133, 0.15)',
              border: '1px solid rgba(251, 113, 133, 0.3)',
              color: '#fb7185',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {isRegistering && (
          <div className="input-group">
            <label className="input-label">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acharya Vidyasagar"
              className="input-control"
            />
          </div>
        )}

        <div className="input-group">
          <label className="input-label">Email Address</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="astrologer@example.com"
              className="input-control"
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-control"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '8px' }}
        >
          <Lock size={16} />
          {loading ? 'Authenticating...' : isRegistering ? 'Register Account' : 'Sign In'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            className="btn-ghost"
            style={{ fontSize: '0.85rem', color: '#fbbf24', border: 'none', cursor: 'pointer' }}
          >
            {isRegistering
              ? 'Already have an account? Sign in'
              : "Don't have an account? Create one"}
          </button>
        </div>

        {/* Server Host Settings (For Mobile & Multi-Device Setup) */}
        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              <Wifi size={13} color="#f59e0b" />
              <span>{showServerConfig ? 'Hide Server Settings' : `Server: ${getBaseUrl()}`}</span>
            </button>
          </div>

          {showServerConfig && (
            <div
              style={{
                marginTop: '10px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Connect this mobile device or laptop to your main computer's server on Wi-Fi:
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="http://192.168.1.15:8000"
                  className="input-control"
                  style={{ fontSize: '0.82rem', padding: '6px 10px', flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test'}
                </button>
              </div>

              {testMessage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.76rem',
                    color: testStatus === 'success' ? '#34d399' : '#fb7185',
                  }}
                >
                  {testStatus === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{testMessage}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleResetServer}
                  className="btn-ghost"
                  style={{ fontSize: '0.75rem', color: '#94a3b8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RotateCcw size={12} />
                  Reset to Localhost
                </button>
                <button
                  type="button"
                  onClick={handleSaveServer}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                >
                  Save & Connect
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
