import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { QRCodeSVG } from '../../components/QRCodeSVG';
import { apiRequest, getBaseUrl } from '../../core/api/client';
import { getDeviceId, detectDeviceName, detectDeviceType } from '../../core/sync/syncEngine';
import {
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Wifi,
  QrCode,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Radio,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface DeviceItem {
  id: string;
  device_id: string;
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'browser';
  ip_address: string;
  last_seen: string;
  is_online: boolean;
  is_active: boolean;
}

interface ServerInfo {
  local_ip: string;
  api_port: number;
  web_port: number;
  api_url: string;
  web_url: string;
  pair_url: string;
}

interface PairingTicketResponse {
  ticket_code: string;
  server_url: string;
  pair_url: string;
  pin_code?: string;
  local_ip?: string;
  expires_at: string;
  expires_in_seconds: number;
  user_name: string;
  qr_payload: {
    protocol: string;
    version: number;
    server: string;
    ticket: string;
    pin?: string;
    user_name: string;
  };
}

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'devices'>('qr');
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [pairingTicket, setPairingTicket] = useState<PairingTicketResponse | null>(null);
  const [ticketCountdown, setTicketCountdown] = useState<number>(300);
  const [isGeneratingTicket, setIsGeneratingTicket] = useState<boolean>(false);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [error, setError] = useState('');

  const handleCopyPin = () => {
    const pin = pairingTicket?.pin_code || pairingTicket?.ticket_code;
    if (pin) {
      navigator.clipboard.writeText(pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const handleCopyIp = () => {
    const ip = serverInfo?.local_ip;
    if (ip) {
      navigator.clipboard.writeText(ip);
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
  };

  const currentDeviceId = getDeviceId();

  const generateTicket = async () => {
    setIsGeneratingTicket(true);
    try {
      const res = await apiRequest<PairingTicketResponse>('/api/sync/pair/generate/', { method: 'POST' });
      setPairingTicket(res);
      setTicketCountdown(res.expires_in_seconds || 300);
    } catch (ticketErr: any) {
      console.warn('Generate pairing ticket note:', ticketErr);
    } finally {
      setIsGeneratingTicket(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError('');

    // 1. Fetch host server information (required for QR code)
    try {
      const info = await apiRequest<ServerInfo>('/api/sync/server-info/');
      setServerInfo(info);
    } catch (err: any) {
      setError(err.message || 'Failed to load server information.');
    }

    // 2. Generate secure, single-use pairing ticket
    await generateTicket();

    // 3. Send heartbeat for this device (non-fatal background call)
    try {
      await apiRequest('/api/sync/devices/heartbeat/', {
        method: 'POST',
        body: JSON.stringify({
          device_id: currentDeviceId,
          device_name: detectDeviceName(),
          device_type: detectDeviceType(),
        }),
      });
    } catch (hbErr) {
      console.warn('Device heartbeat background note:', hbErr);
    }

    // 4. Fetch list of all active connected devices
    try {
      const deviceList = await apiRequest<DeviceItem[]>('/api/sync/devices/');
      setDevices(deviceList);
    } catch (listErr: any) {
      console.warn('Device list note:', listErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Countdown timer for pairing ticket
  useEffect(() => {
    if (!isOpen || !pairingTicket) return;
    const interval = setInterval(() => {
      setTicketCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, pairingTicket]);

  const handleDisconnectDevice = async (deviceId: string) => {
    const confirmed = window.confirm(
      'Remove this sub system? It will be signed out immediately and must scan a new QR code or enter a new 6-digit PIN to reconnect.',
    );
    if (!confirmed) return;
    try {
      await apiRequest(`/api/sync/devices/${deviceId}/`, { method: 'DELETE' });
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
    } catch (err: any) {
      setError('Failed to disconnect device.');
    }
  };

  const handleCopyLink = () => {
    if (!serverInfo) return;
    const directUrl = pairingTicket?.pair_url || serverInfo.pair_url;
    navigator.clipboard.writeText(directUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone size={18} color="#f59e0b" />;
      case 'tablet':
        return <Tablet size={18} color="#38bdf8" />;
      default:
        return <Laptop size={18} color="#34d399" />;
    }
  };

  const formatLastSeen = (isoStr: string, isOnline: boolean) => {
    if (isOnline) return 'Active now';
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return `${Math.floor(diffHrs / 24)}d ago`;
    } catch {
      return 'Offline';
    }
  };

  const qrPairingPayload = React.useMemo(() => {
    if (pairingTicket?.pair_url) {
      return pairingTicket.pair_url;
    }
    // Never fall back to embedding account tokens in a QR. A ticket must be
    // generated before the companion can be linked.
    return serverInfo?.pair_url || `${getBaseUrl()}/pair?role=companion`;
  }, [pairingTicket, serverInfo]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connected Devices & Mobile Pairing"
      maxWidth="840px"
      bodyStyle={{
        padding: '16px 24px 20px',
        overflowY: activeTab === 'qr' ? 'hidden' : 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'qr' ? '2px solid #f59e0b' : '2px solid transparent',
              color: activeTab === 'qr' ? '#f59e0b' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <QrCode size={16} />
            Pair Device (QR)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'devices' ? '2px solid #f59e0b' : '2px solid transparent',
              color: activeTab === 'devices' ? '#f59e0b' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Radio size={16} />
            Active ({devices.length})
          </button>
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

        {/* TAB 1: QR Code & Station Linking (Horizontal No-Scroll Layout) */}
        {activeTab === 'qr' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '270px 1fr',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* LEFT COLUMN: QR Code Card */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '10px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {/* Security Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: '#34d399',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={13} />
                Zero-Password QR Ticket
              </div>

              {/* QR Code Container */}
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '10px',
                    borderRadius: '14px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                    display: 'inline-block',
                    opacity: ticketCountdown === 0 ? 0.25 : 1,
                    filter: ticketCountdown === 0 ? 'grayscale(100%)' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <QRCodeSVG value={qrPairingPayload} size={180} fgColor="#07090e" bgColor="#ffffff" />
                </div>

                {ticketCountdown === 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '14px',
                      background: 'rgba(7, 9, 14, 0.85)',
                    }}
                  >
                    <span style={{ color: '#fb7185', fontWeight: 600, fontSize: '0.82rem' }}>
                      Ticket Expired
                    </span>
                    <button
                      type="button"
                      onClick={generateTicket}
                      disabled={isGeneratingTicket}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <RefreshCw size={12} className={isGeneratingTicket ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>
                )}
              </div>

              {/* Live Countdown & Refresh Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.76rem',
                    color: ticketCountdown < 60 ? '#fb7185' : '#94a3b8',
                    fontWeight: 500,
                  }}
                >
                  <Clock size={13} color={ticketCountdown < 60 ? '#fb7185' : '#34d399'} />
                  <span>
                    Expires: <strong>{Math.floor(ticketCountdown / 60)}:{(ticketCountdown % 60).toString().padStart(2, '0')}</strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={generateTicket}
                  disabled={isGeneratingTicket}
                  className="btn-ghost"
                  style={{
                    fontSize: '0.74rem',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  <RefreshCw size={11} className={isGeneratingTicket ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Scan with Phone / Tablet Camera
              </span>
            </div>

            {/* RIGHT COLUMN: Instructions & Sub System PIN Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Mobile Scan Instructions */}
              <div>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={16} color="#f59e0b" />
                  Connect Mobile or Tablet
                </h4>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    lineHeight: 1.45,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div>1. Connect phone or tablet to the <strong>same Wi-Fi network</strong>.</div>
                  <div>2. Open AstroLedger APK and tap <strong>'Scan PC Screen QR Code'</strong>.</div>
                  <div>3. Device links automatically — <strong>no passwords or email needed</strong>!</div>
                </div>
              </div>

              {/* Sub System direct link PIN box */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Laptop size={15} /> For Sub Systems (Manual Link)
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                    Same Wi-Fi
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Station IP</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', fontFamily: 'monospace' }}>
                        {serverInfo?.local_ip || '192.168.29.176'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyIp}
                        title="Copy Station IP"
                        style={{ background: 'transparent', border: 'none', color: copiedIp ? '#34d399' : '#94a3b8', cursor: 'pointer', padding: 0 }}
                      >
                        {copiedIp ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>6-Digit Link PIN</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', letterSpacing: '3px', fontFamily: 'monospace' }}>
                        {pairingTicket?.pin_code || pairingTicket?.ticket_code || '------'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPin}
                        title="Copy Link PIN"
                        style={{ background: 'transparent', border: 'none', color: copiedPin ? '#34d399' : '#94a3b8', cursor: 'pointer', padding: 0 }}
                      >
                        {copiedPin ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                  On the Sub System, scan the QR or enter this Station IP and PIN to link instantly.
                </div>
              </div>

              {/* Direct Browser Link */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
                  <Wifi size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {serverInfo?.api_url || 'http://192.168.29.176:8000'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Active Connected Devices */}
        {activeTab === 'devices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Authorized devices synchronized with this practice account:
              </span>
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="btn-ghost"
                style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {devices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-secondary)' }}>
                <Globe size={28} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '0.88rem' }}>No other devices connected yet.</p>
                <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>Scan the QR code from your phone to connect.</p>
              </div>
            ) : (
              devices.map((device) => {
                const isCurrent = device.device_id === currentDeviceId;

                return (
                  <div
                    key={device.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isCurrent ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: isCurrent ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getDeviceIcon(device.device_type)}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                            {device.device_name}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: '#fbbf24',
                                fontWeight: 700,
                              }}
                            >
                              THIS DEVICE
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: device.is_online ? '#34d399' : '#64748b',
                                display: 'inline-block',
                              }}
                            />
                            {formatLastSeen(device.last_seen, device.is_online)}
                          </span>
                          {device.ip_address && <span>• IP: {device.ip_address}</span>}
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleDisconnectDevice(device.device_id)}
                        title="Disconnect this device"
                        style={{
                          background: 'rgba(251, 113, 133, 0.1)',
                          border: '1px solid rgba(251, 113, 133, 0.2)',
                          color: '#fb7185',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}

            <div
              style={{
                marginTop: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(52, 211, 153, 0.05)',
                border: '1px solid rgba(52, 211, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: '#94a3b8',
              }}
            >
              <ShieldCheck size={16} color="#34d399" style={{ flexShrink: 0 }} />
              <span>
                All active devices sync securely using encrypted JWT tokens and atomic change event versioning.
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
