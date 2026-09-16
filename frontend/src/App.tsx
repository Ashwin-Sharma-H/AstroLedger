import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './features/dashboard/DashboardView';
import { ClientListView } from './features/clients/ClientListView';
import { NewClientModal } from './features/clients/NewClientModal';
import { ClientDetailModal } from './features/clients/ClientDetailModal';
import { EditClientModal } from './features/clients/EditClientModal';
import { ConsultationWorkspaceView } from './features/consultations/ConsultationWorkspaceView';
import { AdvancedSearchModal } from './features/search/AdvancedSearchModal';
import { LoginModal } from './features/auth/LoginModal';
import { ProfileSettingsModal } from './features/auth/ProfileSettingsModal';
import { DeviceManagerModal } from './features/devices/DeviceManagerModal';
import { MobilePairingView } from './features/devices/MobilePairingView';
import { apiRequest, getAccessToken, clearTokens, toggleFollowUp } from './core/api/client';
import { SyncEngine } from './core/sync/syncEngine';
import { isCompanionDevice } from './core/platform';
import { clearOfflineData } from './core/storage/indexedDB';
import { Client, Consultation, DashboardData, User } from './types';

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getAccessToken());
  const [showCompanionLoggedOutNotice, setShowCompanionLoggedOutNotice] = useState(false);
  const isCompanion = isCompanionDevice();

  // Modal states
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);

  // Selected records for inspection
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [consultationTargetClient, setConsultationTargetClient] = useState<Client | null>(null);
  const [isClientDetailOpen, setIsClientDetailOpen] = useState(false);

  // Start sync when a Main-PC session or a companion pairing supplies tokens.
  useEffect(() => {
    const syncEngine = SyncEngine.getInstance();
    if (isAuthenticated) {
      syncEngine.start();
    }
  }, [isAuthenticated]);

  // Only an explicit Main-PC revocation triggers this reset. Network loss is
  // handled inside SyncEngine as an offline/retry state instead.
  useEffect(() => {
    const handleRevocation = () => {
      if (!isCompanion) return;
      SyncEngine.getInstance().disconnect();
      queryClient.clear();
      void clearOfflineData();
      setIsAuthenticated(false);
      setShowCompanionLoggedOutNotice(true);
      setCurrentTab('dashboard');
    };
    window.addEventListener('astroledger-device-revoked', handleRevocation);
    return () => window.removeEventListener('astroledger-device-revoked', handleRevocation);
  }, [isCompanion, queryClient]);

  // Global keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsAdvancedSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Queries
  const { data: currentUser, refetch: refetchCurrentUser } = useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: () => apiRequest('/api/auth/me/'),
    enabled: isAuthenticated,
  });

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest('/api/dashboard/'),
    enabled: isAuthenticated,
  });

  const { data: clientsData = [], isLoading: isClientsLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await apiRequest('/api/clients/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: isAuthenticated,
  });

  const { data: consultationsData = [] } = useQuery<Consultation[]>({
    queryKey: ['consultations', selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await apiRequest(`/api/consultations/?client_id=${selectedClient.id}`);
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: isAuthenticated && !!selectedClient,
  });

  // Client creation mutation
  const createClientMutation = useMutation({
    mutationFn: (newClient: Partial<Client>) =>
      apiRequest('/api/clients/', {
        method: 'POST',
        body: JSON.stringify(newClient),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
  });

  // Client update mutation
  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      apiRequest(`/api/clients/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (updatedClient) => {
      setSelectedClient(updatedClient);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
  });

  // Client delete mutation (soft delete)
  const deleteClientMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/clients/${id}/`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setSelectedClient(null);
      setIsClientDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
  });

  // Consultation creation mutation
  const createConsultationMutation = useMutation({
    mutationFn: (newConsultation: Partial<Consultation>) =>
      apiRequest('/api/consultations/', {
        method: 'POST',
        body: JSON.stringify(newConsultation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
  });

  // Follow-up toggle mutation
  const toggleFollowUpMutation = useMutation({
    mutationFn: (consultationId: string) => toggleFollowUp(consultationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
  });

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setIsClientDetailOpen(true);
  };

  const handleLogout = () => {
    clearTokens();
    setIsAuthenticated(false);
    setIsLoginOpen(true);
  };



  if (isCompanion && !isAuthenticated) {
    return <MobilePairingView
      showLoggedOutNotice={showCompanionLoggedOutNotice}
      onContinueAfterLogout={() => setShowCompanionLoggedOutNotice(false)}
      onPairedSuccess={() => {
        setShowCompanionLoggedOutNotice(false);
        setIsAuthenticated(true);
        queryClient.invalidateQueries();
      }}
    />;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'consultations') {
            setConsultationTargetClient(null);
          }
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onOpenProfileSettings={() => setIsProfileSettingsOpen(true)}
        onOpenDeviceManager={isCompanion ? undefined : () => setIsDeviceManagerOpen(true)}
        onLogout={isAuthenticated ? handleLogout : () => setIsLoginOpen(true)}
      />

      {/* Main Viewport */}
      <div className="main-content">
        <Header
          title={
            currentTab === 'dashboard'
              ? 'Clinic Overview'
              : currentTab === 'clients'
              ? 'Client Directory'
              : currentTab === 'consultations'
              ? 'Consultation Workspace'
              : 'Follow-up Schedule'
          }
          currentUser={currentUser}
          onOpenProfileSettings={() => setIsProfileSettingsOpen(true)}
          onOpenDeviceManager={isCompanion ? undefined : () => setIsDeviceManagerOpen(true)}
        />
        <main className="content-viewport">
          {currentTab === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              isLoading={isDashboardLoading}
              onSelectClient={handleSelectClient}
              onSelectConsultation={(_c) => {}}
              onOpenNewClient={() => setIsNewClientOpen(true)}
            />
          )}

          {currentTab === 'clients' && (
            <ClientListView
              clients={clientsData}
              isLoading={isClientsLoading}
              onSelectClient={handleSelectClient}
              onOpenNewClient={() => setIsNewClientOpen(true)}
              onOpenAdvancedSearch={() => setIsAdvancedSearchOpen(true)}
            />
          )}

          {currentTab === 'consultations' && (
            <ConsultationWorkspaceView
              clients={clientsData}
              initialClient={consultationTargetClient}
              onOpenNewClient={() => setIsNewClientOpen(true)}
              onSubmit={async (data) => {
                await createConsultationMutation.mutateAsync(data);
              }}
              onConsultationSaved={() => {
                queryClient.invalidateQueries({ queryKey: ['consultations'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard'] });
              }}
            />
          )}

          {currentTab === 'followups' && (
            <div className="glass-panel" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>
                Pending Follow-up Schedule
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Active follow-ups scheduled during client consultations appear here for ongoing astrological monitoring.
              </p>
            </div>
          )}
        </main>

        {/* Dedicated Mobile Bottom Tab Bar */}
        <MobileBottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'consultations') {
              setConsultationTargetClient(null);
            }
            setCurrentTab(tab);
          }}
        />
      </div>

      {/* Modals */}
      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        onSubmit={async (data) => {
          await createClientMutation.mutateAsync(data);
        }}
        existingClients={clientsData}
        onSelectExistingClient={(client) => {
          setSelectedClient(client);
          setIsClientDetailOpen(true);
        }}
      />

      <ClientDetailModal
        client={selectedClient}
        consultations={consultationsData}
        isOpen={isClientDetailOpen}
        onClose={() => setIsClientDetailOpen(false)}
        onOpenNewConsultation={(client) => {
          setConsultationTargetClient(client);
          setCurrentTab('consultations');
          setIsClientDetailOpen(false);
        }}
        onOpenEditClient={(client) => {
          setSelectedClient(client);
          setIsEditClientOpen(true);
        }}
        onToggleFollowUp={async (id) => {
          await toggleFollowUpMutation.mutateAsync(id);
        }}
      />

      <EditClientModal
        isOpen={isEditClientOpen}
        onClose={() => setIsEditClientOpen(false)}
        client={selectedClient}
        onSave={async (id, data) => {
          await updateClientMutation.mutateAsync({ id, data });
        }}
        onDelete={async (id) => {
          await deleteClientMutation.mutateAsync(id);
        }}
      />

      <AdvancedSearchModal
        isOpen={isAdvancedSearchOpen}
        onClose={() => setIsAdvancedSearchOpen(false)}
        clients={clientsData}
        onSelectClient={handleSelectClient}
      />

      <LoginModal
        isOpen={isLoginOpen || !isAuthenticated}
        showCloseButton={isAuthenticated}
        onClose={() => {
          setIsLoginOpen(false);
        }}
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          queryClient.invalidateQueries();
        }}
      />

      <ProfileSettingsModal
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
        currentUser={currentUser || null}
        onProfileUpdated={() => {
          refetchCurrentUser();
        }}
        onLogout={handleLogout}
      />

      {!isCompanion && (
        <DeviceManagerModal
          isOpen={isDeviceManagerOpen}
          onClose={() => setIsDeviceManagerOpen(false)}
        />
      )}
    </div>
  );
};
