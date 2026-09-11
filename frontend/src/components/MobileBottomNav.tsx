import React from 'react';
import { LayoutDashboard, Users, CalendarCheck, Clock } from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'consultations', label: 'Consult', icon: CalendarCheck },
    { id: 'followups', label: 'Follow-ups', icon: Clock },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
          >
            <div className="mobile-nav-icon-wrapper">
              <Icon size={20} color={isActive ? '#f59e0b' : '#94a3b8'} />
            </div>
            <span className="mobile-nav-label">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
