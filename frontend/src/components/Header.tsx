import React, { useEffect, useState } from 'react';
import { UserCircle2, Cloud, CloudOff, Loader2, QrCode } from 'lucide-react';

import { User } from '../types';
import { SyncEngine, SyncStatus } from '../core/sync/syncEngine';

interface HeaderProps {
  title: string;
  currentUser?: User | null;
  onOpenQuickSearch?: () => void;
  onOpenNewConsultation?: () => void;
  onOpenProfileSettings?: () => void;
  onOpenDeviceManager?: () => void;
}

const syncStatusConfig: Record<SyncStatus, {
  icon: React.ReactNode;
  label: string;
  bg: string;
  border: string;
  color: string;
  dotColor: string;
}> = {
  synced: {
    icon: <Cloud size={13} />,
    label: 'Cloud Synced',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    color: '#10b981',
    dotColor: '#10b981',
  },
  syncing: {
    icon: <Loader2 size={13} className="sync-spin" />,
    label: 'Syncing...',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
    color: '#f59e0b',
    dotColor: '#f59e0b',
  },
  offline: {
    icon: <CloudOff size={13} />,
    label: 'Offline',
    bg: 'rgba(244, 63, 94, 0.08)',
    border: 'rgba(244, 63, 94, 0.25)',
    color: '#f43f5e',
    dotColor: '#f43f5e',
  },
};

export const Header: React.FC<HeaderProps> = ({
  title,
  currentUser,
  onOpenNewConsultation,
  onOpenProfileSettings,
  onOpenDeviceManager,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const engine = SyncEngine.getInstance();
    const unsub = engine.subscribe((status, pending) => {
      setSyncStatus(status);
      setPendingCount(pending);
    });
    return unsub;
  }, []);

  const cfg = syncStatusConfig[syncStatus];

  const handleSyncClick = () => {
    if (syncStatus === 'offline') {
      const engine = SyncEngine.getInstance();
      engine.flushQueue();
      engine.connectWebSocket();
    }
  };

  return (
    <header className="topbar">
      {/* Title */}
      <div>
        <h2 className="topbar-title" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{title}</h2>
      </div>

      {/* Right Controls */}
      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Sync Status Pill */}
        <div
          onClick={handleSyncClick}
          className="topbar-sync-pill"
          title={
            syncStatus === 'offline' && pendingCount > 0
              ? `Click to retry sync — ${pendingCount} pending`
              : cfg.label
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: cfg.bg,
            borderRadius: '9999px',
            border: `1px solid ${cfg.border}`,
            cursor: syncStatus === 'offline' ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: cfg.color,
            userSelect: 'none',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: cfg.dotColor,
              display: 'inline-block',
              animation: syncStatus === 'syncing' ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          {cfg.icon}
          <span className="topbar-text-label">
            {cfg.label}
            {syncStatus === 'offline' && pendingCount > 0 && ` • ${pendingCount}`}
          </span>
        </div>

        {/* Pair Devices Button */}
        {onOpenDeviceManager && (
          <button
            type="button"
            onClick={onOpenDeviceManager}
            className="topbar-pair-btn"
            title="Manage connected phones, tablets & scan QR"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 500,
              borderRadius: '9999px',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              background: 'rgba(245, 158, 11, 0.08)',
              color: '#f59e0b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <QrCode size={14} />
            <span className="topbar-text-label">Pair</span>
          </button>
        )}


        <div
          onClick={onOpenProfileSettings}
          className="topbar-profile-btn"
          title="Click to view & edit Astrologer Profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 10px',
            background: 'rgba(245, 158, 11, 0.08)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            cursor: onOpenProfileSettings ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          <UserCircle2 size={18} color="#f59e0b" />
          <div className="topbar-profile-text" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {currentUser?.name || 'Astrologer'}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#fbbf24', lineHeight: 1.1 }}>
              {currentUser?.title || 'Desk'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
