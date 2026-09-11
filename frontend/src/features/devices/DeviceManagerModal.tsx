import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { QRCodeSVG } from '../../components/QRCodeSVG';
import { apiRequest } from '../../core/api/client';
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

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'devices'>('qr');
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const currentDeviceId = getDeviceId();

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

    // 2. Send heartbeat for this device (non-fatal background call)
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

    // 3. Fetch list of all active connected devices
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

  const handleDisconnectDevice = async (deviceId: string) => {
    try {
      await apiRequest(`/api/sync/devices/${deviceId}/`, { method: 'DELETE' });
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
    } catch (err: any) {
      setError('Failed to disconnect device.');
    }
  };

  const handleCopyLink = () => {
    if (!serverInfo) return;
    navigator.clipboard.writeText(serverInfo.pair_url);
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

  const qrPairingUrl = serverInfo
    ? serverInfo.pair_url
    : `${window.location.origin}/?server=${window.location.origin}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connected Devices & Mobile Pairing" maxWidth="600px">
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

        {/* TAB 1: QR Code Pairing */}
        {activeTab === 'qr' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
            <div
              style={{
                background: '#ffffff',
                padding: '12px',
                borderRadius: '16px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                display: 'inline-block',
                marginTop: '6px',
              }}
            >
              <QRCodeSVG value={qrPairingUrl} size={210} fgColor="#07090e" bgColor="#ffffff" />
            </div>

            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                Scan to Connect Mobile or Tablet
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.4 }}>
                1. Ensure your phone or iPad is on the <strong>same clinic Wi-Fi</strong>.<br />
                2. Open your phone camera and point it at the QR code.<br />
                3. Tap the link to open AstroLedger with <strong>automatic server binding</strong>.
              </p>
            </div>

            {/* Direct Link Card */}
            <div
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <Wifi size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {qrPairingUrl}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
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
