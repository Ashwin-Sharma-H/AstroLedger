import React, { useEffect, useState } from 'react';
import {
  QrCode,
  Camera,
  Wifi,
  ShieldCheck,
  Laptop,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { QRScannerModal } from './QRScannerModal';
import { setServerUrl, setTokens } from '../../core/api/client';
import { getDeviceId, getDeviceName, setDeviceRole } from '../../core/platform';

interface MobilePairingViewProps {
  onPairedSuccess: () => void;
  onSwitchToManualLogin?: () => void;
  showLoggedOutNotice?: boolean;
  onContinueAfterLogout?: () => void;
}

export const MobilePairingView: React.FC<MobilePairingViewProps> = ({
  onPairedSuccess,
  onSwitchToManualLogin,
  showLoggedOutNotice = false,
  onContinueAfterLogout,
}) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [statusState, setStatusState] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [manualIpInput, setManualIpInput] = useState<string>('');
  const [manualPinInput, setManualPinInput] = useState<string>('');
  const [showManualIp, setShowManualIp] = useState(false);

  // A QR scanned by the phone's normal camera opens the station-hosted SPA at
  // /pair?role=companion&t=123456. Claim the one-time ticket immediately;
  // the installed APK uses the same claim path after its in-app scan.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get('t') || params.get('ticket');
    if (ticket && window.location.pathname === '/pair') {
      void claimPairingTicket(window.location.origin, ticket);
    }
  // This must run only when the companion pairing screen first opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claimPairingTicket = async (serverUrl: string, ticketCode?: string, accessTok?: string, refreshTok?: string) => {
    setStatusState('pairing');
    setErrorMessage('');
    const cleanServer = serverUrl.trim().replace(/\/+$/, '');
    setStatusMessage(`Connecting to Master PC (${cleanServer})...`);

    // Case 1: Direct tokens provided in QR code
    if (accessTok && refreshTok) {
      setServerUrl(cleanServer);
      setTokens(accessTok, refreshTok);
      setStatusState('success');
      setStatusMessage('Device linked! Launching AstroLedger...');
      setTimeout(() => {
        onPairedSuccess();
      }, 800);
      return;
    }

    // Case 2: Ticket code provided (Zero-Password Pairing protocol)
    if (ticketCode) {
      try {
        setStatusMessage('Exchanging security ticket with PC Station...');
        const claimEndpoint = `${cleanServer}/api/sync/pair/claim/`;

        const response = await fetch(claimEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticket: ticketCode,
            device_id: getDeviceId(),
            device_name: getDeviceName(),
            device_type: 'mobile',
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.detail || data.message || `PC refused connection (${response.status})`);
        }

        if (data.access && data.refresh) {
          setServerUrl(cleanServer);
          setTokens(data.access, data.refresh);
          setStatusState('success');
          setStatusMessage(data.message || 'Device linked! Launching workspace...');
          setTimeout(() => {
            onPairedSuccess();
          }, 800);
        } else {
          throw new Error('Invalid authentication response from PC Station.');
        }
      } catch (err: any) {
        console.error('[Pairing] Claim failed:', err);
        setStatusState('error');
        setErrorMessage(
          err.message ||
            'Unable to reach PC Station. Please verify both devices are on the same Wi-Fi and PC Windows Firewall allows port 8000.'
        );
      }
      return;
    }

    // Case 3: Only server URL provided
    setServerUrl(cleanServer);
    setStatusState('error');
    setErrorMessage(
      `Connected to ${cleanServer}, but no security ticket was found. Please scan the QR code from the PC's 'Pair Device (QR)' screen.`
    );
  };

  const handleScanSuccess = (scanned: { serverUrl: string; accessToken?: string; refreshToken?: string }) => {
    // Extract ticket if query parameter exists
    let ticket: string | undefined;
    try {
      if (scanned.serverUrl.includes('?')) {
        const url = new URL(scanned.serverUrl);
        ticket = url.searchParams.get('ticket') || undefined;
      }
    } catch {
      // ignore
    }

    // Also parse if raw scanned data contains ticket property (JSON payload)
    const anyScanned = scanned as any;
    if (anyScanned.ticket) {
      ticket = anyScanned.ticket;
    }

    claimPairingTicket(scanned.serverUrl, ticket, scanned.accessToken, scanned.refreshToken);
  };

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIpInput.trim()) {
      setStatusState('error');
      setErrorMessage('Please enter the PC Station IP address (e.g. 192.168.29.176).');
      return;
    }
    if (!manualPinInput.trim()) {
      setStatusState('error');
      setErrorMessage("Please enter the 6-digit Link PIN shown on your Main PC screen.");
      return;
    }

    let url = manualIpInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    if (!url.includes(':8000') && !url.includes(':5173')) {
      url = `${url}:8000`;
    }

    const cleanPin = manualPinInput.trim().replace(/\s+/g, '').replace(/-/g, '');
    if (!/^\d{6}$/.test(cleanPin)) {
      setStatusState('error');
      setErrorMessage('The Link PIN must contain exactly six digits.');
      return;
    }
    claimPairingTicket(url, cleanPin);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse at top, #141b2d 0%, #080b12 60%, #030508 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 20px',
        color: '#f8fafc',
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {showLoggedOutNotice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(3, 5, 8, 0.96)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '30px 24px',
              borderRadius: '20px',
              background: '#101827',
              border: '1px solid rgba(251, 113, 133, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={42} color="#fb7185" style={{ marginBottom: '14px' }} />
            <h2 style={{ margin: '0 0 10px', color: '#ffffff', fontSize: '1.25rem' }}>
              You have been logged out
            </h2>
            <p style={{ margin: '0 0 22px', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
              This sub system was removed by the Main PC. To use it again, pair it with a new QR code or 6-digit Link PIN.
            </p>
            <button
              type="button"
              onClick={onContinueAfterLogout}
              style={{
                width: '100%',
                padding: '13px 18px',
                border: 'none',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.95rem',
              }}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      )}

      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0) 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header Badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, marginTop: '12px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <Sparkles size={12} color="#fbbf24" />
          Sub System Mode
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.35)',
            }}
          >
            <Laptop size={24} color="#ffffff" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#ffffff' }}>
              AstroLedger
            </h1>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Vedic Practice Companion</span>
          </div>
        </div>
      </div>

      {/* Center Interactive Pairing Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '18px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          zIndex: 1,
          margin: '20px 0',
        }}
      >
        {/* Animated Scanner Radar Icon */}
        <div
          style={{
            position: 'relative',
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.05) 70%)',
            border: '2px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)',
          }}
        >
          <QrCode size={42} color="#fbbf24" />
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
            Connect to Main PC
          </h2>
          <p style={{ fontSize: '0.86rem', color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
            No password needed! Open AstroLedger on your main PC, click <strong style={{ color: '#f59e0b' }}>Device Sync</strong>, and scan the QR code displayed on screen.
          </p>
        </div>

        {/* Status Alerts */}
        {statusState === 'pairing' && (
          <div
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'left',
            }}
          >
            <RefreshCw size={18} className="animate-spin" style={{ flexShrink: 0 }} />
            <span>{statusMessage}</span>
          </div>
        )}

        {statusState === 'success' && (
          <div
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(52, 211, 153, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#34d399',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'left',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{statusMessage}</span>
          </div>
        )}

        {statusState === 'error' && (
          <div
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(251, 113, 133, 0.15)',
              border: '1px solid rgba(251, 113, 133, 0.3)',
              color: '#fb7185',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Connection Failed</span>
            </div>
            <p style={{ margin: 0, color: '#fda4af', lineHeight: 1.4 }}>{errorMessage}</p>
          </div>
        )}

        {/* Primary Action Button: Launch Camera Scanner */}
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          <Camera size={20} />
          Scan PC Screen QR Code
        </button>

        {/* Checklist Tips */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            padding: '12px 14px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#cbd5e1' }}>
            <Wifi size={14} color="#34d399" />
            <span>Connect this phone to the <strong>same Wi-Fi</strong> as PC</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#cbd5e1' }}>
            <ShieldCheck size={14} color="#fbbf24" />
            <span>Zero credentials required — fully encrypted local link</span>
          </div>
        </div>

        {/* Manual 6-Digit PIN Pairing Fallback */}
        <div style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={() => setShowManualIp(!showManualIp)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              padding: '4px',
            }}
          >
            <KeyRound size={14} color="#f59e0b" />
            {showManualIp ? 'Hide PIN Linking' : 'Camera not scanning? Link with 6-Digit PIN'}
          </button>

          {showManualIp && (
            <form
              onSubmit={handleManualConnect}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '12px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.74rem',
                    color: '#94a3b8',
                    marginBottom: '4px',
                    fontWeight: 600,
                  }}
                >
                  Station IP (from PC screen)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.29.176"
                  value={manualIpInput}
                  onChange={(e) => setManualIpInput(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#ffffff',
                    fontSize: '0.86rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.74rem',
                    color: '#94a3b8',
                    marginBottom: '4px',
                    fontWeight: 600,
                  }}
                >
                  6-Digit Link PIN (from PC screen)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="e.g. 542682"
                  value={manualPinInput}
                  onChange={(e) => setManualPinInput(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#34d399',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    letterSpacing: '4px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={statusState === 'pairing'}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                }}
              >
                {statusState === 'pairing' ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Connect &amp; Link Phone
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Switch Options */}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        {onSwitchToManualLogin && (
          <button
            type="button"
            onClick={() => {
              setDeviceRole('station');
              onSwitchToManualLogin();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fbbf24',
              fontSize: '0.82rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Laptop size={14} />
            Using this device as Master PC? Switch to Password Login
          </button>
        )}
      </div>

      {/* In-App Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
};
