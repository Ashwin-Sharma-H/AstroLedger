import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../components/Modal';
import { Client, Consultation } from '../../types';
import { Badge } from '../../components/Badge';
import {
  PlusCircle,
  Calendar,
  Phone,
  MapPin,
  Sparkles,
  Clock,
  Edit,
  FileText,
  User,
  Search,
  Printer,
  AlertCircle,
} from 'lucide-react';

interface ClientDetailModalProps {
  client: Client | null;
  consultations: Consultation[];
  isOpen: boolean;
  onClose: () => void;
  onOpenNewConsultation: (client: Client) => void;
  onOpenEditClient?: (client: Client) => void;
  onToggleFollowUp?: (consultationId: string) => Promise<void>;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  consultations,
  isOpen,
  onClose,
  onOpenNewConsultation,
  onOpenEditClient,
  onToggleFollowUp,
}) => {
  if (!client) return null;

  const [timelineSearch, setTimelineSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [followUpFilter, setFollowUpFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  // Milestone Stats
  const firstVisitDate =
    client.first_consultation_date ||
    (consultations.length > 0 ? consultations[consultations.length - 1].consultation_date : null);
  const lastVisitDate =
    client.last_consultation_date ||
    (consultations.length > 0 ? consultations[0].consultation_date : null);
  const pendingFollowUps = useMemo(
    () => consultations.filter((c) => c.follow_up_required && !c.follow_up_completed),
    [consultations]
  );

  // Filtered consultations
  const filteredConsultations = useMemo(() => {
    return consultations.filter((c) => {
      // 1. Text search across notes, discussion, advice, reason
      if (timelineSearch.trim()) {
        const q = timelineSearch.toLowerCase().trim();
        const textToMatch = `${c.reason || ''} ${c.discussion || ''} ${c.advice || ''} ${c.summary || ''} ${c.follow_up_notes || ''} ${c.consultation_type || ''}`.toLowerCase();
        if (!textToMatch.includes(q)) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'ALL' && c.consultation_type !== selectedCategory) {
        return false;
      }

      // 3. Follow-up filter
      if (followUpFilter === 'PENDING') {
        if (!c.follow_up_required || c.follow_up_completed) return false;
      } else if (followUpFilter === 'COMPLETED') {
        if (!c.follow_up_required || !c.follow_up_completed) return false;
      }

      return true;
    });
  }, [consultations, timelineSearch, selectedCategory, followUpFilter]);

  const handlePrintDossier = () => {
    window.print();
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Client Horoscopic Dossier — ${client.name} (${client.client_code})`}
      size="workspace"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="modal-footer-hint" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Registered on {new Date(client.created_at).toLocaleDateString()} • Revision v{client.version}
            </span>
            <button
              type="button"
              onClick={handlePrintDossier}
              className="btn btn-ghost"
              style={{
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Printer size={14} /> Print Dossier Summary
            </button>
          </div>
          <div className="modal-footer-actions">
            <button onClick={onClose} className="btn btn-ghost">
              Close
            </button>
            {onOpenEditClient && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEditClient(client);
                }}
                className="btn btn-secondary"
              >
                <Edit size={16} />
                Edit Profile
              </button>
            )}
            <button
              onClick={() => {
                onClose();
                onOpenNewConsultation(client);
              }}
              className="btn btn-primary"
            >
              <PlusCircle size={16} />
              Record Consultation
            </button>
          </div>
        </div>
      }
    >
      <div className="workspace-split">
        {/* Left Panel: Client Master Profile & Coordinates */}
        <div className="workspace-panel">
          <div className="workspace-section-title">
            <User size={16} color="#fbbf24" /> Client Astrological Identity
          </div>

          {/* Quick Header */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {client.name}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#fbbf24', marginTop: '2px', fontWeight: 600 }}>
                {client.client_code}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              <Badge variant="gold">{client.gender || 'Client'}</Badge>
              <Badge variant="emerald">{consultations.length} Total Visits</Badge>
            </div>
          </div>

          {/* Contact Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Contact Details
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="#f59e0b" />
                <span>{client.phone || 'Primary phone not recorded'}</span>
              </div>
              {client.alternate_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Phone size={14} color="#10b981" />
                  <span>WhatsApp/Alt: {client.alternate_phone}</span>
                </div>
              )}
              {client.email && (
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginLeft: '22px' }}>
                  {client.email}
                </div>
              )}
              {client.address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.825rem' }}>
                  <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{client.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Jyotish Coordinates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
              Birth & Jyotish Coordinates (ജ്യോതിഷ വിവരങ്ങൾ)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '8px' }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NAKSHATRA (നാൾ)</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fef08a', marginTop: '3px', wordBreak: 'break-word' }}>
                  {client.birth_star || 'Not Specified'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RASHI / MONTH (രാശി)</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#93c5fd', marginTop: '3px', wordBreak: 'break-word' }}>
                  {client.rashi || 'Not Specified'}
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={14} color="#38bdf8" />
                <span>
                  {client.dob || 'DOB unknown'}{' '}
                  {client.dob && calculateAge(client.dob) !== null && `(${calculateAge(client.dob)} years old)`}
                </span>
              </div>
              {client.birth_time && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '22px', color: 'var(--text-secondary)' }}>
                  <Clock size={13} />
                  <span>Time: {client.birth_time}</span>
                </div>
              )}
              {client.birth_place && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '22px', color: 'var(--text-secondary)' }}>
                  <MapPin size={13} />
                  <span>Place: {client.birth_place}</span>
                </div>
              )}
            </div>
          </div>

          {/* Astrologer Permanent Notes */}
          {client.notes && (
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                Astrologer Dossier Notes
              </span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                {client.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right Panel: Chronological Consultation Journey */}
        <div className="workspace-panel">
          <div className="workspace-section-title" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="#fbbf24" /> Chronological Consultation Journey ({consultations.length} Visits)
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              Immutable Historical Log
            </span>
          </div>

          {/* Astrological Journey Milestone Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Visits
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>
                {consultations.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                First Consultation
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {firstVisitDate || 'First Visit'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Latest Visit
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#93c5fd', marginTop: '2px' }}>
                {lastVisitDate || 'None'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Pending Follow-ups
              </div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: pendingFollowUps.length > 0 ? '#f87171' : '#34d399',
                  marginTop: '2px',
                }}
              >
                {pendingFollowUps.length}
              </div>
            </div>
          </div>

          {/* Timeline Full-Text Search & Filter Toolbar */}
          {consultations.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search
                  size={15}
                  color="#fbbf24"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  placeholder="Search remedies, discussions, observations..."
                  className="input-control"
                  style={{
                    paddingLeft: '32px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-control"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Categories</option>
                <option value="General Horoscope">General Horoscope</option>
                <option value="Kundali Matching">Porutham / Matching</option>
                <option value="Career & Business">Career & Business</option>
                <option value="Health & Longevity">Health & Longevity</option>
                <option value="Prashnam">Prashnam (Horary)</option>
                <option value="Muhurtham">Muhurtham</option>
                <option value="Pariharam & Remedies">Pariharam & Remedies</option>
              </select>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setFollowUpFilter('ALL')}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.75rem',
                    background: followUpFilter === 'ALL' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpFilter('PENDING')}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.75rem',
                    color: followUpFilter === 'PENDING' ? '#fca5a5' : 'var(--text-muted)',
                    background: followUpFilter === 'PENDING' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  }}
                >
                  Pending ({pendingFollowUps.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpFilter('COMPLETED')}
                  className="btn btn-ghost"
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.75rem',
                    color: followUpFilter === 'COMPLETED' ? '#86efac' : 'var(--text-muted)',
                    background: followUpFilter === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                  }}
                >
                  Completed
                </button>
              </div>
            </div>
          )}

          {consultations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Sparkles size={32} color="#fbbf24" style={{ opacity: 0.7 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  No Consultations Recorded Yet
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  Record the initial horoscope reading or astrological analysis for this client.
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenNewConsultation(client);
                }}
                className="btn btn-primary"
                style={{ marginTop: '8px' }}
              >
                <PlusCircle size={16} />
                Record First Consultation
              </button>
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                borderRadius: '10px',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <AlertCircle size={28} color="#fbbf24" />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  No consultations match your filters
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                  Try adjusting the text search or category filter.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTimelineSearch('');
                  setSelectedCategory('ALL');
                  setFollowUpFilter('ALL');
                }}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem' }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '68vh', overflowY: 'auto', paddingRight: '6px' }}>
              {filteredConsultations.map((c) => {
                const visitNumber = consultations.length - consultations.findIndex((x) => x.id === c.id);
                return (
                <div
                  key={c.id}
                  className="glass-panel"
                  style={{
                    padding: '18px 20px',
                    borderLeft: '4px solid #f59e0b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.025rem', color: 'var(--text-primary)' }}>
                          Visit #{visitNumber}: {c.consultation_type}
                        </span>
                        <Badge variant="subtle">
                          <Calendar size={12} /> {c.consultation_date} {c.consultation_time && `@ ${c.consultation_time}`}
                        </Badge>
                      </div>
                      {c.reason && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          <strong>Inquiry:</strong> {c.reason}
                        </div>
                      )}
                    </div>

                    {c.follow_up_required && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onToggleFollowUp?.(c.id);
                        }}
                        style={{
                          background: c.follow_up_completed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          border: c.follow_up_completed ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                          color: c.follow_up_completed ? '#34d399' : '#fbbf24',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          transition: 'all 0.15s ease',
                        }}
                        title="Click to toggle follow-up status"
                      >
                        <Clock size={12} />
                        {c.follow_up_completed ? '✓ Follow-up Done' : `Follow-up: ${c.follow_up_date || 'Scheduled'}`}
                      </button>
                    )}
                  </div>

                  {c.discussion && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Astrological Analysis & Observations:</strong>
                      <p style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{c.discussion}</p>
                    </div>
                  )}

                  {c.advice && (
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Prescribed Remedies & Advice:</strong>
                      <p style={{ marginTop: '4px', whiteSpace: 'pre-wrap', color: '#fef08a' }}>{c.advice}</p>
                    </div>
                  )}

                  {c.summary && (
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      <strong>Summary:</strong> {c.summary}
                    </div>
                  )}

                  {c.follow_up_notes && (
                    <div style={{ fontSize: '0.8rem', color: '#60a5fa' }}>
                      📌 Follow-up note: {c.follow_up_notes}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>
    </Modal>

    {/* Dedicated Printable Astrological Dossier Portal (Clean Letterhead A4 Document) */}
    {isOpen &&
      createPortal(
        <div className="printable-dossier-root">
          {/* Header Letterhead */}
          <div className="print-header">
            <div className="print-header-top">
              <div>
                <h1 className="print-title">ASTROLEDGER</h1>
                <div className="print-subtitle">Horoscopic Dossier & Astrological Consultation Record</div>
                <div className="print-malayalam-subtitle">ജ്യോതിഷ കാര്യാലയം • ജാതക രേഖ</div>
              </div>
              <div className="print-meta-box">
                <div><strong>Client Code:</strong> {client.client_code}</div>
                <div><strong>Registered:</strong> {new Date(client.created_at).toLocaleDateString()}</div>
                <div><strong>Document Printed:</strong> {new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* Profile & Horoscopic Coordinates Grid */}
          <div className="print-section print-page-break-inside-avoid">
            <div className="print-grid-2col">
              {/* Box 1: Native Demographics */}
              <div className="print-box">
                <div className="print-box-title">NATIVE PROFILE (വ്യക്തിഗത വിവരങ്ങൾ)</div>
                <table className="print-table">
                  <tbody>
                    <tr>
                      <td><strong>Full Name:</strong></td>
                      <td style={{ fontSize: '10.5pt', fontWeight: 'bold' }}>{client.name}</td>
                    </tr>
                    <tr>
                      <td><strong>Gender:</strong></td>
                      <td>{client.gender || 'Not recorded'}</td>
                    </tr>
                    <tr>
                      <td><strong>Primary Phone:</strong></td>
                      <td>{client.phone || 'Not recorded'}</td>
                    </tr>
                    {client.alternate_phone && (
                      <tr>
                        <td><strong>Alt / WhatsApp:</strong></td>
                        <td>{client.alternate_phone}</td>
                      </tr>
                    )}
                    {client.email && (
                      <tr>
                        <td><strong>Email:</strong></td>
                        <td>{client.email}</td>
                      </tr>
                    )}
                    {client.address && (
                      <tr>
                        <td><strong>Address:</strong></td>
                        <td>{client.address}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Box 2: Horoscopic Coordinates */}
              <div className="print-box">
                <div className="print-box-title">HOROSCOPIC COORDINATES (ജ്യോതിഷ വിവരങ്ങൾ)</div>
                <table className="print-table">
                  <tbody>
                    <tr>
                      <td><strong>Nakshatra (നാൾ):</strong></td>
                      <td style={{ fontSize: '10.5pt', fontWeight: 'bold', color: '#92400e' }}>
                        {client.birth_star || 'Not recorded'}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Rashi (രാശി):</strong></td>
                      <td style={{ fontSize: '10pt', fontWeight: 'bold' }}>
                        {client.rashi || 'Not recorded'}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Date of Birth:</strong></td>
                      <td>
                        {client.dob || 'Not recorded'} {client.dob && calculateAge(client.dob) !== null && `(${calculateAge(client.dob)} yrs)`}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Time of Birth:</strong></td>
                      <td>{client.birth_time || 'Not recorded'}</td>
                    </tr>
                    <tr>
                      <td><strong>Place of Birth:</strong></td>
                      <td>{client.birth_place || 'Not recorded'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {client.notes && (
              <div className="print-notes-box">
                <strong>Astrological Notes / പ്രത്യേക നിരീക്ഷണങ്ങൾ:</strong>
                <p style={{ margin: '3px 0 0 0', whiteSpace: 'pre-wrap' }}>{client.notes}</p>
              </div>
            )}
          </div>

          {/* Milestones Banner */}
          <div className="print-milestones-banner print-page-break-inside-avoid">
            <div className="print-milestone-item">
              <span className="print-milestone-label">TOTAL VISITS</span>
              <span className="print-milestone-val">{consultations.length}</span>
            </div>
            <div className="print-milestone-item">
              <span className="print-milestone-label">FIRST CONSULTATION</span>
              <span className="print-milestone-val">{firstVisitDate || 'None'}</span>
            </div>
            <div className="print-milestone-item">
              <span className="print-milestone-label">LATEST VISIT</span>
              <span className="print-milestone-val">{lastVisitDate || 'None'}</span>
            </div>
            <div className="print-milestone-item">
              <span className="print-milestone-label">ACTIVE FOLLOW-UPS</span>
              <span className="print-milestone-val">{pendingFollowUps.length} Pending</span>
            </div>
          </div>

          {/* Chronological Consultations List */}
          <div className="print-section">
            <div className="print-section-header">CONSULTATION & REMEDY HISTORY (സന്ദർശന ചരിത്രം)</div>
            {consultations.length === 0 ? (
              <div className="print-empty-msg">No consultations recorded yet for this client.</div>
            ) : (
              consultations.map((c, idx) => {
                const visitNumber = consultations.length - idx;
                return (
                  <div key={c.id} className="print-consultation-card print-page-break-inside-avoid">
                    <div className="print-consultation-header">
                      <span className="print-consultation-title">
                        Visit #{visitNumber}: {c.consultation_type}
                      </span>
                      <span className="print-consultation-date">
                        {c.consultation_date} {c.consultation_time && `@ ${c.consultation_time}`}
                      </span>
                    </div>

                    {c.reason && (
                      <div className="print-field">
                        <strong>Reason for Inquiry:</strong> {c.reason}
                      </div>
                    )}

                    {c.discussion && (
                      <div className="print-field">
                        <strong>Astrological Observations:</strong>
                        <p className="print-pre">{c.discussion}</p>
                      </div>
                    )}

                    {c.advice && (
                      <div className="print-advice-box">
                        <strong>Prescribed Remedies & Advice (പരിഹാരങ്ങൾ):</strong>
                        <p className="print-pre">{c.advice}</p>
                      </div>
                    )}

                    {c.follow_up_required && (
                      <div className="print-followup-box">
                        <strong>Follow-up Scheduled:</strong> {c.follow_up_date || 'Required'} {c.follow_up_completed ? '✓ (Completed)' : '⏳ (Pending)'}
                        {c.follow_up_notes && <span> — {c.follow_up_notes}</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Print Footer */}
          <div className="print-footer">
            <div>AstroLedger • Confidential Astrological Record System</div>
            <div>Revision v{client.version}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
