import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Clock,
  Wifi,
  LogOut,
  UserCircle2,
  QrCode,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser?: User | null;
  onOpenProfileSettings?: () => void;
  onOpenDeviceManager?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onOpenProfileSettings,
  onOpenDeviceManager,
  onLogout,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('astro_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('astro_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients & Horoscopes', icon: Users },
    { id: 'consultations', label: 'Consultations', icon: CalendarCheck },
    { id: 'followups', label: 'Follow-ups', icon: Clock },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div
        style={{
          padding: isCollapsed ? '16px 0' : '18px 16px',
          display: 'flex',
          flexDirection: isCollapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: isCollapsed ? '10px' : '10px',
          borderBottom: '1px solid var(--border-subtle)',
          minHeight: '73px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div
            onClick={isCollapsed ? toggleCollapse : undefined}
            title={isCollapsed ? 'Click to expand sidebar (Ctrl+B)' : 'AstroLedger'}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#ffffff',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
              flexShrink: 0,
              cursor: isCollapsed ? 'pointer' : 'default',
              overflow: 'hidden',
            }}
          >
            <img
              src="/logo.png"
              alt="AstroLedger"
              onError={(e) => {
                // Fallback to sparkles if logo not yet created
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) parent.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                AstroLedger
              </h1>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Client & Consultation Suite
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleCollapse}
          className="sidebar-collapse-btn"
          title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          flex: 1,
          padding: isCollapsed ? '16px 8px' : '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: isCollapsed ? '11px 0' : '11px 14px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                color: isActive ? 'var(--accent-gold-light)' : 'var(--text-secondary)',
                border: isActive ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                fontSize: '0.9rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                width: '100%',
                position: 'relative',
              }}
            >
              <Icon size={isCollapsed ? 20 : 18} color={isActive ? '#fbbf24' : '#94a3b8'} style={{ flexShrink: 0 }} />
              {!isCollapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile & Status */}
      <div
        style={{
          padding: isCollapsed ? '14px 8px' : '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCollapsed ? 'center' : 'stretch',
          gap: '12px',
          background: 'rgba(7, 9, 14, 0.5)',
        }}
      >
        {/* Astrologer Profile Card */}
        <div
          onClick={onOpenProfileSettings}
          title={currentUser?.name ? `${currentUser.name} (${currentUser.title || 'Astrologer'}) - Settings` : 'Profile Settings'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '10px',
            padding: isCollapsed ? '8px 0' : '8px 12px',
            background: 'rgba(245, 158, 11, 0.08)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(245, 158, 11, 0.22)',
            cursor: onOpenProfileSettings ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
            width: '100%',
          }}
        >
          <UserCircle2 size={isCollapsed ? 24 : 24} color="#f59e0b" style={{ flexShrink: 0 }} />
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden' }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {currentUser?.name || 'Astrologer'}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#fbbf24', lineHeight: 1.1 }}>
                {currentUser?.title || 'Vedic Astrologer'}
              </span>
            </div>
          )}
        </div>

        {/* Pair Mobile Button */}
        {onOpenDeviceManager && (
          <button
            type="button"
            onClick={onOpenDeviceManager}
            title="Pair Mobile Phone / iPad via QR Code"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              padding: isCollapsed ? '8px 0' : '8px 12px',
              background: 'rgba(245, 158, 11, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <QrCode size={isCollapsed ? 18 : 15} color="#f59e0b" />
              {!isCollapsed && <span>Pair Mobile / Devices</span>}
            </div>
            {!isCollapsed && (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  fontWeight: 700,
                }}
              >
                QR
              </span>
            )}
          </button>
        )}

        {/* Cloud Sync Status */}
        <div
          title="Cloud Synced"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#34d399',
                boxShadow: '0 0 8px #34d399',
                flexShrink: 0,
              }}
            />
            {!isCollapsed && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Cloud Synced
              </span>
            )}
          </div>
          {!isCollapsed && <Wifi size={14} color="#34d399" />}
        </div>

        {/* Sign Out */}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Sign Out"
            className="btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              padding: '6px 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              width: '100%',
            }}
          >
            <LogOut size={isCollapsed ? 16 : 14} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
