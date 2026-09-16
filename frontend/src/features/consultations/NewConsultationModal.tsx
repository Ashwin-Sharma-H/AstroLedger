import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { Client, Consultation } from '../../types';
import { apiRequest } from '../../core/api/client';
import { PlusCircle, Calendar, Sparkles, History, User } from 'lucide-react';

interface NewConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  initialClient?: Client | null;
  onSubmit: (consultationData: Partial<Consultation>) => Promise<void>;
}

export const NewConsultationModal: React.FC<NewConsultationModalProps> = ({
  isOpen,
  onClose,
  clients,
  initialClient,
  onSubmit,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClient?.id || (clients.length > 0 ? clients[0].id : '')
  );

  const [formData, setFormData] = useState<Partial<Consultation>>({
    consultation_date: new Date().toISOString().split('T')[0],
    consultation_time: new Date().toTimeString().slice(0, 5),
    consultation_type: 'General',
    reason: '',
    discussion: '',
    summary: '',
    advice: '',
    follow_up_required: false,
    follow_up_date: '',
    follow_up_notes: '',
  });

  const [pastConsultations, setPastConsultations] = useState<Consultation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selectedClientId if initialClient changes
  useEffect(() => {
    if (initialClient?.id) {
      setSelectedClientId(initialClient.id);
    } else if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [initialClient, clients]);

  // Fetch selected client's past consultations for immediate context in the intelligence panel
  useEffect(() => {
    if (!selectedClientId) {
      setPastConsultations([]);
      return;
    }
    let active = true;
    setIsLoadingHistory(true);
    apiRequest(`/api/consultations/?client_id=${selectedClientId}`)
      .then((res) => {
        if (active) {
          setPastConsultations(Array.isArray(res) ? res : res.results || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [selectedClientId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || initialClient;

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        client: selectedClientId,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Consultation Workspace — Record Visit & Prescribed Remedies"
      size="workspace"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Consultation records are permanently stored and linked to the client's horoscopic dossier.
          </span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedClientId}
              className="btn btn-primary"
            >
              <PlusCircle size={16} />
              {isSubmitting ? 'Recording Visit...' : 'Save Consultation Record'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="workspace-split" style={{ gridTemplateColumns: '400px 1fr' }}>
          {/* Left Panel: Client Intelligence Context */}
          <div className="workspace-panel">
            <div className="workspace-section-title">
              <User size={16} color="#fbbf24" /> Client Astrological Profile
            </div>

            {/* Client Selector */}
            <div className="input-group">
              <label className="input-label">Active Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="input-control"
                required
              >
                <option value="" disabled>Choose a client profile...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.client_code}) {c.phone ? `• ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Client Dossier Card */}
            {selectedClient ? (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      {selectedClient.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {selectedClient.client_code} • {selectedClient.phone || 'No phone'}
                    </div>
                  </div>
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {selectedClient.gender || 'Client'}
                  </span>
                </div>

                {/* Horoscopic attributes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NAKSHATRA</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fef08a', marginTop: '2px' }}>
                      {selectedClient.birth_star || 'Not Specified'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RASHI / MONTH</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#93c5fd', marginTop: '2px' }}>
                      {selectedClient.rashi || 'Not Specified'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>
                    <Calendar size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    DOB: {selectedClient.dob || 'Unknown'}{' '}
                    {selectedClient.dob && calculateAge(selectedClient.dob) !== null && `(${calculateAge(selectedClient.dob)} yrs)`}{' '}
                    {selectedClient.birth_time && `@ ${selectedClient.birth_time}`}
                  </div>
                  {selectedClient.birth_place && (
                    <div>📍 {selectedClient.birth_place}</div>
                  )}
                </div>

                {selectedClient.notes && (
                  <div
                    style={{
                      marginTop: '4px',
                      padding: '8px 10px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '6px',
                      borderLeft: '2px solid #f59e0b',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong>Profile Notes:</strong> {selectedClient.notes}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Please select a client to view their astrological coordinates.
              </div>
            )}

            {/* Past Consultations & Remedies History */}
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={14} color="#fbbf24" /> Past Consultation History ({pastConsultations.length})
                </div>
                {isLoadingHistory && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading...</span>
                )}
              </div>

              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '4px',
                }}
              >
                {pastConsultations.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-subtle)',
                      textAlign: 'center',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No prior consultations recorded. This is the first visit for this client.
                  </div>
                ) : (
                  pastConsultations.map((pc, idx) => (
                    <div
                      key={pc.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Visit #{pastConsultations.length - idx}: {pc.consultation_type}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {pc.consultation_date}
                        </span>
                      </div>

                      {pc.reason && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <strong>Reason:</strong> {pc.reason}
                        </div>
                      )}

                      {pc.advice && (
                        <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                          <strong>Past Advice:</strong> {pc.advice}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Active Consultation Recording Form */}
          <div className="workspace-panel">
            <div className="workspace-section-title">
              <Sparkles size={16} color="#fbbf24" /> Consultation Analysis, Notes & Prescribed Remedies
            </div>

            {/* Date, Time & Consultation Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr', gap: '12px' }}>
              <div className="input-group">
                <label className="input-label">Date of Visit *</label>
                <input
                  type="date"
                  name="consultation_date"
                  required
                  value={formData.consultation_date}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Time</label>
                <input
                  type="time"
                  name="consultation_time"
                  value={formData.consultation_time || ''}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Consultation Category</label>
                <select
                  name="consultation_type"
                  value={formData.consultation_type}
                  onChange={handleChange}
                  className="input-control"
                >
                  <option value="General">General Horoscope</option>
                  <option value="Kundali Matching">Kundali Matching</option>
                  <option value="Career & Business">Career & Business</option>
                  <option value="Health & Longevity">Health & Longevity</option>
                  <option value="Muhurtha">Auspicious Muhurtha</option>
                  <option value="Prashna Tantra">Prashna (Horary)</option>
                  <option value="Gemstones & Remedies">Gemstones & Remedies</option>
                </select>
              </div>
            </div>

            {/* Purpose / Reason */}
            <div className="input-group">
              <label className="input-label">Client Inquiry / Objective of Visit</label>
              <input
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                placeholder="e.g. Career transition timing, Sade Sati mitigation, Child horoscope review..."
                className="input-control"
              />
            </div>

            {/* Detailed Astrological Analysis & Chart Discussion */}
            <div className="input-group">
              <label className="input-label">Detailed Astrological Analysis & Planetary Discussion</label>
              <textarea
                name="discussion"
                rows={4}
                value={formData.discussion}
                onChange={handleChange}
                placeholder="Transits (Gocharam), current Dasha-Bhukti effects, planetary aspects, house lord placements, Navamsha observations..."
                className="input-control"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Prescribed Remedies Callout Box */}
            <div className="input-group">
              <label className="input-label" style={{ color: '#fbbf24', fontWeight: 600 }}>
                Prescribed Remedies & Advice (പരിഹാരങ്ങൾ & ഉപദേശങ്ങൾ)
              </label>
              <textarea
                name="advice"
                rows={3}
                value={formData.advice}
                onChange={handleChange}
                placeholder="Recommended temple visits, poojas, archana, mantras, gemstones (weight & metal), lifestyle/dietary guidance..."
                className="input-control"
                style={{
                  resize: 'vertical',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                  background: 'rgba(245, 158, 11, 0.04)',
                }}
              />
            </div>

            {/* Summary */}
            <div className="input-group">
              <label className="input-label">Executive Consultation Summary</label>
              <textarea
                name="summary"
                rows={2}
                value={formData.summary}
                onChange={handleChange}
                placeholder="Concise takeaway conclusion for quick review on future visits..."
                className="input-control"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Follow-up Section */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="follow_up_required"
                  checked={formData.follow_up_required}
                  onChange={handleChange}
                  style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fbbf24' }}>
                  Requires Scheduled Follow-up Review
                </span>
              </label>

              {formData.follow_up_required && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <div className="input-group">
                    <label className="input-label">Follow-up Date</label>
                    <input
                      type="date"
                      name="follow_up_date"
                      value={formData.follow_up_date || ''}
                      onChange={handleChange}
                      className="input-control"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Follow-up Instructions</label>
                    <input
                      name="follow_up_notes"
                      value={formData.follow_up_notes || ''}
                      onChange={handleChange}
                      placeholder="e.g. Check gemstone results after 41-day mandala period"
                      className="input-control"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
