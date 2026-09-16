import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { apiRequest, setTokens, getBaseUrl, setServerUrl } from '../../core/api/client';
import {
  Sparkles,
  Lock,
  Wifi,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  QrCode,
  Laptop,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Camera,
} from 'lucide-react';
import { QRScannerModal } from '../devices/QRScannerModal';
import { getDeviceId, getDeviceName, isCompanionDevice } from '../../core/platform';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  showCloseButton?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  showCloseButton = true,
}) => {
  const [stationMode, setStationMode] = useState<'main' | 'sub'>(
    isCompanionDevice() ? 'sub' : 'main'
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sub System connection state (zero-password PIN pairing)
  const [subStationIp, setSubStationIp] = useState<string>('');
  const [subStationPin, setSubStationPin] = useState<string>('');
  const [subStationLoading, setSubStationLoading] = useState<boolean>(false);
  const [subStationError, setSubStationError] = useState<string>('');

  // Server host connection state for mobile / multi-device setup
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getBaseUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleQRScanSuccess = async (data: { serverUrl: string; ticket?: string; accessToken?: string; refreshToken?: string }) => {
    setServerUrl(data.serverUrl);
    setCustomServerUrl(data.serverUrl);

    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      onLoginSuccess();
      onClose();
      return;
    }

    if (data.ticket) {
      try {
        setTestStatus('testing');
        setTestMessage('Exchanging security ticket with PC...');
        const res = await fetch(`${data.serverUrl.replace(/\/+$/, '')}/api/sync/pair/claim/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket: data.ticket,
            device_id: getDeviceId(),
            device_name: getDeviceName(),
            device_type: 'mobile',
          }),
        });
        const claimData = await res.json();
        if (res.ok && claimData.access && claimData.refresh) {
          setTokens(claimData.access, claimData.refresh);
          onLoginSuccess();
          onClose();
          return;
        } else {
          setTestStatus('failed');
          setTestMessage(claimData.detail || 'Failed to claim pairing ticket.');
          setShowServerConfig(true);
          return;
        }
      } catch (err: any) {
        setTestStatus('failed');
        setTestMessage(err.message || 'Cannot claim pairing ticket.');
        setShowServerConfig(true);
        return;
      }
    }

    setTestStatus('testing');
    setTestMessage('Testing connection to PC...');
    try {
      const res = await fetch(`${data.serverUrl.replace(/\/+$/, '')}/api/health/`);
      if (res.ok) {
        setTestStatus('success');
        setTestMessage(`Connected to PC at ${data.serverUrl}! You can now sign in.`);
        setShowServerConfig(true);
      } else {
        setTestStatus('failed');
        setTestMessage(`Reached PC at ${data.serverUrl}, but returned status ${res.status}.`);
        setShowServerConfig(true);
      }
    } catch {
      setTestStatus('failed');
      setTestMessage(`Cannot connect to ${data.serverUrl}. Verify both devices are on the same Wi-Fi.`);
      setShowServerConfig(true);
    }
  };

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

  const handleSubStationPair = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubStationError('');
    if (!subStationIp.trim() || !subStationPin.trim()) {
      setSubStationError('Please enter both the Main Station IP and 6-digit Link PIN.');
      return;
    }

    setSubStationLoading(true);
    try {
      let serverUrl = subStationIp.trim();
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = `http://${serverUrl}`;
      }
      if (!serverUrl.includes(':8000') && !serverUrl.includes(':5173')) {
        serverUrl = `${serverUrl}:8000`;
      }
      serverUrl = serverUrl.replace(/\/+$/, '');

      const cleanPin = subStationPin.trim().replace(/\s+/g, '').replace(/-/g, '');

      const res = await fetch(`${serverUrl}/api/sync/pair/claim/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: cleanPin,
          device_id: getDeviceId(),
          device_name: 'Sub System',
          device_type: 'desktop',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || `Connection refused (${res.status})`);
      }

      if (data.access && data.refresh) {
        setServerUrl(serverUrl);
        setTokens(data.access, data.refresh);
        onLoginSuccess();
        onClose();
      } else {
        throw new Error('Invalid authentication response received from Main PC.');
      }
    } catch (err: any) {
      setSubStationError(
        err.message || 'Unable to connect to Main PC. Verify IP, PIN, and Wi-Fi connection.'
      );
    } finally {
      setSubStationLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={showCloseButton}
      title={
        stationMode === 'sub'
          ? 'Connect Sub System'
          : isRegistering
          ? 'Astrologer Registration'
          : 'AstroLedger Sign In'
      }
      maxWidth="840px"
      bodyStyle={{
        padding: '18px 22px',
        overflowY: 'auto',
      }}
    >
      {/* Universal 1-Click Station Role Switcher Bar — Always at top */}
      <div className="login-mode-switcher-bar">
        <button
          type="button"
          onClick={() => {
            setStationMode('sub');
            setSubStationError('');
          }}
          className={`login-mode-btn ${stationMode === 'sub' ? 'active-sub' : ''}`}
        >
          <div className="login-mode-icon-circle">
            <Wifi size={16} />
          </div>
          <div className="login-mode-text">
            <div className="login-mode-title">Sub System</div>
            <div className="login-mode-subtitle">Zero-Password Link (PIN &amp; QR)</div>
          </div>
          {stationMode === 'sub' && <span className="login-mode-active-pill sub">Active</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            setStationMode('main');
            setError('');
          }}
          className={`login-mode-btn ${stationMode === 'main' ? 'active-main' : ''}`}
        >
          <div className="login-mode-icon-circle">
            <Laptop size={16} />
          </div>
          <div className="login-mode-text">
            <div className="login-mode-title">Main Clinic PC</div>
            <div className="login-mode-subtitle">Master Password Login</div>
          </div>
          {stationMode === 'main' && <span className="login-mode-active-pill main">Active</span>}
        </button>
      </div>

      <div
        className="login-modal-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '270px 1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Desktop contextual overview & security */}
        <div
          className="desktop-only-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Station Mode Description Card */}
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              background: stationMode === 'sub' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: stationMode === 'sub' ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: stationMode === 'sub' ? '#38bdf8' : '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Sparkles size={12} />
              {stationMode === 'sub' ? 'Satellite Station Mode' : 'Master Clinic Station'}
            </div>
            <p style={{ fontSize: '0.74rem', color: '#cbd5e1', margin: 0, lineHeight: 1.45 }}>
              {stationMode === 'sub'
                ? 'Pair this Sub System with your Main Clinic PC on the same Wi-Fi. Real-time synchronization with no account password required.'
                : 'Primary master practice database host. Controls client directories, horoscopes, and multi-device satellite access tokens.'}
            </p>
          </div>

          {/* System Highlights Card */}
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={14} color="#34d399" /> Practice Security
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>• <strong>Encrypted Records</strong>: Confidential client consultations.</div>
              <div>• <strong>LAN Synchronized</strong>: Automatic sync across devices.</div>
              <div>• <strong>100% Offline Ready</strong>: Runs locally without cloud dependency.</div>
            </div>
          </div>

          {/* Server Connection Status Toggle (Desktop) */}
          <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontSize: '0.74rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '6px',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Wifi size={12} color="#f59e0b" />
                <span style={{ fontFamily: 'monospace' }}>{getBaseUrl()}</span>
              </span>
              <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>
                {showServerConfig ? 'Close' : 'Config'}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
          {stationMode === 'sub' ? (
            /* Sub System companion pairing form */
            <form onSubmit={handleSubStationPair} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <KeyRound size={17} color="#ffffff" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      Connect Sub System
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                      Zero passwords needed. Pair via camera scan or 6-digit PIN from Main PC.
                    </p>
                  </div>
                </div>
              </div>

              {/* Instant Camera QR Scanner Button */}
              <button
                type="button"
                onClick={() => setShowQRScanner(true)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                }}
              >
                <Camera size={18} />
                Scan PC Screen QR Code
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Or enter Station IP &amp; 6-Digit PIN
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
              </div>

              {subStationError && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(251, 113, 133, 0.15)',
                    border: '1px solid rgba(251, 113, 133, 0.3)',
                    color: '#fb7185',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                >
                  {subStationError}
                </div>
              )}

              <div className="input-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Wifi size={13} color="#f59e0b" /> Main Station IP
                </label>
                <input
                  type="text"
                  required
                  value={subStationIp}
                  onChange={(e) => setSubStationIp(e.target.value)}
                  placeholder="e.g. 192.168.29.176"
                  className="input-control"
                  style={{ fontFamily: 'monospace', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="input-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <KeyRound size={13} color="#34d399" /> 6-Digit Link PIN
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={subStationPin}
                  onChange={(e) => setSubStationPin(e.target.value)}
                  placeholder="e.g. 582194"
                  className="input-control"
                  style={{
                    fontSize: '1.25rem',
                    letterSpacing: '4px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={subStationLoading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                }}
              >
                {subStationLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Connecting to Main PC...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Link Sub System &amp; Open Workspace
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStationMode('main');
                    setError('');
                  }}
                  className="btn-ghost"
                  style={{
                    fontSize: '0.8rem',
                    color: '#fbbf24',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'underline',
                  }}
                >
                  <Laptop size={14} />
                  Using this device as Master PC? Switch to Password Login
                </button>
              </div>
            </form>
          ) : (
            /* Main Clinic PC Login Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={18} color="#07090e" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                    {isRegistering ? 'Create Astrologer Account' : 'Welcome to AstroLedger'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {isRegistering
                      ? 'Setup your master practice credentials'
                      : 'Enter your credentials to access your consultation registry'}
                  </p>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(251, 113, 133, 0.15)',
                    border: '1px solid rgba(251, 113, 133, 0.3)',
                    color: '#fb7185',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                >
                  {error}
                </div>
              )}

              {isRegistering && (
                <div className="input-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label className="input-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acharya Vidyasagar"
                    className="input-control"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div className="input-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                <label className="input-label">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="astrologer@example.com"
                  className="input-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="input-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                <label className="input-label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px', width: '100%', boxSizing: 'border-box' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Lock size={15} />
                  {loading ? 'Authenticating...' : isRegistering ? 'Register' : 'Sign In'}
                </button>

                {/* Mobile QR Pairing Button */}
                <button
                  type="button"
                  onClick={() => setShowQRScanner(true)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'rgba(245, 158, 11, 0.08)',
                    color: '#f59e0b',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  <QrCode size={15} color="#f59e0b" />
                  Scan Mobile QR
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                  }}
                  className="btn-ghost"
                  style={{ fontSize: '0.82rem', color: '#fbbf24', border: 'none', cursor: 'pointer' }}
                >
                  {isRegistering
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Create one"}
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStationMode('sub');
                    setError('');
                  }}
                  className="btn-ghost"
                  style={{
                    fontSize: '0.8rem',
                    color: '#38bdf8',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'underline',
                  }}
                >
                  <Wifi size={14} />
                  Using a Sub System? Link using QR / PIN
                </button>
              </div>
            </form>
          )}

          {/* Mobile Server Config Link */}
          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.74rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px',
              }}
            >
              <Wifi size={11} color="#f59e0b" />
              <span>Server: {getBaseUrl()} ({showServerConfig ? 'Close' : 'Config'})</span>
            </button>
          </div>

          {/* Expandable Server Config Drawer */}
          {showServerConfig && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                Station API Host Address:
              </div>

              <div style={{ display: 'flex', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="http://192.168.1.15:8000"
                  className="input-control"
                  style={{ fontSize: '0.8rem', padding: '5px 8px', flex: 1, fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '5px 10px', whiteSpace: 'nowrap' }}
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test'}
                </button>
              </div>

              {testMessage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.74rem',
                    color: testStatus === 'success' ? '#34d399' : '#fb7185',
                  }}
                >
                  {testStatus === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  <span>{testMessage}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={handleResetServer}
                  className="btn-ghost"
                  style={{ fontSize: '0.72rem', color: '#94a3b8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <RotateCcw size={11} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSaveServer}
                  className="btn btn-primary"
                  style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                >
                  Save &amp; Connect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <QRScannerModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleQRScanSuccess}
      />
    </Modal>
  );
};
