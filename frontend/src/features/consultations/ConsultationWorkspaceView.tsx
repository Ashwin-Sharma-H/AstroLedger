import React, { useState, useEffect } from 'react';
import { Client, Consultation } from '../../types';
import { apiRequest } from '../../core/api/client';
import { RecordConsultationModal } from './RecordConsultationModal';
import {
  Search,
  User,
  Sparkles,
  History,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  AlertCircle,
  Eye,
  Calendar,
  Clock,
  Printer,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../../components/Badge';

interface ConsultationWorkspaceViewProps {
  clients: Client[];
  initialClient?: Client | null;
  onOpenNewClient: () => void;
  onSubmit: (consultationData: Partial<Consultation>) => Promise<void>;
  onConsultationSaved?: () => void;
}

export const ConsultationWorkspaceView: React.FC<ConsultationWorkspaceViewProps> = ({
  clients,
  initialClient,
  onOpenNewClient,
  onSubmit,
  onConsultationSaved,
}) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(initialClient || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pastConsultations, setPastConsultations] = useState<Consultation[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'dossier' | 'history'>('dossier');

  // Sync initialClient if passed from parent
  useEffect(() => {
    if (initialClient) {
      setSelectedClient(initialClient);
    }
  }, [initialClient]);

  // Fetch client's past consultations
  const fetchConsultations = async (clientId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await apiRequest(`/api/consultations/?client_id=${clientId}`);
      const list: Consultation[] = Array.isArray(res) ? res : res.results || [];
      const sorted = list.sort(
        (a, b) => new Date(b.consultation_date).getTime() - new Date(a.consultation_date).getTime()
      );
      setPastConsultations(sorted);

      // Auto-select latest consultation or keep previously selected if still exists
      if (sorted.length > 0) {
        setSelectedConsultation((prev) => {
          if (prev && sorted.some((c) => c.id === prev.id)) {
            return sorted.find((c) => c.id === prev.id) || sorted[0];
          }
          return sorted[0];
        });
      } else {
        setSelectedConsultation(null);
      }
    } catch (err) {
      console.error('Failed to load past consultations:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!selectedClient?.id) {
      setPastConsultations([]);
      setSelectedConsultation(null);
      return;
    }
    fetchConsultations(selectedClient.id);
  }, [selectedClient?.id]);

  // Manage desktop viewport overflow so only right panel scrolls in Step 2
  useEffect(() => {
    const el = document.querySelector('.content-viewport');
    if (el) {
      if (selectedClient) {
        el.classList.add('consultation-workspace-active');
      } else {
        el.classList.remove('consultation-workspace-active');
      }
    }
    return () => {
      el?.classList.remove('consultation-workspace-active');
    };
  }, [selectedClient]);

  const handleConsultationRecorded = async () => {
    if (selectedClient?.id) {
      await fetchConsultations(selectedClient.id);
    }
    if (onConsultationSaved) {
      onConsultationSaved();
    }
  };

  // Filter clients for Step 1
  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.client_code && c.client_code.toLowerCase().includes(q)) ||
      (c.birth_star && c.birth_star.toLowerCase().includes(q)) ||
      (c.rashi && c.rashi.toLowerCase().includes(q)) ||
      (c.dob && c.dob.includes(q))
    );
  });

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  // -------------------------------------------------------------
  // STEP 1: Search & Select Client Profile
  // -------------------------------------------------------------
  if (!selectedClient) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Step Indicator Header */}
        <div
          className="glass-panel dashboard-hero-banner"
          style={{
            padding: '24px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '3px 8px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                STEP 1 OF 2
              </span>
              <h2 className="dashboard-hero-title" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Select Client Profile
              </h2>
            </div>
            <p className="dashboard-hero-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Select an existing registered client from the astrological registry to initiate a new consultation session.
            </p>
          </div>

          <button
            onClick={onOpenNewClient}
            className="btn btn-secondary dashboard-hero-action"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          >
            <PlusCircle size={16} /> Register New Client
          </button>
        </div>

        {/* Live Search Input Bar */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Search size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, phone number, client code (e.g. AL-), birth star, or month..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '1rem',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="btn-ghost"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Results Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {filteredClients.length} of {clients.length} Registered Clients
          </span>
        </div>

        {filteredClients.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <AlertCircle size={36} color="#fbbf24" style={{ opacity: 0.8 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                No Client Profiles Match Your Search
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Try searching by different terms or register a brand new client profile.
              </div>
            </div>
            <button onClick={onOpenNewClient} className="btn btn-primary" style={{ marginTop: '8px' }}>
              <PlusCircle size={16} /> Register Client Profile
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
              gap: '16px',
            }}
          >
            {filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="glass-panel"
                style={{
                  padding: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {client.name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600, marginTop: '2px' }}>
                      {client.client_code}
                    </div>
                  </div>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {client.gender || 'Client'}
                  </span>
                </div>

                {/* Star & Rashi */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '8px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>STAR (നാൾ)</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fef08a', marginTop: '2px', wordBreak: 'break-word' }}>
                      {client.birth_star || 'Not recorded'}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RASHI / MONTH</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#93c5fd', marginTop: '2px', wordBreak: 'break-word' }}>
                      {client.rashi || 'Not recorded'}
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>📞 {client.phone || 'No phone recorded'}</div>
                  {client.dob && (
                    <div>
                      🎂 {client.dob} {calculateAge(client.dob) !== null && `(${calculateAge(client.dob)} yrs)`}
                    </div>
                  )}
                  {client.birth_place && <div>📍 {client.birth_place}</div>}
                </div>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                  <span
                    style={{
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Select & Start Consultation <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 2: The Two-Pane Consultation History & Dossier Workspace
  // -------------------------------------------------------------
  const selectedVisitIndex = selectedConsultation
    ? pastConsultations.findIndex((c) => c.id === selectedConsultation.id)
    : -1;
  const selectedVisitNumber =
    selectedVisitIndex !== -1 ? pastConsultations.length - selectedVisitIndex : 1;
  return (
    <div className="consultation-workspace-container">
      {/* Active Session Header Banner */}
      <div
        className="glass-panel consultation-session-header"
        style={{
          borderLeft: '4px solid #f59e0b',
        }}
      >
        <div className="consultation-session-main">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', fontSize: '0.8rem' }}
            >
              <ArrowLeft size={15} /> Change Client
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {selectedClient.client_code}
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, letterSpacing: '0.04em' }}>
                CLIENT DOSSIER:
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedClient.name}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-word', lineHeight: 1.4 }}>
              📞 {selectedClient.phone || 'No phone'} • Star: {selectedClient.birth_star || 'Not Specified'} • Rashi: {selectedClient.rashi || 'Not Specified'}
            </div>
          </div>
        </div>

        <div className="consultation-session-actions">
          <button
            type="button"
            onClick={() => setIsRecordModalOpen(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 600 }}
          >
            <PlusCircle size={16} /> Record Consultation
          </button>
        </div>
      </div>

      {/* Mobile View Switcher (Visible on screens <= 768px) */}
      <div className="mobile-consultation-tabs">
        <button
          type="button"
          onClick={() => setMobileTab('dossier')}
          className={`mobile-consultation-tab ${mobileTab === 'dossier' ? 'active' : ''}`}
        >
          <BookOpen size={14} /> Dossier
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('history')}
          className={`mobile-consultation-tab ${mobileTab === 'history' ? 'active' : ''}`}
        >
          <History size={14} /> Visits ({pastConsultations.length}) & Info
        </button>
      </div>

      {/* Main Two-Pane Split Layout */}
      <div className="workspace-split">
        {/* Left Column: Client Identity & Past Consultations List */}
        <div className={`consultation-left-pane ${mobileTab !== 'history' ? 'mobile-hidden' : ''}`}>
          {/* Horoscopic Identity Card */}
          <div
            className="glass-panel"
            style={{
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#fbbf24',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <User size={15} /> Client Astrological Identity
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '8px' }}>
              <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NAKSHATRA (നാൾ)</div>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#fef08a', marginTop: '2px', wordBreak: 'break-word' }}>
                  {selectedClient.birth_star || 'Not Specified'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RASHI / MONTH</div>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#93c5fd', marginTop: '2px', wordBreak: 'break-word' }}>
                  {selectedClient.rashi || 'Not Specified'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                📅 DOB: {selectedClient.dob || 'Unknown'}{' '}
                {selectedClient.dob && calculateAge(selectedClient.dob) !== null && `(${calculateAge(selectedClient.dob)} yrs)`}
              </div>
              {selectedClient.birth_time && <div>⏰ Time: {selectedClient.birth_time}</div>}
              {selectedClient.birth_place && <div>📍 Place: {selectedClient.birth_place}</div>}
            </div>

            {selectedClient.notes && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.06)',
                  borderLeft: '3px solid #f59e0b',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: '#fbbf24' }}>Profile Notes:</strong> {selectedClient.notes}
              </div>
            )}
          </div>

          {/* Past Consultations List */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <History size={16} color="#fbbf24" /> Past Consultations ({pastConsultations.length})
              </div>
              {isLoadingHistory && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading...</span>}
            </div>

            <div
              style={{
                maxHeight: '480px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                paddingRight: '4px',
              }}
            >
              {pastConsultations.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    borderRadius: '8px',
                    border: '1px dashed var(--border-subtle)',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <p>No prior consultations recorded for {selectedClient.name}.</p>
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    <PlusCircle size={14} /> Record First Visit
                  </button>
                </div>
              ) : (
                pastConsultations.map((pc, idx) => {
                  const visitNum = pastConsultations.length - idx;
                  const isSelected = selectedConsultation?.id === pc.id;
                  return (
                    <div
                      key={pc.id}
                      onClick={() => {
                        setSelectedConsultation(pc);
                        setMobileTab('dossier');
                      }}
                      className={`consultation-visit-card ${isSelected ? 'active' : ''}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#fbbf24' : 'var(--text-primary)' }}>
                            Visit #{visitNum}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                              color: isSelected ? '#fef08a' : 'var(--text-secondary)',
                              fontWeight: 500,
                            }}
                          >
                            {pc.consultation_type}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {pc.consultation_date}
                          </span>
                          <Eye size={13} color={isSelected ? '#fbbf24' : 'var(--text-muted)'} />
                        </div>
                      </div>

                      {pc.reason && (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <strong>Inquiry:</strong> {pc.reason}
                        </div>
                      )}

                      {pc.advice && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: isSelected ? '#fef08a' : 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ✨ {pc.advice}
                        </div>
                      )}

                      {pc.follow_up_required && (
                        <div style={{ fontSize: '0.72rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ⏰ Follow-up: {pc.follow_up_date || 'Scheduled'}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Full Selected Consultation History & Dossier */}
        <div className={`consultation-right-pane ${mobileTab !== 'dossier' ? 'mobile-hidden' : ''}`}>
          {selectedConsultation ? (
            <div className="glass-panel consultation-detail-panel" style={{ borderRadius: 'var(--radius-lg)' }}>
              {/* Dossier Header Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '14px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Visit #{selectedVisitNumber}: {selectedConsultation.consultation_type}
                    </span>
                    <Badge variant="gold">{selectedConsultation.consultation_type}</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.825rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={14} color="#38bdf8" /> {selectedConsultation.consultation_date}
                    </span>
                    {selectedConsultation.consultation_time && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} color="#fbbf24" /> {selectedConsultation.consultation_time}
                      </span>
                    )}
                    {selectedConsultation.follow_up_required ? (
                      <Badge variant="mystic">Follow-up: {selectedConsultation.follow_up_date || 'Scheduled'}</Badge>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>• No follow-up scheduled</span>
                    )}
                  </div>
                </div>

                <div className="consultation-detail-header-actions">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-ghost"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                  >
                    <Printer size={15} /> Print Dossier
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                  >
                    <PlusCircle size={15} /> New Visit
                  </button>
                </div>
              </div>

              {/* Section 1: Client Inquiry / Reason */}
              <div className="consultation-section-card">
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: '#fbbf24',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sparkles size={16} /> Client Inquiry & Consultation Purpose (സന്ദർശന ഉദ്ദേശം)
                </div>
                <div style={{ fontSize: '0.925rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {selectedConsultation.reason || 'No specific initial inquiry recorded for this visit.'}
                </div>
              </div>

              {/* Section 2: Detailed Planetary Observations */}
              <div className="consultation-section-card">
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: '#93c5fd',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <BookOpen size={16} /> Astrological Observations & Planetary Analysis (ഗ്രഹ നില & ദശാഫലം)
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {selectedConsultation.discussion || 'No specific planetary analysis noted during this consultation.'}
                </div>
              </div>

              {/* Section 3: Prescribed Remedies & Guidance */}
              <div className="consultation-remedy-highlight">
                <div
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#fbbf24',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ShieldCheck size={18} /> Prescribed Remedies & Advice (പരിഹാര നിർദ്ദേശങ്ങൾ & ഉപദേശങ്ങൾ)
                </div>
                <div
                  style={{
                    fontSize: '0.925rem',
                    color: '#fef08a',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '16px 18px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  {selectedConsultation.advice || 'No specific remedies or pariharams recorded for this session.'}
                </div>
              </div>

              {/* Section 4: Follow-up Status */}
              {selectedConsultation.follow_up_required ? (
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontWeight: 600, fontSize: '0.875rem' }}>
                    <Clock size={16} /> Follow-up Consultation Scheduled
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Scheduled Date:</strong> {selectedConsultation.follow_up_date || 'Date not specified'}
                  </div>
                  {selectedConsultation.follow_up_notes && (
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      <strong>Instructions:</strong> {selectedConsultation.follow_up_notes}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                  ℹ️ No follow-up visit was required or scheduled for this consultation session.
                </div>
              )}
            </div>
          ) : (
            /* Empty State: No Consultation Selected */
            <div
              className="glass-panel"
              style={{
                padding: '60px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <Sparkles size={44} color="#fbbf24" style={{ opacity: 0.85 }} />
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  No Consultations Recorded Yet
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '440px' }}>
                  This client has no previous consultation records in their astrological file. Click below to document their first consultation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(true)}
                className="btn btn-primary"
                style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <PlusCircle size={16} /> Record First Consultation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up Record Consultation Modal */}
      {selectedClient && (
        <RecordConsultationModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          client={selectedClient}
          onSubmit={onSubmit}
          onSuccess={handleConsultationRecorded}
        />
      )}
    </div>
  );
};
