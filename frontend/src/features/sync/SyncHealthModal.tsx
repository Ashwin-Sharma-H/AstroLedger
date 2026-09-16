import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Laptop, Loader2, RefreshCw, Smartphone, Wifi } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { apiRequest } from '../../core/api/client';
import { SyncEngine, SyncHealth, SyncStatus } from '../../core/sync/syncEngine';

interface DeviceSummary { is_online: boolean }

interface SyncHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMainStation: boolean;
}

const statusCopy: Record<SyncStatus, { title: string; text: string; color: string }> = {
  synced: { title: 'All changes are synced', text: 'This device can reach the practice station.', color: '#34d399' },
  syncing: { title: 'Sync in progress', text: 'Checking for updates and sending saved changes.', color: '#fbbf24' },
  offline: { title: 'Waiting for connection', text: 'Your changes are safe here and will sync automatically when the station is reachable.', color: '#fb7185' },
};

const formatTime = (value: Date | null) => {
  if (!value) return 'Not yet';
  return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const SyncHealthModal: React.FC<SyncHealthModalProps> = ({ isOpen, onClose, isMainStation }) => {
  const engine = SyncEngine.getInstance();
  const [health, setHealth] = useState<SyncHealth>(engine.health);
  const [isRunning, setIsRunning] = useState(false);
  const [onlineDevices, setOnlineDevices] = useState<number | null>(null);
  const [totalDevices, setTotalDevices] = useState<number | null>(null);

  const runSync = async () => {
    setIsRunning(true);
    try {
      await engine.syncNow();
    } finally {
      setHealth(engine.health);
      setIsRunning(false);
    }
  };

  useEffect(() => engine.subscribe((_status, _pending, snapshot) => setHealth(snapshot)), [engine]);

  useEffect(() => {
    if (!isOpen) return;
    void runSync();
    if (!isMainStation) return;
    void apiRequest<DeviceSummary[]>('/api/sync/devices/')
      .then((devices) => {
        setTotalDevices(devices.length);
        setOnlineDevices(devices.filter((device) => device.is_online).length);
      })
      .catch(() => {
        setTotalDevices(null);
        setOnlineDevices(null);
      });
  // Opening the panel deliberately triggers exactly one health refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isMainStation]);

  const copy = statusCopy[health.status];
  const StatusIcon = health.status === 'synced' ? CheckCircle2 : health.status === 'offline' ? CloudOff : Loader2;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sync Health" maxWidth="440px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: '14px', background: `${copy.color}14`, border: `1px solid ${copy.color}55` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: copy.color }}>
            <StatusIcon size={22} className={health.status === 'syncing' ? 'sync-spin' : ''} />
            <strong>{copy.title}</strong>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0', fontSize: '0.86rem', lineHeight: 1.45 }}>{copy.text}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: '12px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>Pending changes</div>
            <div style={{ fontWeight: 750, fontSize: '1.35rem', color: health.pendingCount ? '#fbbf24' : '#34d399', marginTop: '4px' }}>{health.pendingCount}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '2px' }}>{health.pendingCount ? 'Safe on this device' : 'Nothing waiting'}</div>
          </div>
          <div className="glass-panel" style={{ padding: '12px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>Last successful sync</div>
            <div style={{ fontWeight: 650, fontSize: '1rem', color: 'var(--text-primary)', marginTop: '8px' }}>{formatTime(health.lastSuccessfulSync)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '5px' }}>Updates check automatically</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Wifi size={15} color={health.apiReachable ? '#34d399' : '#94a3b8'} /> <span>{health.apiReachable ? 'Practice station is reachable' : 'Practice station is not reachable'}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Laptop size={15} color="#fbbf24" /> <span>{isMainStation ? 'This computer is the Main PC station' : `Paired station: ${health.stationUrl}`}</span></div>
          {isMainStation && totalDevices !== null && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Smartphone size={15} color="#38bdf8" /> <span>{onlineDevices} online of {totalDevices} paired sub-systems</span></div>}
          {health.lastResult && <div style={{ color: '#94a3b8', paddingTop: '2px' }}>Latest check: {health.lastResult.uploaded} sent, {health.lastResult.received} updates received.</div>}
        </div>

        <button type="button" onClick={() => void runSync()} disabled={isRunning || health.status === 'syncing'} className="sync-health-action">
          <RefreshCw size={16} className={isRunning || health.status === 'syncing' ? 'sync-spin' : ''} />
          {isRunning || health.status === 'syncing' ? 'Checking sync health…' : health.status === 'offline' ? 'Retry Now' : 'Sync Now'}
        </button>
      </div>
    </Modal>
  );
};
